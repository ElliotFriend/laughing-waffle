#![no_std]
//! # The Griddle 🧇
//!
//! One waffle iron per baker, and the iron waits for no one. Load your batter
//! (plus up to three toppings), then watch the ledgers tick:
//!
//! - Claim before ledger 6 of the bake → the contract refuses. Still raw!
//! - Claim during ledgers 6–18 → a golden waffle. Ledger 12 is perfection.
//! - Claim after ledger 18 → charcoal with a handle. You monster.

use bakery_types::{Ingredient, Waffle, WaffleStatus};
use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, Address,
    Env, Vec,
};

/// Minimal client for the slice of the Pantry the Griddle needs.
#[contractclient(name = "PantryClient")]
pub trait PantryConsume {
    fn consume(env: Env, who: Address, items: Vec<Ingredient>);
}

/// Claiming earlier than this many ledgers into a bake → still raw.
pub const GOLDEN_START: u32 = 6;
/// Claiming later than this many ledgers into a bake → burnt.
pub const GOLDEN_END: u32 = 18;
/// The ledger of peak crispiness.
pub const IDEAL_LEDGER: u32 = 12;
/// Maximum toppings per waffle. The iron has standards.
pub const MAX_TOPPINGS: u32 = 3;

const TTL_EXTEND_TO: u32 = 241_920;
const TTL_THRESHOLD: u32 = 120_960;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum GriddleError {
    /// Your iron already has batter in it. Patience.
    IronBusy = 1,
    /// Nothing is cooking. Start a bake first.
    NothingCooking = 2,
    /// More than three toppings and it's not a waffle, it's a casserole.
    TooManyToppings = 3,
    /// The pantry wouldn't hand over the goods (missing ingredients?).
    PantryRefused = 4,
    /// Claimed too early — give it a few more ledgers. The bake continues.
    StillRaw = 5,
    /// No waffle by that id.
    WaffleNotFound = 6,
    /// That waffle isn't yours to move.
    NotYourWaffle = 7,
    /// Only the Brunch Bash may pin ribbons on waffles.
    ContestNotSet = 8,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Pantry,
    Contest,
    NextWaffleId,
    /// The bake currently sizzling on a baker's iron.
    ActiveBake(Address),
    Waffle(u64),
    OwnerWaffles(Address),
    Stats(Address),
}

/// A bake in progress.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bake {
    pub toppings: Vec<Ingredient>,
    pub started_at: u32,
}

/// A baker's lifetime griddle record.
#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct BakerStats {
    pub golden: u32,
    pub burnt: u32,
    pub best_score: u32,
}

/// Batter hits the iron.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Sizzle {
    #[topic]
    pub baker: Address,
    pub started_at: u32,
}

/// A waffle comes off the iron, for better or worse.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WaffleReady {
    #[topic]
    pub baker: Address,
    #[topic]
    pub waffle_id: u64,
    pub status: WaffleStatus,
    pub score: u32,
}

/// A waffle changes hands.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Gifted {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub waffle_id: u64,
}

#[contract]
pub struct Griddle;

#[contractimpl]
impl Griddle {
    pub fn __constructor(env: Env, admin: Address, pantry: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Pantry, &pantry);
        env.storage().instance().set(&DataKey::NextWaffleId, &1u64);
    }

    /// Admin wiring: tell the griddle which contract runs the Brunch Bash.
    pub fn set_contest(env: Env, contest: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Contest, &contest);
    }

    /// Pour the batter. Burns 1 flour + 1 egg + 1 butter from your pantry,
    /// plus whatever toppings you dare. The clock starts now.
    pub fn start_bake(
        env: Env,
        baker: Address,
        toppings: Vec<Ingredient>,
    ) -> Result<(), GriddleError> {
        baker.require_auth();
        Self::extend_instance(&env);

        if toppings.len() > MAX_TOPPINGS {
            return Err(GriddleError::TooManyToppings);
        }
        let bake_key = DataKey::ActiveBake(baker.clone());
        if env.storage().persistent().has(&bake_key) {
            return Err(GriddleError::IronBusy);
        }

        let mut shopping_list: Vec<Ingredient> = Vec::new(&env);
        for staple in [Ingredient::Flour, Ingredient::Egg, Ingredient::Butter] {
            shopping_list.push_back(staple);
        }
        for topping in toppings.iter() {
            shopping_list.push_back(topping);
        }

        let pantry: Address = env.storage().instance().get(&DataKey::Pantry).unwrap();
        if PantryClient::new(&env, &pantry)
            .try_consume(&baker, &shopping_list)
            .is_err()
        {
            return Err(GriddleError::PantryRefused);
        }

        let bake = Bake {
            toppings,
            started_at: env.ledger().sequence(),
        };
        env.storage().persistent().set(&bake_key, &bake);
        env.storage()
            .persistent()
            .extend_ttl(&bake_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        Sizzle {
            baker,
            started_at: bake.started_at,
        }
        .publish(&env);
        Ok(())
    }

    /// Lift the iron! Outcome depends entirely on how long you waited:
    /// too early is a recoverable error (the bake continues), the golden
    /// window mints a scored waffle, and dawdling mints... also a waffle,
    /// in the way that a meteorite is also a rock.
    pub fn claim(env: Env, baker: Address) -> Result<Waffle, GriddleError> {
        baker.require_auth();
        Self::extend_instance(&env);

        let bake_key = DataKey::ActiveBake(baker.clone());
        let bake: Bake = env
            .storage()
            .persistent()
            .get(&bake_key)
            .ok_or(GriddleError::NothingCooking)?;

        let now = env.ledger().sequence();
        let elapsed = now.saturating_sub(bake.started_at);

        if elapsed < GOLDEN_START {
            // No harm done — the waffle keeps cooking.
            return Err(GriddleError::StillRaw);
        }
        env.storage().persistent().remove(&bake_key);

        let waffle = if elapsed <= GOLDEN_END {
            Self::mint_golden(&env, &baker, &bake, elapsed, now)
        } else {
            Self::mint_burnt(&env, &baker, &bake, now)
        };

        WaffleReady {
            baker,
            waffle_id: waffle.id,
            status: waffle.status,
            score: waffle.score,
        }
        .publish(&env);
        Ok(waffle)
    }

    /// Peek at what's on a baker's iron (and how long it's been there).
    pub fn iron_status(env: Env, baker: Address) -> Option<Bake> {
        env.storage()
            .persistent()
            .get(&DataKey::ActiveBake(baker))
    }

    pub fn get_waffle(env: Env, id: u64) -> Result<Waffle, GriddleError> {
        env.storage()
            .persistent()
            .get(&DataKey::Waffle(id))
            .ok_or(GriddleError::WaffleNotFound)
    }

    pub fn waffles_of(env: Env, owner: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::OwnerWaffles(owner))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn stats_of(env: Env, baker: Address) -> BakerStats {
        env.storage()
            .persistent()
            .get(&DataKey::Stats(baker))
            .unwrap_or(BakerStats {
                golden: 0,
                burnt: 0,
                best_score: 0,
            })
    }

    /// Gift a waffle to a fellow brunch enthusiast.
    pub fn transfer(env: Env, from: Address, to: Address, id: u64) -> Result<(), GriddleError> {
        from.require_auth();
        Self::extend_instance(&env);

        let mut waffle = Self::get_waffle(env.clone(), id)?;
        if waffle.owner != from {
            return Err(GriddleError::NotYourWaffle);
        }
        waffle.owner = to.clone();
        env.storage().persistent().set(&DataKey::Waffle(id), &waffle);

        Self::remove_from_owner(&env, &from, id);
        Self::add_to_owner(&env, &to, id);

        Gifted {
            from,
            to,
            waffle_id: id,
        }
        .publish(&env);
        Ok(())
    }

    /// Pin a blue ribbon on a winning waffle.
    /// Only the Brunch Bash contract may call this.
    pub fn award_ribbon(env: Env, waffle_id: u64) -> Result<(), GriddleError> {
        let contest: Address = env
            .storage()
            .instance()
            .get(&DataKey::Contest)
            .ok_or(GriddleError::ContestNotSet)?;
        // Invoker auth: passes automatically when the Brunch Bash is the direct caller.
        contest.require_auth();

        let mut waffle = Self::get_waffle(env.clone(), waffle_id)?;
        waffle.ribbons += 1;
        env.storage()
            .persistent()
            .set(&DataKey::Waffle(waffle_id), &waffle);
        Ok(())
    }

    fn mint_golden(env: &Env, baker: &Address, bake: &Bake, elapsed: u32, now: u32) -> Waffle {
        // The closer to the ideal ledger, the bigger the timing bonus (4..=40).
        let deviation = elapsed.abs_diff(IDEAL_LEDGER);
        let timing_bonus = 40u32.saturating_sub(6 * deviation).max(4);

        let crispiness = (env.prng().gen_range::<u64>(15..=55) as u32 + timing_bonus).min(100);
        let fluffiness = (env.prng().gen_range::<u64>(10..=90) as u32 + timing_bonus / 4).min(100);
        let flavor: u32 = bake.toppings.iter().map(|t| t.flavor_points()).sum();
        let score = crispiness + fluffiness + flavor;

        let waffle = Self::mint(env, baker, bake, WaffleStatus::Golden, crispiness, fluffiness, flavor, score, now);

        let mut stats = Self::stats_of(env.clone(), baker.clone());
        stats.golden += 1;
        stats.best_score = stats.best_score.max(score);
        Self::set_stats(env, baker, &stats);
        waffle
    }

    fn mint_burnt(env: &Env, baker: &Address, bake: &Bake, now: u32) -> Waffle {
        // Crispiness: a perfect 100. Everything else: ash.
        let waffle = Self::mint(env, baker, bake, WaffleStatus::Burnt, 100, 0, 0, 1, now);

        let mut stats = Self::stats_of(env.clone(), baker.clone());
        stats.burnt += 1;
        Self::set_stats(env, baker, &stats);
        waffle
    }

    #[allow(clippy::too_many_arguments)]
    fn mint(
        env: &Env,
        baker: &Address,
        bake: &Bake,
        status: WaffleStatus,
        crispiness: u32,
        fluffiness: u32,
        flavor: u32,
        score: u32,
        now: u32,
    ) -> Waffle {
        let id: u64 = env.storage().instance().get(&DataKey::NextWaffleId).unwrap();
        env.storage()
            .instance()
            .set(&DataKey::NextWaffleId, &(id + 1));

        let waffle = Waffle {
            id,
            owner: baker.clone(),
            status,
            toppings: bake.toppings.clone(),
            crispiness,
            fluffiness,
            flavor,
            score,
            baked_at: now,
            ribbons: 0,
        };
        let key = DataKey::Waffle(id);
        env.storage().persistent().set(&key, &waffle);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        Self::add_to_owner(env, baker, id);
        waffle
    }

    fn add_to_owner(env: &Env, owner: &Address, id: u64) {
        let key = DataKey::OwnerWaffles(owner.clone());
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));
        ids.push_back(id);
        env.storage().persistent().set(&key, &ids);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    fn remove_from_owner(env: &Env, owner: &Address, id: u64) {
        let key = DataKey::OwnerWaffles(owner.clone());
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));
        let mut next: Vec<u64> = Vec::new(env);
        for existing in ids.iter() {
            if existing != id {
                next.push_back(existing);
            }
        }
        env.storage().persistent().set(&key, &next);
    }

    fn set_stats(env: &Env, baker: &Address, stats: &BakerStats) {
        let key = DataKey::Stats(baker.clone());
        env.storage().persistent().set(&key, stats);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    fn extend_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod test;

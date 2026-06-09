#![no_std]
//! # The Pantry 🥚
//!
//! Where every great waffle begins. Bakers forage the shelves for random
//! ingredients (the pantry gremlins restock slowly, hence the cooldown), and
//! the Griddle — and *only* the Griddle — may pull ingredients back out when
//! a bake begins.

use bakery_types::Ingredient;
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, Map, Vec,
};

/// Ledgers a baker must wait between forages (~1 minute on testnet).
pub const FORAGE_COOLDOWN_LEDGERS: u32 = 12;
/// Random ingredients found per forage.
pub const DROPS_PER_FORAGE: u32 = 3;

/// Persistent entries get their TTL bumped to this when touched (~2 weeks).
const TTL_EXTEND_TO: u32 = 241_920;
const TTL_THRESHOLD: u32 = 120_960;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PantryError {
    /// The pantry gremlins are still restocking. Come back in a few ledgers.
    StillRestocking = 1,
    /// You can't bake with ingredients you don't have.
    NotEnoughIngredients = 2,
    /// The admin hasn't told the pantry where the Griddle lives yet.
    GriddleNotSet = 3,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Griddle,
    /// The baker's whole shelf: ingredient -> count. Kept as one map under
    /// one key so the write footprint never depends on what the PRNG drops.
    Shelf(Address),
    /// Ledger sequence of the baker's last forage.
    LastForage(Address),
    /// Whether the baker already received their welcome basket.
    Welcomed(Address),
}

/// Published every time a baker rummages the shelves.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Foraged {
    #[topic]
    pub who: Address,
    pub found: Vec<Ingredient>,
}

#[contract]
pub struct Pantry;

#[contractimpl]
impl Pantry {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Admin wiring: tell the pantry which contract is the Griddle.
    pub fn set_griddle(env: Env, griddle: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Griddle, &griddle);
    }

    /// Rummage through the pantry for random ingredients.
    ///
    /// First-time foragers also receive a welcome basket (flour, egg, butter)
    /// so they can fire up the griddle right away. Repeat visits are limited
    /// by [`FORAGE_COOLDOWN_LEDGERS`].
    pub fn forage(env: Env, who: Address) -> Result<Vec<Ingredient>, PantryError> {
        who.require_auth();
        Self::extend_instance(&env);

        let now = env.ledger().sequence();
        let last_key = DataKey::LastForage(who.clone());
        if let Some(last) = env.storage().persistent().get::<_, u32>(&last_key) {
            if now < last.saturating_add(FORAGE_COOLDOWN_LEDGERS) {
                return Err(PantryError::StillRestocking);
            }
        }
        env.storage().persistent().set(&last_key, &now);
        env.storage()
            .persistent()
            .extend_ttl(&last_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        let mut found: Vec<Ingredient> = Vec::new(&env);

        // Welcome basket: the holy trinity of batter, on the house.
        let welcome_key = DataKey::Welcomed(who.clone());
        if !env.storage().persistent().has(&welcome_key) {
            env.storage().persistent().set(&welcome_key, &true);
            env.storage()
                .persistent()
                .extend_ttl(&welcome_key, TTL_THRESHOLD, TTL_EXTEND_TO);
            for item in [Ingredient::Flour, Ingredient::Egg, Ingredient::Butter] {
                found.push_back(item);
            }
        }

        for _ in 0..DROPS_PER_FORAGE {
            found.push_back(Self::random_drop(&env));
        }

        let shelf_key = DataKey::Shelf(who.clone());
        let mut shelf = Self::full_shelf(&env, &shelf_key);
        for item in found.iter() {
            shelf.set(item, shelf.get(item).unwrap_or(0) + 1);
        }
        env.storage().persistent().set(&shelf_key, &shelf);
        env.storage()
            .persistent()
            .extend_ttl(&shelf_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        Foraged {
            who,
            found: found.clone(),
        }
        .publish(&env);
        Ok(found)
    }

    /// Pull ingredients off the shelves to feed the waffle iron.
    /// Only the Griddle contract may call this.
    pub fn consume(env: Env, who: Address, items: Vec<Ingredient>) -> Result<(), PantryError> {
        let griddle: Address = env
            .storage()
            .instance()
            .get(&DataKey::Griddle)
            .ok_or(PantryError::GriddleNotSet)?;
        // Invoker auth: passes automatically when the Griddle is the direct caller.
        griddle.require_auth();
        Self::extend_instance(&env);

        let shelf_key = DataKey::Shelf(who.clone());
        let mut shelf = Self::full_shelf(&env, &shelf_key);

        // Tally requested amounts first so partial removals never happen.
        let mut needed: Map<Ingredient, u32> = Map::new(&env);
        for item in items.iter() {
            needed.set(item, needed.get(item).unwrap_or(0) + 1);
        }
        for (item, count) in needed.iter() {
            if shelf.get(item).unwrap_or(0) < count {
                return Err(PantryError::NotEnoughIngredients);
            }
        }
        for (item, count) in needed.iter() {
            shelf.set(item, shelf.get(item).unwrap_or(0) - count);
        }
        env.storage().persistent().set(&shelf_key, &shelf);
        Ok(())
    }

    /// How many of one ingredient a baker holds.
    pub fn balance(env: Env, who: Address, item: Ingredient) -> u32 {
        Self::shelf(env, who).get(item).unwrap_or(0)
    }

    /// The baker's whole shelf at a glance.
    pub fn shelf(env: Env, who: Address) -> Map<Ingredient, u32> {
        env.storage()
            .persistent()
            .get(&DataKey::Shelf(who))
            .unwrap_or_else(|| Map::new(&env))
    }

    /// Ledgers until `who` can forage again (0 = ready now).
    pub fn forage_ready_in(env: Env, who: Address) -> u32 {
        let now = env.ledger().sequence();
        match env
            .storage()
            .persistent()
            .get::<_, u32>(&DataKey::LastForage(who))
        {
            Some(last) => last.saturating_add(FORAGE_COOLDOWN_LEDGERS).saturating_sub(now),
            None => 0,
        }
    }

    /// Load a shelf, padding it out to all ten ingredients. Keeping the map
    /// a constant shape keeps write sizes independent of PRNG outcomes, so
    /// declared transaction resources always match real execution.
    fn full_shelf(env: &Env, key: &DataKey) -> Map<Ingredient, u32> {
        let mut shelf: Map<Ingredient, u32> = env
            .storage()
            .persistent()
            .get(key)
            .unwrap_or_else(|| Map::new(env));
        for item in Ingredient::all() {
            if shelf.get(item).is_none() {
                shelf.set(item, 0);
            }
        }
        shelf
    }

    /// Weighted random ingredient drop. Batter staples are common; gold leaf
    /// shows up roughly once in a hundred rummages.
    fn random_drop(env: &Env) -> Ingredient {
        let roll: u64 = env.prng().gen_range(0..100);
        match roll {
            0..=17 => Ingredient::Flour,      // 18%
            18..=35 => Ingredient::Egg,       // 18%
            36..=53 => Ingredient::Butter,    // 18%
            54..=62 => Ingredient::Milk,      // 9%
            63..=71 => Ingredient::Sugar,     // 9%
            72..=79 => Ingredient::Blueberry, // 8%
            80..=86 => Ingredient::Chocolate, // 7%
            87..=92 => Ingredient::Banana,    // 6%
            93..=98 => Ingredient::Bacon,     // 6%
            _ => Ingredient::GoldLeaf,        // 1%
        }
    }

    fn extend_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod test;

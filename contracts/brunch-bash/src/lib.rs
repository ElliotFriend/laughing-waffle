#![no_std]
//! # The Brunch Bash 🏆
//!
//! A recurring waffle competition. Anyone may host a round; entry costs 1 XLM
//! which goes into the pot. When the round closes, anyone may summon the
//! judges: each waffle's score is its merit, plus a dollop of judicial whimsy
//! from the PRNG — the best waffle *usually* wins, but judges are only human.
//! Winner takes the pot and a blue ribbon is pinned on the waffle forever.

use bakery_types::{Waffle, WaffleStatus};
use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, token,
    Address, Env, Vec,
};

/// Minimal client for the slice of the Griddle the Bash needs.
#[contractclient(name = "GriddleClient")]
pub trait GriddleView {
    fn get_waffle(env: Env, id: u64) -> Waffle;
    fn award_ribbon(env: Env, waffle_id: u64);
}

/// Entry fee per waffle: 1 XLM, in stroops.
pub const ENTRY_FEE: i128 = 10_000_000;
/// How much randomness the judges bring to the table.
pub const JUDGE_WHIMSY: u64 = 40;
/// Bounds on how long a round's entry window may stay open, in ledgers.
pub const MIN_ROUND_LEDGERS: u32 = 20;
pub const MAX_ROUND_LEDGERS: u32 = 17_280; // ~1 day

const TTL_EXTEND_TO: u32 = 241_920;
const TTL_THRESHOLD: u32 = 120_960;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum BashError {
    /// A round is already underway — enter that one!
    RoundInProgress = 1,
    /// No round is open right now. Host one!
    NoOpenRound = 2,
    /// Entries have closed for this round.
    EntriesClosed = 3,
    /// The judges are still waiting for the entry window to close.
    JudgingTooSoon = 4,
    /// That waffle already has a seat at this round's table.
    AlreadyEntered = 5,
    /// You can only enter waffles you own.
    NotYourWaffle = 6,
    /// The judges politely decline to taste charcoal.
    JudgesDeclineCharcoal = 7,
    /// Round duration outside the allowed bounds.
    BadDuration = 8,
    /// No round by that id has been settled.
    NoSuchResult = 9,
    /// The champion already collected this pot.
    AlreadyPaid = 10,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Griddle,
    Token,
    NextRoundId,
    /// The currently-open round, if any.
    CurrentRound,
    Entries(u32),
    Result(u32),
    Trophies(Address),
}

/// An open competition round.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Round {
    pub id: u32,
    pub host: Address,
    /// Last ledger (exclusive) on which entries are accepted.
    pub closes_at: u32,
    pub pot: i128,
}

/// One waffle at the judging table.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Entry {
    pub waffle_id: u64,
    pub baker: Address,
    pub score: u32,
}

/// The official record of a settled round.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoundResult {
    pub round_id: u32,
    pub winning_waffle: u64,
    pub champion: Address,
    pub pot: i128,
    pub entries: u32,
    /// Whether the pot has been collected (see [`BrunchBash::collect_pot`]).
    pub paid: bool,
}

/// Someone's hosting brunch!
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BrunchOpened {
    #[topic]
    pub host: Address,
    pub round_id: u32,
    pub closes_at: u32,
}

/// A waffle takes its seat at the judging table.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WaffleEntered {
    #[topic]
    pub baker: Address,
    pub round_id: u32,
    pub waffle_id: u64,
}

/// Round ended with no entries; the judges ate toast and went home.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JudgesAteToast {
    pub round_id: u32,
}

/// A champion is crowned. (The pot is paid out in the ceremony that follows.)
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChampionCrowned {
    #[topic]
    pub champion: Address,
    pub round_id: u32,
    pub waffle_id: u64,
    pub pot: i128,
}

/// The champion has been paid and decorated.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PotCollected {
    #[topic]
    pub champion: Address,
    pub round_id: u32,
    pub pot: i128,
}

#[contract]
pub struct BrunchBash;

#[contractimpl]
impl BrunchBash {
    pub fn __constructor(env: Env, admin: Address, griddle: Address, token: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Griddle, &griddle);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::NextRoundId, &1u32);
    }

    /// Throw a brunch! Anyone can host. Entries stay open for `duration`
    /// ledgers, then anyone may call [`judge`].
    pub fn open_round(env: Env, host: Address, duration: u32) -> Result<u32, BashError> {
        host.require_auth();
        Self::extend_instance(&env);

        if !(MIN_ROUND_LEDGERS..=MAX_ROUND_LEDGERS).contains(&duration) {
            return Err(BashError::BadDuration);
        }
        if env.storage().instance().has(&DataKey::CurrentRound) {
            return Err(BashError::RoundInProgress);
        }

        let id: u32 = env.storage().instance().get(&DataKey::NextRoundId).unwrap();
        env.storage().instance().set(&DataKey::NextRoundId, &(id + 1));

        let round = Round {
            id,
            host: host.clone(),
            closes_at: env.ledger().sequence() + duration,
            pot: 0,
        };
        env.storage().instance().set(&DataKey::CurrentRound, &round);
        env.storage()
            .persistent()
            .set(&DataKey::Entries(id), &Vec::<Entry>::new(&env));
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Entries(id), TTL_THRESHOLD, TTL_EXTEND_TO);

        BrunchOpened {
            host,
            round_id: id,
            closes_at: round.closes_at,
        }
        .publish(&env);
        Ok(id)
    }

    /// Bring your waffle to the table. Costs [`ENTRY_FEE`] into the pot.
    /// Burnt waffles are turned away at the door.
    pub fn enter(env: Env, baker: Address, waffle_id: u64) -> Result<(), BashError> {
        baker.require_auth();
        Self::extend_instance(&env);

        let mut round: Round = env
            .storage()
            .instance()
            .get(&DataKey::CurrentRound)
            .ok_or(BashError::NoOpenRound)?;
        if env.ledger().sequence() >= round.closes_at {
            return Err(BashError::EntriesClosed);
        }

        let griddle: Address = env.storage().instance().get(&DataKey::Griddle).unwrap();
        let waffle: Waffle = GriddleClient::new(&env, &griddle).get_waffle(&waffle_id);
        if waffle.owner != baker {
            return Err(BashError::NotYourWaffle);
        }
        if waffle.status == WaffleStatus::Burnt {
            return Err(BashError::JudgesDeclineCharcoal);
        }

        let entries_key = DataKey::Entries(round.id);
        let mut entries: Vec<Entry> = env.storage().persistent().get(&entries_key).unwrap();
        for entry in entries.iter() {
            if entry.waffle_id == waffle_id {
                return Err(BashError::AlreadyEntered);
            }
        }

        // The entry fee goes into the pot, held by this contract.
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::TokenClient::new(&env, &token_addr).transfer(
            &baker,
            &env.current_contract_address(),
            &ENTRY_FEE,
        );

        entries.push_back(Entry {
            waffle_id,
            baker: baker.clone(),
            score: waffle.score,
        });
        env.storage().persistent().set(&entries_key, &entries);
        round.pot += ENTRY_FEE;
        env.storage().instance().set(&DataKey::CurrentRound, &round);

        WaffleEntered {
            baker,
            round_id: round.id,
            waffle_id,
        }
        .publish(&env);
        Ok(())
    }

    /// Summon the judges. Callable by anyone once entries close.
    ///
    /// Each entry rolls `score + prng(0..=JUDGE_WHIMSY)`; highest roll is
    /// crowned champion. A round with no entries simply ends — the judges
    /// eat toast and go home.
    ///
    /// The verdict is recorded here; the pot changes hands in
    /// [`Self::collect_pot`]. (Two phases keep every storage key this call
    /// touches independent of the PRNG, so simulation footprints hold.)
    pub fn judge(env: Env) -> Result<Option<RoundResult>, BashError> {
        Self::extend_instance(&env);

        let round: Round = env
            .storage()
            .instance()
            .get(&DataKey::CurrentRound)
            .ok_or(BashError::NoOpenRound)?;
        if env.ledger().sequence() < round.closes_at {
            return Err(BashError::JudgingTooSoon);
        }
        env.storage().instance().remove(&DataKey::CurrentRound);

        let entries: Vec<Entry> =
            env.storage().persistent().get(&DataKey::Entries(round.id)).unwrap();
        if entries.is_empty() {
            JudgesAteToast { round_id: round.id }.publish(&env);
            return Ok(None);
        }

        let mut best: Entry = entries.get(0).unwrap();
        let mut best_roll: u64 = 0;
        for entry in entries.iter() {
            let whimsy: u64 = env.prng().gen_range(0..=JUDGE_WHIMSY);
            let roll = entry.score as u64 + whimsy;
            if roll > best_roll {
                best_roll = roll;
                best = entry;
            }
        }

        let result = RoundResult {
            round_id: round.id,
            winning_waffle: best.waffle_id,
            champion: best.baker.clone(),
            pot: round.pot,
            entries: entries.len(),
            paid: false,
        };
        let result_key = DataKey::Result(round.id);
        env.storage().persistent().set(&result_key, &result);
        env.storage()
            .persistent()
            .extend_ttl(&result_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        ChampionCrowned {
            champion: best.baker,
            round_id: round.id,
            waffle_id: best.waffle_id,
            pot: round.pot,
        }
        .publish(&env);
        Ok(Some(result))
    }

    /// The podium ceremony: pay the recorded champion, pin the ribbon, and
    /// add a golden spatula to their trophy shelf. Callable by anyone, once.
    pub fn collect_pot(env: Env, round_id: u32) -> Result<RoundResult, BashError> {
        Self::extend_instance(&env);

        let result_key = DataKey::Result(round_id);
        let mut result: RoundResult = env
            .storage()
            .persistent()
            .get(&result_key)
            .ok_or(BashError::NoSuchResult)?;
        if result.paid {
            return Err(BashError::AlreadyPaid);
        }
        result.paid = true;
        env.storage().persistent().set(&result_key, &result);

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::TokenClient::new(&env, &token_addr).transfer(
            &env.current_contract_address(),
            &result.champion,
            &result.pot,
        );
        let griddle: Address = env.storage().instance().get(&DataKey::Griddle).unwrap();
        GriddleClient::new(&env, &griddle).award_ribbon(&result.winning_waffle);

        let trophy_key = DataKey::Trophies(result.champion.clone());
        let trophies: u32 = env.storage().persistent().get(&trophy_key).unwrap_or(0);
        env.storage().persistent().set(&trophy_key, &(trophies + 1));
        env.storage()
            .persistent()
            .extend_ttl(&trophy_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        PotCollected {
            champion: result.champion.clone(),
            round_id,
            pot: result.pot,
        }
        .publish(&env);
        Ok(result)
    }

    /// The round currently accepting entries, if any.
    pub fn current_round(env: Env) -> Option<Round> {
        env.storage().instance().get(&DataKey::CurrentRound)
    }

    /// Entries at the current (or any past, if unsettled) round's table.
    pub fn entries(env: Env, round_id: u32) -> Vec<Entry> {
        env.storage()
            .persistent()
            .get(&DataKey::Entries(round_id))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// The official record of a settled round.
    pub fn result(env: Env, round_id: u32) -> Result<RoundResult, BashError> {
        env.storage()
            .persistent()
            .get(&DataKey::Result(round_id))
            .ok_or(BashError::NoSuchResult)
    }

    /// Golden Spatula count: rounds won by this baker.
    pub fn trophies(env: Env, baker: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Trophies(baker))
            .unwrap_or(0)
    }

    fn extend_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod test;

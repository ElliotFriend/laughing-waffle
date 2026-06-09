#![cfg(test)]

use super::*;
use bakery_types::Ingredient;
use griddle::GriddleClient as RealGriddleClient;
use pantry::PantryClient as RealPantryClient;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{token::StellarAssetClient, token::TokenClient, Address, Env};

const STARTING_XLM: i128 = 100 * 10_000_000;

struct Bakery {
    env: Env,
    pantry_id: Address,
    griddle: RealGriddleClient<'static>,
    bash: BrunchBashClient<'static>,
    token: TokenClient<'static>,
    token_admin: StellarAssetClient<'static>,
}

fn setup() -> Bakery {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let pantry_id = env.register(pantry::Pantry, (&admin,));
    let griddle_id = env.register(griddle::Griddle, (&admin, &pantry_id));
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let bash_id = env.register(BrunchBash, (&admin, &griddle_id, &sac.address()));

    RealPantryClient::new(&env, &pantry_id).set_griddle(&griddle_id);
    RealGriddleClient::new(&env, &griddle_id).set_contest(&bash_id);

    Bakery {
        pantry_id,
        griddle: RealGriddleClient::new(&env, &griddle_id),
        bash: BrunchBashClient::new(&env, &bash_id),
        token: TokenClient::new(&env, &sac.address()),
        token_admin: StellarAssetClient::new(&env, &sac.address()),
        env,
    }
}

fn advance_ledgers(env: &Env, n: u32) {
    env.ledger().with_mut(|li| li.sequence_number += n);
}

/// Mint some lunch money and bake a golden waffle for `baker`.
fn golden_waffle(bakery: &Bakery, baker: &Address) -> u64 {
    bakery.token_admin.mint(baker, &STARTING_XLM);
    bakery.env.as_contract(&bakery.pantry_id, || {
        let mut shelf: soroban_sdk::Map<Ingredient, u32> =
            soroban_sdk::Map::new(&bakery.env);
        for item in [Ingredient::Flour, Ingredient::Egg, Ingredient::Butter] {
            shelf.set(item, 1);
        }
        bakery
            .env
            .storage()
            .persistent()
            .set(&pantry::DataKey::Shelf(baker.clone()), &shelf);
    });
    bakery.griddle.start_bake(baker, &Vec::new(&bakery.env));
    advance_ledgers(&bakery.env, griddle::IDEAL_LEDGER);
    bakery.griddle.claim(baker).id
}

/// Same, but tragically forgotten on the iron.
fn burnt_waffle(bakery: &Bakery, baker: &Address) -> u64 {
    bakery.token_admin.mint(baker, &STARTING_XLM);
    bakery.env.as_contract(&bakery.pantry_id, || {
        let mut shelf: soroban_sdk::Map<Ingredient, u32> =
            soroban_sdk::Map::new(&bakery.env);
        for item in [Ingredient::Flour, Ingredient::Egg, Ingredient::Butter] {
            shelf.set(item, 1);
        }
        bakery
            .env
            .storage()
            .persistent()
            .set(&pantry::DataKey::Shelf(baker.clone()), &shelf);
    });
    bakery.griddle.start_bake(baker, &Vec::new(&bakery.env));
    advance_ledgers(&bakery.env, griddle::GOLDEN_END + 5);
    bakery.griddle.claim(baker).id
}

#[test]
fn a_full_brunch_from_invitations_to_champion() {
    let bakery = setup();
    let alice = Address::generate(&bakery.env);
    let bob = Address::generate(&bakery.env);
    let host = Address::generate(&bakery.env);

    let alice_waffle = golden_waffle(&bakery, &alice);
    let bob_waffle = golden_waffle(&bakery, &bob);

    let round_id = bakery.bash.open_round(&host, &60);
    assert_eq!(round_id, 1);

    bakery.bash.enter(&alice, &alice_waffle);
    bakery.bash.enter(&bob, &bob_waffle);

    // Entry fees are escrowed in the contract's pot.
    assert_eq!(
        bakery.token.balance(&bakery.bash.address),
        2 * ENTRY_FEE
    );
    assert_eq!(bakery.token.balance(&alice), STARTING_XLM - ENTRY_FEE);
    assert_eq!(bakery.bash.current_round().unwrap().pot, 2 * ENTRY_FEE);
    assert_eq!(bakery.bash.entries(&round_id).len(), 2);

    // The judges deliberate once entries close.
    advance_ledgers(&bakery.env, 60);
    let result = bakery.bash.judge().unwrap();
    assert_eq!(result.round_id, round_id);
    assert_eq!(result.entries, 2);
    assert_eq!(result.pot, 2 * ENTRY_FEE);
    assert!(result.champion == alice || result.champion == bob);
    assert!(!result.paid);
    assert!(bakery.bash.current_round().is_none());

    // Verdict is in, but the pot waits for the ceremony.
    let (winner, winner_waffle) = (result.champion.clone(), result.winning_waffle);
    let loser = if winner == alice { &bob } else { &alice };
    assert_eq!(
        bakery.token.balance(&bakery.bash.address),
        2 * ENTRY_FEE
    );

    // The ceremony: champion takes the whole pot (net +1 fee).
    let collected = bakery.bash.collect_pot(&round_id);
    assert!(collected.paid);
    assert_eq!(
        bakery.token.balance(&winner),
        STARTING_XLM + ENTRY_FEE
    );
    assert_eq!(bakery.token.balance(loser), STARTING_XLM - ENTRY_FEE);
    assert_eq!(bakery.token.balance(&bakery.bash.address), 0);

    // The ribbon is pinned, the trophy shelf grows, history is written.
    assert_eq!(bakery.griddle.get_waffle(&winner_waffle).ribbons, 1);
    assert_eq!(bakery.bash.trophies(&winner), 1);
    assert_eq!(bakery.bash.trophies(loser), 0);
    assert_eq!(bakery.bash.result(&round_id).champion, winner);

    // No double-dipping at the podium.
    assert_eq!(
        bakery.bash.try_collect_pot(&round_id).unwrap_err().unwrap(),
        BashError::AlreadyPaid
    );
}

#[test]
fn judges_decline_charcoal_and_double_dipping() {
    let bakery = setup();
    let alice = Address::generate(&bakery.env);
    let bob = Address::generate(&bakery.env);
    let host = Address::generate(&bakery.env);

    let nice = golden_waffle(&bakery, &alice);
    let cinder = burnt_waffle(&bakery, &bob);

    bakery.bash.open_round(&host, &60);

    let err = bakery.bash.try_enter(&bob, &cinder).unwrap_err().unwrap();
    assert_eq!(err, BashError::JudgesDeclineCharcoal);

    bakery.bash.enter(&alice, &nice);
    let err = bakery.bash.try_enter(&alice, &nice).unwrap_err().unwrap();
    assert_eq!(err, BashError::AlreadyEntered);

    // Bob also can't enter Alice's waffle as his own.
    let err = bakery.bash.try_enter(&bob, &nice).unwrap_err().unwrap();
    assert_eq!(err, BashError::NotYourWaffle);
}

#[test]
fn round_lifecycle_rules() {
    let bakery = setup();
    let alice = Address::generate(&bakery.env);
    let host = Address::generate(&bakery.env);
    let waffle = golden_waffle(&bakery, &alice);

    // Nothing to judge, nothing to enter.
    assert_eq!(
        bakery.bash.try_judge().unwrap_err().unwrap(),
        BashError::NoOpenRound
    );
    assert_eq!(
        bakery.bash.try_enter(&alice, &waffle).unwrap_err().unwrap(),
        BashError::NoOpenRound
    );

    // Rounds can't be blinks or eternities.
    assert_eq!(
        bakery.bash.try_open_round(&host, &5).unwrap_err().unwrap(),
        BashError::BadDuration
    );
    assert_eq!(
        bakery
            .bash
            .try_open_round(&host, &(MAX_ROUND_LEDGERS + 1))
            .unwrap_err()
            .unwrap(),
        BashError::BadDuration
    );

    bakery.bash.open_round(&host, &30);
    assert_eq!(
        bakery.bash.try_open_round(&host, &30).unwrap_err().unwrap(),
        BashError::RoundInProgress
    );
    assert_eq!(
        bakery.bash.try_judge().unwrap_err().unwrap(),
        BashError::JudgingTooSoon
    );

    // Entries slam shut at the closing ledger.
    advance_ledgers(&bakery.env, 30);
    assert_eq!(
        bakery.bash.try_enter(&alice, &waffle).unwrap_err().unwrap(),
        BashError::EntriesClosed
    );

    // An entry-less round: the judges eat toast and go home.
    assert_eq!(bakery.bash.judge(), None);
    assert!(bakery.bash.current_round().is_none());
    assert_eq!(
        bakery.bash.try_result(&1).unwrap_err().unwrap(),
        BashError::NoSuchResult
    );
    assert_eq!(
        bakery.bash.try_collect_pot(&1).unwrap_err().unwrap(),
        BashError::NoSuchResult
    );

    // And the bakery is ready for the next brunch.
    bakery.bash.open_round(&host, &30);
    bakery.bash.enter(&alice, &waffle);
    advance_ledgers(&bakery.env, 30);
    let result = bakery.bash.judge().unwrap();
    assert_eq!(result.champion, alice);
    assert_eq!(result.pot, ENTRY_FEE);
    let collected = bakery.bash.collect_pot(&result.round_id);
    assert_eq!(collected.champion, alice);
    assert_eq!(bakery.token.balance(&alice), STARTING_XLM);
}

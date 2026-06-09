#![cfg(test)]

use super::*;
use bakery_types::WaffleStatus;
use pantry::PantryClient as RealPantryClient;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, Env};

struct Bakery {
    env: Env,
    pantry_id: Address,
    griddle: GriddleClient<'static>,
}

fn setup() -> Bakery {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let pantry_id = env.register(pantry::Pantry, (&admin,));
    let griddle_id = env.register(Griddle, (&admin, &pantry_id));
    RealPantryClient::new(&env, &pantry_id).set_griddle(&griddle_id);
    Bakery {
        griddle: GriddleClient::new(&env, &griddle_id),
        env,
        pantry_id,
    }
}

fn advance_ledgers(env: &Env, n: u32) {
    env.ledger().with_mut(|li| li.sequence_number += n);
}

/// Stock a baker's pantry shelf directly (tests shouldn't gamble on forage).
fn stock(bakery: &Bakery, who: &Address, items: &[(Ingredient, u32)]) {
    bakery.env.as_contract(&bakery.pantry_id, || {
        let key = pantry::DataKey::Shelf(who.clone());
        let mut shelf: soroban_sdk::Map<Ingredient, u32> = bakery
            .env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| soroban_sdk::Map::new(&bakery.env));
        for (item, count) in items {
            shelf.set(*item, shelf.get(*item).unwrap_or(0) + count);
        }
        bakery.env.storage().persistent().set(&key, &shelf);
    });
}

fn stock_batter(bakery: &Bakery, who: &Address) {
    stock(
        bakery,
        who,
        &[
            (Ingredient::Flour, 1),
            (Ingredient::Egg, 1),
            (Ingredient::Butter, 1),
        ],
    );
}

#[test]
fn golden_window_mints_a_scored_waffle() {
    let bakery = setup();
    bakery.env.mock_all_auths();
    let baker = Address::generate(&bakery.env);
    stock_batter(&bakery, &baker);
    stock(&bakery, &baker, &[(Ingredient::Bacon, 1)]);

    let mut toppings = Vec::new(&bakery.env);
    toppings.push_back(Ingredient::Bacon);
    bakery.griddle.start_bake(&baker, &toppings);

    // The iron is sizzling and the batter is spoken for.
    assert!(bakery.griddle.iron_status(&baker).is_some());
    let pantry = RealPantryClient::new(&bakery.env, &bakery.pantry_id);
    assert_eq!(pantry.balance(&baker, &Ingredient::Flour), 0);
    assert_eq!(pantry.balance(&baker, &Ingredient::Bacon), 0);

    // Too eager: still raw, and the bake survives the scolding.
    advance_ledgers(&bakery.env, 2);
    let err = bakery.griddle.try_claim(&baker).unwrap_err().unwrap();
    assert_eq!(err, GriddleError::StillRaw);
    assert!(bakery.griddle.iron_status(&baker).is_some());

    // Peak crispiness window.
    advance_ledgers(&bakery.env, IDEAL_LEDGER - 2);
    let waffle = bakery.griddle.claim(&baker);
    assert_eq!(waffle.status, WaffleStatus::Golden);
    assert_eq!(waffle.owner, baker);
    assert_eq!(waffle.flavor, Ingredient::Bacon.flavor_points());
    assert!(waffle.crispiness <= 100 && waffle.fluffiness <= 100);
    assert_eq!(
        waffle.score,
        waffle.crispiness + waffle.fluffiness + waffle.flavor
    );

    // Bookkeeping: ownership, stats, and a free iron.
    assert!(bakery.griddle.iron_status(&baker).is_none());
    let owned = bakery.griddle.waffles_of(&baker);
    assert_eq!(owned.len(), 1);
    assert_eq!(owned.get(0).unwrap(), waffle.id);
    let stats = bakery.griddle.stats_of(&baker);
    assert_eq!(stats.golden, 1);
    assert_eq!(stats.best_score, waffle.score);
}

#[test]
fn dawdling_mints_charcoal() {
    let bakery = setup();
    bakery.env.mock_all_auths();
    let baker = Address::generate(&bakery.env);
    stock_batter(&bakery, &baker);

    bakery.griddle.start_bake(&baker, &Vec::new(&bakery.env));
    advance_ledgers(&bakery.env, GOLDEN_END + 1);

    let waffle = bakery.griddle.claim(&baker);
    assert_eq!(waffle.status, WaffleStatus::Burnt);
    assert_eq!(waffle.crispiness, 100); // technically flawless
    assert_eq!(waffle.score, 1);
    assert_eq!(bakery.griddle.stats_of(&baker).burnt, 1);
}

#[test]
fn one_iron_per_baker_and_three_topping_limit() {
    let bakery = setup();
    bakery.env.mock_all_auths();
    let baker = Address::generate(&bakery.env);
    stock(
        &bakery,
        &baker,
        &[
            (Ingredient::Flour, 5),
            (Ingredient::Egg, 5),
            (Ingredient::Butter, 5),
            (Ingredient::Sugar, 5),
        ],
    );

    // Four toppings is a casserole.
    let mut too_many = Vec::new(&bakery.env);
    for _ in 0..4 {
        too_many.push_back(Ingredient::Sugar);
    }
    let err = bakery
        .griddle
        .try_start_bake(&baker, &too_many)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, GriddleError::TooManyToppings);

    bakery.griddle.start_bake(&baker, &Vec::new(&bakery.env));
    let err = bakery
        .griddle
        .try_start_bake(&baker, &Vec::new(&bakery.env))
        .unwrap_err()
        .unwrap();
    assert_eq!(err, GriddleError::IronBusy);
}

#[test]
fn empty_shelf_means_no_bake() {
    let bakery = setup();
    bakery.env.mock_all_auths();
    let baker = Address::generate(&bakery.env);

    let err = bakery
        .griddle
        .try_start_bake(&baker, &Vec::new(&bakery.env))
        .unwrap_err()
        .unwrap();
    assert_eq!(err, GriddleError::PantryRefused);

    let err = bakery.griddle.try_claim(&baker).unwrap_err().unwrap();
    assert_eq!(err, GriddleError::NothingCooking);
}

#[test]
fn waffles_can_be_gifted_but_not_stolen() {
    let bakery = setup();
    bakery.env.mock_all_auths();
    let baker = Address::generate(&bakery.env);
    let friend = Address::generate(&bakery.env);
    let thief = Address::generate(&bakery.env);
    stock_batter(&bakery, &baker);

    bakery.griddle.start_bake(&baker, &Vec::new(&bakery.env));
    advance_ledgers(&bakery.env, IDEAL_LEDGER);
    let waffle = bakery.griddle.claim(&baker);

    // Even with auth mocked, the contract checks ownership.
    let err = bakery
        .griddle
        .try_transfer(&thief, &friend, &waffle.id)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, GriddleError::NotYourWaffle);

    bakery.griddle.transfer(&baker, &friend, &waffle.id);
    assert_eq!(bakery.griddle.get_waffle(&waffle.id).owner, friend);
    assert_eq!(bakery.griddle.waffles_of(&baker).len(), 0);
    assert_eq!(bakery.griddle.waffles_of(&friend).len(), 1);
}

#[test]
fn ribbons_only_from_the_contest() {
    let bakery = setup();
    bakery.env.mock_all_auths();
    let baker = Address::generate(&bakery.env);
    let contest = Address::generate(&bakery.env);
    stock_batter(&bakery, &baker);

    bakery.griddle.start_bake(&baker, &Vec::new(&bakery.env));
    advance_ledgers(&bakery.env, IDEAL_LEDGER);
    let waffle = bakery.griddle.claim(&baker);

    // No contest wired yet.
    let err = bakery
        .griddle
        .try_award_ribbon(&waffle.id)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, GriddleError::ContestNotSet);

    bakery.griddle.set_contest(&contest);
    bakery.griddle.award_ribbon(&waffle.id);
    assert_eq!(bakery.griddle.get_waffle(&waffle.id).ribbons, 1);
}

#[test]
#[should_panic(expected = "Auth")]
fn ribbon_without_contest_auth_panics() {
    let bakery = setup();
    bakery.env.mock_all_auths();
    let baker = Address::generate(&bakery.env);
    let contest = Address::generate(&bakery.env);
    stock_batter(&bakery, &baker);

    bakery.griddle.start_bake(&baker, &Vec::new(&bakery.env));
    advance_ledgers(&bakery.env, IDEAL_LEDGER);
    let waffle = bakery.griddle.claim(&baker);
    bakery.griddle.set_contest(&contest);

    // Drop the mocks: a rando can't pin ribbons.
    bakery.env.set_auths(&[]);
    bakery.griddle.award_ribbon(&waffle.id);
}

#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, Env};

fn setup() -> (Env, PantryClient<'static>, Address) {
    let env = Env::default();
    let admin = Address::generate(&env);
    let id = env.register(Pantry, (&admin,));
    let client = PantryClient::new(&env, &id);
    (env, client, admin)
}

fn advance_ledgers(env: &Env, n: u32) {
    env.ledger().with_mut(|li| li.sequence_number += n);
}

#[test]
fn first_forage_includes_welcome_basket() {
    let (env, pantry, _) = setup();
    env.mock_all_auths();
    let baker = Address::generate(&env);

    let found = pantry.forage(&baker);
    // 3 welcome staples + 3 random drops.
    assert_eq!(found.len(), 3 + DROPS_PER_FORAGE);
    assert!(pantry.balance(&baker, &Ingredient::Flour) >= 1);
    assert!(pantry.balance(&baker, &Ingredient::Egg) >= 1);
    assert!(pantry.balance(&baker, &Ingredient::Butter) >= 1);

    // Shelf totals match what was found.
    let shelf = pantry.shelf(&baker);
    let total: u32 = shelf.iter().map(|(_, count)| count).sum();
    assert_eq!(total, found.len());
}

#[test]
fn forage_cooldown_is_enforced() {
    let (env, pantry, _) = setup();
    env.mock_all_auths();
    let baker = Address::generate(&env);

    pantry.forage(&baker);
    assert_eq!(pantry.forage_ready_in(&baker), FORAGE_COOLDOWN_LEDGERS);

    // The gremlins are still restocking.
    let err = pantry.try_forage(&baker).unwrap_err().unwrap();
    assert_eq!(err, PantryError::StillRestocking);

    advance_ledgers(&env, FORAGE_COOLDOWN_LEDGERS);
    assert_eq!(pantry.forage_ready_in(&baker), 0);
    let found = pantry.forage(&baker);
    // No second welcome basket.
    assert_eq!(found.len(), DROPS_PER_FORAGE);
}

#[test]
fn consume_requires_wiring_and_sufficient_balance() {
    let (env, pantry, _) = setup();
    env.mock_all_auths();
    let baker = Address::generate(&env);
    let griddle = Address::generate(&env);

    let mut items = Vec::new(&env);
    items.push_back(Ingredient::Flour);

    // Before wiring, nobody can consume.
    let err = pantry.try_consume(&baker, &items).unwrap_err().unwrap();
    assert_eq!(err, PantryError::GriddleNotSet);

    pantry.set_griddle(&griddle);

    // Empty shelf: refused.
    let err = pantry.try_consume(&baker, &items).unwrap_err().unwrap();
    assert_eq!(err, PantryError::NotEnoughIngredients);

    // Stock up, then consume succeeds and decrements.
    pantry.forage(&baker);
    let flour_before = pantry.balance(&baker, &Ingredient::Flour);
    pantry.consume(&baker, &items);
    assert_eq!(pantry.balance(&baker, &Ingredient::Flour), flour_before - 1);
}

#[test]
fn consume_is_atomic_when_one_ingredient_is_short() {
    let (env, pantry, _) = setup();
    env.mock_all_auths();
    let baker = Address::generate(&env);
    let griddle = Address::generate(&env);
    pantry.set_griddle(&griddle);
    pantry.forage(&baker); // welcome basket guarantees 1 flour

    let mut items = Vec::new(&env);
    items.push_back(Ingredient::Flour);
    items.push_back(Ingredient::GoldLeaf);
    items.push_back(Ingredient::GoldLeaf); // nobody has two gold leaf on day one

    let gold = pantry.balance(&baker, &Ingredient::GoldLeaf);
    assert!(gold < 2);
    let flour_before = pantry.balance(&baker, &Ingredient::Flour);

    let err = pantry.try_consume(&baker, &items).unwrap_err().unwrap();
    assert_eq!(err, PantryError::NotEnoughIngredients);
    // Flour untouched: no partial removal.
    assert_eq!(pantry.balance(&baker, &Ingredient::Flour), flour_before);
}

#[test]
#[should_panic(expected = "Auth")]
fn consume_without_griddle_auth_panics() {
    let (env, pantry, _) = setup();
    env.mock_all_auths();
    let baker = Address::generate(&env);
    let griddle = Address::generate(&env);
    pantry.set_griddle(&griddle);
    pantry.forage(&baker);

    // Drop all auth mocking: a direct caller who isn't the Griddle gets bounced.
    env.set_auths(&[]);
    let mut items = Vec::new(&env);
    items.push_back(Ingredient::Flour);
    pantry.consume(&baker, &items);
}

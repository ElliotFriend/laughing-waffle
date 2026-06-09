#![no_std]
//! Shared types for the Laughing Waffle bakery: the ingredients you forage,
//! and the waffles you (hopefully don't burn while you) bake.

use soroban_sdk::{contracttype, Address, Vec};

/// Everything you might find rummaging around the Pantry.
///
/// The first three are the holy trinity of batter. The rest are toppings,
/// ranked by how much the brunch judges swoon over them.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Ingredient {
    Flour = 0,
    Egg = 1,
    Butter = 2,
    Milk = 3,
    Sugar = 4,
    Blueberry = 5,
    Chocolate = 6,
    Banana = 7,
    Bacon = 8,
    GoldLeaf = 9,
}

impl Ingredient {
    /// Flavor points a topping contributes to a waffle's score.
    pub fn flavor_points(&self) -> u32 {
        match self {
            Ingredient::Flour | Ingredient::Egg | Ingredient::Butter => 5,
            Ingredient::Milk | Ingredient::Sugar => 8,
            Ingredient::Blueberry | Ingredient::Chocolate | Ingredient::Banana => 15,
            Ingredient::Bacon => 25,
            Ingredient::GoldLeaf => 60,
        }
    }

    pub fn all() -> [Ingredient; 10] {
        [
            Ingredient::Flour,
            Ingredient::Egg,
            Ingredient::Butter,
            Ingredient::Milk,
            Ingredient::Sugar,
            Ingredient::Blueberry,
            Ingredient::Chocolate,
            Ingredient::Banana,
            Ingredient::Bacon,
            Ingredient::GoldLeaf,
        ]
    }
}

/// How a bake turned out.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WaffleStatus {
    /// Claimed inside the golden window. A thing of beauty.
    Golden = 0,
    /// Left on the iron too long. Technically still a waffle. Legally, charcoal.
    Burnt = 1,
}

/// A one-of-a-kind waffle, lovingly griddled on-chain.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Waffle {
    pub id: u64,
    pub owner: Address,
    pub status: WaffleStatus,
    pub toppings: Vec<Ingredient>,
    /// 0..=100. Burnt waffles are a perfect 100. Small consolation.
    pub crispiness: u32,
    /// 0..=100.
    pub fluffiness: u32,
    /// Sum of topping flavor points.
    pub flavor: u32,
    /// crispiness + fluffiness + flavor. What the brunch judges look at.
    pub score: u32,
    /// Ledger sequence the waffle came off the iron.
    pub baked_at: u32,
    /// Blue ribbons won at the Brunch Bash.
    pub ribbons: u32,
}

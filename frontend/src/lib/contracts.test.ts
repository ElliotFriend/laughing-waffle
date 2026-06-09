import { describe, expect, it } from 'vitest';
import { Ingredient } from 'griddle';
import { PantryError } from 'pantry';
import { GriddleError } from 'griddle';
import { BashError } from 'brunch_bash';
import {
  ALL_INGREDIENTS,
  BATTER,
  CONTRACT_IDS,
  friendlyError,
  INGREDIENTS,
  shortAddress,
} from './contracts';

describe('ingredient metadata', () => {
  it('covers all ten on-chain ingredients', () => {
    expect(ALL_INGREDIENTS).toHaveLength(10);
    for (const ing of ALL_INGREDIENTS) {
      expect(INGREDIENTS[ing]).toBeDefined();
      expect(INGREDIENTS[ing].name.length).toBeGreaterThan(0);
      expect(INGREDIENTS[ing].emoji.length).toBeGreaterThan(0);
    }
  });

  it('mirrors the flavor points in bakery-types', () => {
    // contracts/types/src/lib.rs: staples 5, milk/sugar 8, fruit/choc 15, bacon 25, gold 60.
    expect(INGREDIENTS[Ingredient.Flour].flavor).toBe(5);
    expect(INGREDIENTS[Ingredient.Milk].flavor).toBe(8);
    expect(INGREDIENTS[Ingredient.Blueberry].flavor).toBe(15);
    expect(INGREDIENTS[Ingredient.Bacon].flavor).toBe(25);
    expect(INGREDIENTS[Ingredient.GoldLeaf].flavor).toBe(60);
  });

  it('keeps the holy trinity of batter intact', () => {
    expect(BATTER).toEqual([Ingredient.Flour, Ingredient.Egg, Ingredient.Butter]);
  });
});

describe('friendlyError', () => {
  it('maps every griddle contract error code to a friendly excuse', () => {
    for (const code of Object.keys(GriddleError).map(Number)) {
      const err = new Error(`host invocation failed: Error(Contract, #${code}) etc`);
      const msg = friendlyError(err, 'griddle');
      expect(msg).not.toContain('Error(Contract');
    }
  });

  it('maps every pantry and bash error code too', () => {
    for (const code of Object.keys(PantryError).map(Number)) {
      expect(friendlyError(new Error(`Error(Contract, #${code})`), 'pantry')).not.toContain(
        'Error(Contract',
      );
    }
    for (const code of Object.keys(BashError).map(Number)) {
      expect(friendlyError(new Error(`Error(Contract, #${code})`), 'brunchBash')).not.toContain(
        'Error(Contract',
      );
    }
  });

  it('knows StillRaw when it sees it', () => {
    const err = new Error('Transaction simulation failed: Error(Contract, #5)');
    expect(friendlyError(err, 'griddle')).toContain('Still raw');
  });

  it('passes through unknown errors, truncated', () => {
    const long = new Error('x'.repeat(500));
    expect(friendlyError(long, 'pantry').length).toBeLessThanOrEqual(221);
  });
});

describe('plumbing', () => {
  it('has three distinct deployed contract ids', () => {
    const ids = Object.values(CONTRACT_IDS);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id).toMatch(/^C[A-Z2-7]{55}$/);
    }
  });

  it('shortens addresses for humans', () => {
    expect(shortAddress('GCNK6XSVDU64BCAFEKUUQ4SBCEAUWZB2B72S6S3VIBN6VI7J46IEW5XM')).toBe(
      'GCNK…W5XM',
    );
  });
});

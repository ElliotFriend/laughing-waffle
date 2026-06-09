import { describe, expect, it } from 'vitest';
import { bakePhase, bakeProgress, phaseLabel, timingBonus } from './timing';
import { GOLDEN_END, GOLDEN_START, IDEAL_LEDGER } from './contracts';

describe('bakePhase', () => {
  it('matches the contract windows exactly', () => {
    expect(bakePhase(0)).toBe('raw');
    expect(bakePhase(GOLDEN_START - 1)).toBe('raw');
    expect(bakePhase(GOLDEN_START)).toBe('golden');
    expect(bakePhase(IDEAL_LEDGER)).toBe('golden');
    expect(bakePhase(GOLDEN_END)).toBe('golden');
    expect(bakePhase(GOLDEN_END + 1)).toBe('burnt');
    expect(bakePhase(9999)).toBe('burnt');
  });
});

describe('timingBonus', () => {
  it('peaks at the ideal ledger', () => {
    expect(timingBonus(IDEAL_LEDGER)).toBe(40);
  });

  it('mirrors the contract formula: 40 - 6*deviation, floored at 4', () => {
    expect(timingBonus(IDEAL_LEDGER - 1)).toBe(34);
    expect(timingBonus(IDEAL_LEDGER + 1)).toBe(34);
    // Window edges: |6-12| = |18-12| = 6 -> 40-36 = 4.
    expect(timingBonus(GOLDEN_START)).toBe(4);
    expect(timingBonus(GOLDEN_END)).toBe(4);
    // Far out it still floors at 4 (burnt waffles don't get bonuses anyway).
    expect(timingBonus(40)).toBe(4);
  });
});

describe('bakeProgress', () => {
  it('runs 0..1 and clamps', () => {
    expect(bakeProgress(0)).toBe(0);
    expect(bakeProgress(GOLDEN_END + 1)).toBe(1);
    expect(bakeProgress(100)).toBe(1);
    const mid = bakeProgress(IDEAL_LEDGER);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
  });
});

describe('phaseLabel', () => {
  it('has something to say in every phase', () => {
    for (const phase of ['raw', 'golden', 'burnt'] as const) {
      expect(phaseLabel(phase).length).toBeGreaterThan(0);
    }
  });
});

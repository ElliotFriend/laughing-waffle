// Pure bake-timing logic, mirroring contracts/griddle/src/lib.rs.
import { GOLDEN_END, GOLDEN_START, IDEAL_LEDGER } from './contracts';

export type BakePhase = 'raw' | 'golden' | 'burnt';

export function bakePhase(elapsedLedgers: number): BakePhase {
  if (elapsedLedgers < GOLDEN_START) return 'raw';
  if (elapsedLedgers <= GOLDEN_END) return 'golden';
  return 'burnt';
}

/** The griddle's timing bonus: 40 at the ideal ledger, fading to 4 at the window edges. */
export function timingBonus(elapsedLedgers: number): number {
  const deviation = Math.abs(elapsedLedgers - IDEAL_LEDGER);
  return Math.max(40 - 6 * deviation, 4);
}

/** 0..=1 progress across the whole life of a bake (raw -> burnt). */
export function bakeProgress(elapsedLedgers: number): number {
  return Math.min(elapsedLedgers / (GOLDEN_END + 1), 1);
}

export function phaseLabel(phase: BakePhase): string {
  switch (phase) {
    case 'raw':
      return 'Still raw — patience!';
    case 'golden':
      return 'Golden window — claim it!';
    case 'burnt':
      return "It's... charcoal now. Claim it anyway.";
  }
}

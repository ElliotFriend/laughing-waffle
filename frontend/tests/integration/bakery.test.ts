// Plays a real game against the deployed Testnet contracts with a fresh,
// friendbot-funded account: forage (welcome basket!), bake, claim a golden
// waffle, and read the Brunch Bash state. Slow by design — real ledgers.
import { beforeAll, describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { basicNodeSigner } from '@stellar/stellar-sdk/contract';
import { Ingredient, WaffleStatus } from 'griddle';
import type { Waffle } from 'griddle';
import {
  brunchBash,
  griddle,
  latestLedger,
  pantry,
  TESTNET_PASSPHRASE,
  toMap,
  type SignTransaction,
} from '../../src/lib/contracts';

const FRIENDBOT = 'https://friendbot.stellar.org';

function unwrap<T>(value: unknown): T {
  if (value && typeof (value as { unwrap?: unknown }).unwrap === 'function') {
    return (value as { unwrap: () => T }).unwrap();
  }
  return value as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let me: string;
let sign: SignTransaction;

beforeAll(async () => {
  const kp = Keypair.random();
  me = kp.publicKey();
  const signer = basicNodeSigner(kp, TESTNET_PASSPHRASE);
  sign = signer.signTransaction as SignTransaction;
  const res = await fetch(`${FRIENDBOT}/?addr=${me}`);
  expect(res.ok).toBe(true);
});

describe('a fresh baker plays the bakery on Testnet', () => {
  it('starts with an empty shelf and no waffles', async () => {
    const shelf = toMap<Ingredient, number>((await pantry().shelf({ who: me })).result);
    const total = [...shelf.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
    const waffles = (await griddle().waffles_of({ owner: me })).result;
    expect(waffles).toHaveLength(0);
  });

  it('forages a welcome basket plus random drops', async () => {
    const tx = await pantry(me, sign).forage({ who: me });
    const sent = await tx.signAndSend();
    const found = unwrap<Ingredient[]>(sent.result);

    // 3 welcome staples + 3 random drops.
    expect(found).toHaveLength(6);
    expect(found.slice(0, 3)).toEqual([Ingredient.Flour, Ingredient.Egg, Ingredient.Butter]);

    const shelf = toMap<Ingredient, number>((await pantry().shelf({ who: me })).result);
    expect(shelf.get(Ingredient.Flour) ?? 0).toBeGreaterThanOrEqual(1);
    expect(shelf.get(Ingredient.Egg) ?? 0).toBeGreaterThanOrEqual(1);
    expect(shelf.get(Ingredient.Butter) ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('refuses an immediate second forage (gremlins restocking)', async () => {
    await expect(async () => {
      const tx = await pantry(me, sign).forage({ who: me });
      await tx.signAndSend();
    }).rejects.toThrowError(/Error\(Contract, #1\)/);

    const readyIn = (await pantry().forage_ready_in({ who: me })).result;
    expect(readyIn).toBeGreaterThan(0);
  });

  it('bakes a golden waffle (the timing game, played for real)', async () => {
    const tx = await griddle(me, sign).start_bake({ baker: me, toppings: [] });
    await tx.signAndSend();

    const iron = (await griddle().iron_status({ baker: me })).result;
    expect(iron).toBeDefined();
    const startedAt = iron!.started_at;

    // Claiming right away must be rejected: still raw (and the bake survives).
    await expect(async () => {
      const early = await griddle(me, sign).claim({ baker: me });
      await early.signAndSend();
    }).rejects.toThrowError(/Error\(Contract, #5\)/);

    // Wait for the golden window (ledgers 6..=18 after the pour).
    let now = await latestLedger();
    while (now - startedAt < 7) {
      await sleep(4000);
      now = await latestLedger();
    }

    const claim = await griddle(me, sign).claim({ baker: me });
    const sent = await claim.signAndSend();
    const waffle = unwrap<Waffle>(sent.result);

    expect(waffle.status).toBe(WaffleStatus.Golden);
    expect(waffle.owner).toBe(me);
    expect(waffle.score).toBe(waffle.crispiness + waffle.fluffiness + waffle.flavor);
    expect(waffle.score).toBeGreaterThan(0);

    const ids = (await griddle().waffles_of({ owner: me })).result;
    expect(ids).toContain(waffle.id);

    const stats = (await griddle().stats_of({ baker: me })).result;
    expect(stats.golden).toBe(1);
    expect(stats.best_score).toBe(waffle.score);

    // The iron is free again (bindings decode Option::None as null).
    expect((await griddle().iron_status({ baker: me })).result).toBeFalsy();
  }, 240_000);

  it('reads the Brunch Bash: round 1 history exists and is paid out', async () => {
    // Round 1 was settled during deployment smoke tests — it's history now.
    const result = unwrap<{ paid: boolean; entries: number; pot: bigint }>(
      (await brunchBash().result({ round_id: 1 })).result,
    );
    expect(result.paid).toBe(true);
    expect(result.entries).toBeGreaterThanOrEqual(1);
    expect(BigInt(result.pot)).toBeGreaterThan(0n);

    // A fresh baker has an empty trophy shelf.
    expect((await brunchBash().trophies({ baker: me })).result).toBe(0);
  });
});

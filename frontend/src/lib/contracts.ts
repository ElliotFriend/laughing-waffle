// Contract clients (generated bindings) plus game metadata the UI leans on.
import { Client as PantryClient, networks as pantryNet } from 'pantry';
import { Client as GriddleClient, networks as griddleNet } from 'griddle';
import { Client as BashClient, networks as bashNet } from 'brunch_bash';
import { Ingredient } from 'griddle';
import { rpc } from '@stellar/stellar-sdk';

export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const RPC_URL = 'https://soroban-testnet.stellar.org';

/** The signer shape the generated contract clients expect. */
export type SignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>;

// Griddle timing constants — keep in sync with contracts/griddle/src/lib.rs.
export const GOLDEN_START = 6;
export const GOLDEN_END = 18;
export const IDEAL_LEDGER = 12;
export const FORAGE_COOLDOWN = 12;
export const ENTRY_FEE_XLM = 1;

export const server = new rpc.Server(RPC_URL);

function clientOpts(publicKey?: string, signTransaction?: SignTransaction) {
  return {
    rpcUrl: RPC_URL,
    networkPassphrase: TESTNET_PASSPHRASE,
    publicKey,
    signTransaction,
  };
}

export function pantry(publicKey?: string, sign?: SignTransaction): PantryClient {
  return new PantryClient({ ...clientOpts(publicKey, sign), contractId: pantryNet.testnet.contractId });
}

export function griddle(publicKey?: string, sign?: SignTransaction): GriddleClient {
  return new GriddleClient({ ...clientOpts(publicKey, sign), contractId: griddleNet.testnet.contractId });
}

export function brunchBash(publicKey?: string, sign?: SignTransaction): BashClient {
  return new BashClient({ ...clientOpts(publicKey, sign), contractId: bashNet.testnet.contractId });
}

export const CONTRACT_IDS = {
  pantry: pantryNet.testnet.contractId,
  griddle: griddleNet.testnet.contractId,
  brunchBash: bashNet.testnet.contractId,
};

export interface IngredientInfo {
  name: string;
  emoji: string;
  rarity: 'common' | 'tasty' | 'fancy' | 'legendary';
  flavor: number;
}

export const INGREDIENTS: Record<Ingredient, IngredientInfo> = {
  [Ingredient.Flour]: { name: 'Flour', emoji: '🌾', rarity: 'common', flavor: 5 },
  [Ingredient.Egg]: { name: 'Egg', emoji: '🥚', rarity: 'common', flavor: 5 },
  [Ingredient.Butter]: { name: 'Butter', emoji: '🧈', rarity: 'common', flavor: 5 },
  [Ingredient.Milk]: { name: 'Milk', emoji: '🥛', rarity: 'common', flavor: 8 },
  [Ingredient.Sugar]: { name: 'Sugar', emoji: '🍬', rarity: 'common', flavor: 8 },
  [Ingredient.Blueberry]: { name: 'Blueberry', emoji: '🫐', rarity: 'tasty', flavor: 15 },
  [Ingredient.Chocolate]: { name: 'Chocolate', emoji: '🍫', rarity: 'tasty', flavor: 15 },
  [Ingredient.Banana]: { name: 'Banana', emoji: '🍌', rarity: 'tasty', flavor: 15 },
  [Ingredient.Bacon]: { name: 'Bacon', emoji: '🥓', rarity: 'fancy', flavor: 25 },
  [Ingredient.GoldLeaf]: { name: 'Gold Leaf', emoji: '✨', rarity: 'legendary', flavor: 60 },
};

/** The three staples every bake burns automatically. */
export const BATTER = [Ingredient.Flour, Ingredient.Egg, Ingredient.Butter];

/** Toppings a baker can choose from (everything, really — flour waffle topped with flour is legal and hilarious). */
export const ALL_INGREDIENTS: Ingredient[] = Object.keys(INGREDIENTS).map(Number) as Ingredient[];

const CONTRACT_ERRORS: Record<string, Record<number, string>> = {
  pantry: {
    1: 'The pantry gremlins are still restocking — give it a minute.',
    2: "You can't bake with ingredients you don't have.",
    3: 'The pantry has no griddle wired up (tell the admin).',
  },
  griddle: {
    1: 'Your iron already has batter in it. Patience.',
    2: 'Nothing is cooking. Pour some batter first!',
    3: "More than three toppings and it's a casserole, not a waffle.",
    4: "The pantry refused — you're missing batter (1 flour, 1 egg, 1 butter) or a topping.",
    5: 'Still raw! Give it a few more ledgers on the iron.',
    6: 'No waffle by that id.',
    7: "That waffle isn't yours.",
    8: 'No contest is wired to the griddle.',
  },
  brunchBash: {
    1: 'A round is already underway — enter that one!',
    2: 'No round is open right now. Host one!',
    3: 'Entries have closed for this round.',
    4: 'The judges are still waiting for entries to close.',
    5: 'That waffle already has a seat at the table.',
    6: 'You can only enter waffles you own.',
    7: 'The judges politely decline to taste charcoal.',
    8: 'Round length is out of bounds (20–17280 ledgers).',
    9: 'No settled round by that id.',
    10: 'That pot has already been collected.',
  },
};

/** Turn a host "Error(Contract, #N)" blob into a friendly bakery excuse. */
export function friendlyError(e: unknown, contract: keyof typeof CONTRACT_ERRORS): string {
  const msg = e instanceof Error ? e.message : String(e);
  const match = msg.match(/Error\(Contract, #(\d+)\)/);
  if (match) {
    const mapped = CONTRACT_ERRORS[contract][Number(match[1])];
    if (mapped) return mapped;
  }
  if (msg.includes('Signing rejected') || msg.includes('User declined')) {
    return 'Signature declined — no waffles were harmed.';
  }
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}

/**
 * The generated bindings type soroban maps as JS Map but actually decode
 * them as arrays of [key, value] pairs. Accept either, return a real Map.
 */
export function toMap<K, V>(raw: unknown): Map<K, V> {
  if (raw instanceof Map) return raw as Map<K, V>;
  return new Map((raw ?? []) as Iterable<[K, V]>);
}

export async function latestLedger(): Promise<number> {
  const l = await server.getLatestLedger();
  return l.sequence;
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

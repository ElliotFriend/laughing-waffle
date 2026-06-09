import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CA5PODGBAVRG2AUYZLYEILEATUO2NCLXQLOKI2G7GEJJXSLG762GAPXW",
  }
} as const


/**
 * A bake in progress.
 */
export interface Bake {
  started_at: u32;
  toppings: Array<Ingredient>;
}



export type DataKey = {tag: "Admin", values: void} | {tag: "Pantry", values: void} | {tag: "Contest", values: void} | {tag: "NextWaffleId", values: void} | {tag: "ActiveBake", values: readonly [string]} | {tag: "Waffle", values: readonly [u64]} | {tag: "OwnerWaffles", values: readonly [string]} | {tag: "Stats", values: readonly [string]};


/**
 * A baker's lifetime griddle record.
 */
export interface BakerStats {
  best_score: u32;
  burnt: u32;
  golden: u32;
}


export const GriddleError = {
  /**
   * Your iron already has batter in it. Patience.
   */
  1: {message:"IronBusy"},
  /**
   * Nothing is cooking. Start a bake first.
   */
  2: {message:"NothingCooking"},
  /**
   * More than three toppings and it's not a waffle, it's a casserole.
   */
  3: {message:"TooManyToppings"},
  /**
   * The pantry wouldn't hand over the goods (missing ingredients?).
   */
  4: {message:"PantryRefused"},
  /**
   * Claimed too early — give it a few more ledgers. The bake continues.
   */
  5: {message:"StillRaw"},
  /**
   * No waffle by that id.
   */
  6: {message:"WaffleNotFound"},
  /**
   * That waffle isn't yours to move.
   */
  7: {message:"NotYourWaffle"},
  /**
   * Only the Brunch Bash may pin ribbons on waffles.
   */
  8: {message:"ContestNotSet"}
}


/**
 * A one-of-a-kind waffle, lovingly griddled on-chain.
 */
export interface Waffle {
  /**
 * Ledger sequence the waffle came off the iron.
 */
baked_at: u32;
  /**
 * 0..=100. Burnt waffles are a perfect 100. Small consolation.
 */
crispiness: u32;
  /**
 * Sum of topping flavor points.
 */
flavor: u32;
  /**
 * 0..=100.
 */
fluffiness: u32;
  id: u64;
  owner: string;
  /**
 * Blue ribbons won at the Brunch Bash.
 */
ribbons: u32;
  /**
 * crispiness + fluffiness + flavor. What the brunch judges look at.
 */
score: u32;
  status: WaffleStatus;
  toppings: Array<Ingredient>;
}

/**
 * Everything you might find rummaging around the Pantry.
 * 
 * The first three are the holy trinity of batter. The rest are toppings,
 * ranked by how much the brunch judges swoon over them.
 */
export enum Ingredient {
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

/**
 * How a bake turned out.
 */
export enum WaffleStatus {
  Golden = 0,
  Burnt = 1,
}

export interface Client {
  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Lift the iron! Outcome depends entirely on how long you waited:
   * too early is a recoverable error (the bake continues), the golden
   * window mints a scored waffle, and dawdling mints... also a waffle,
   * in the way that a meteorite is also a rock.
   */
  claim: ({baker}: {baker: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Waffle>>>

  /**
   * Construct and simulate a stats_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  stats_of: ({baker}: {baker: string}, options?: MethodOptions) => Promise<AssembledTransaction<BakerStats>>

  /**
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gift a waffle to a fellow brunch enthusiast.
   */
  transfer: ({from, to, id}: {from: string, to: string, id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_waffle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_waffle: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Waffle>>>

  /**
   * Construct and simulate a start_bake transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pour the batter. Burns 1 flour + 1 egg + 1 butter from your pantry,
   * plus whatever toppings you dare. The clock starts now.
   */
  start_bake: ({baker, toppings}: {baker: string, toppings: Array<Ingredient>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a waffles_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  waffles_of: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a iron_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Peek at what's on a baker's iron (and how long it's been there).
   */
  iron_status: ({baker}: {baker: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Bake>>>

  /**
   * Construct and simulate a set_contest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin wiring: tell the griddle which contract runs the Brunch Bash.
   */
  set_contest: ({contest}: {contest: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a award_ribbon transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pin a blue ribbon on a winning waffle.
   * Only the Brunch Bash contract may call this.
   */
  award_ribbon: ({waffle_id}: {waffle_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, pantry}: {admin: string, pantry: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, pantry}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAABNBIGJha2UgaW4gcHJvZ3Jlc3MuAAAAAAAAAAAEQmFrZQAAAAIAAAAAAAAACnN0YXJ0ZWRfYXQAAAAAAAQAAAAAAAAACHRvcHBpbmdzAAAD6gAAB9AAAAAKSW5ncmVkaWVudAAA",
        "AAAAAAAAAPBMaWZ0IHRoZSBpcm9uISBPdXRjb21lIGRlcGVuZHMgZW50aXJlbHkgb24gaG93IGxvbmcgeW91IHdhaXRlZDoKdG9vIGVhcmx5IGlzIGEgcmVjb3ZlcmFibGUgZXJyb3IgKHRoZSBiYWtlIGNvbnRpbnVlcyksIHRoZSBnb2xkZW4Kd2luZG93IG1pbnRzIGEgc2NvcmVkIHdhZmZsZSwgYW5kIGRhd2RsaW5nIG1pbnRzLi4uIGFsc28gYSB3YWZmbGUsCmluIHRoZSB3YXkgdGhhdCBhIG1ldGVvcml0ZSBpcyBhbHNvIGEgcm9jay4AAAAFY2xhaW0AAAAAAAABAAAAAAAAAAViYWtlcgAAAAAAABMAAAABAAAD6QAAB9AAAAAGV2FmZmxlAAAAAAfQAAAADEdyaWRkbGVFcnJvcg==",
        "AAAABQAAABdBIHdhZmZsZSBjaGFuZ2VzIGhhbmRzLgAAAAAAAAAABkdpZnRlZAAAAAAAAQAAAAZnaWZ0ZWQAAAAAAAMAAAAAAAAABGZyb20AAAATAAAAAQAAAAAAAAACdG8AAAAAABMAAAABAAAAAAAAAAl3YWZmbGVfaWQAAAAAAAAGAAAAAAAAAAI=",
        "AAAABQAAABVCYXR0ZXIgaGl0cyB0aGUgaXJvbi4AAAAAAAAAAAAABlNpenpsZQAAAAAAAQAAAAZzaXp6bGUAAAAAAAIAAAAAAAAABWJha2VyAAAAAAAAEwAAAAEAAAAAAAAACnN0YXJ0ZWRfYXQAAAAAAAQAAAAAAAAAAg==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAGUGFudHJ5AAAAAAAAAAAAAAAAAAdDb250ZXN0AAAAAAAAAAAAAAAADE5leHRXYWZmbGVJZAAAAAEAAAAuVGhlIGJha2UgY3VycmVudGx5IHNpenpsaW5nIG9uIGEgYmFrZXIncyBpcm9uLgAAAAAACkFjdGl2ZUJha2UAAAAAAAEAAAATAAAAAQAAAAAAAAAGV2FmZmxlAAAAAAABAAAABgAAAAEAAAAAAAAADE93bmVyV2FmZmxlcwAAAAEAAAATAAAAAQAAAAAAAAAFU3RhdHMAAAAAAAABAAAAEw==",
        "AAAAAAAAAAAAAAAIc3RhdHNfb2YAAAABAAAAAAAAAAViYWtlcgAAAAAAABMAAAABAAAH0AAAAApCYWtlclN0YXRzAAA=",
        "AAAAAAAAACxHaWZ0IGEgd2FmZmxlIHRvIGEgZmVsbG93IGJydW5jaCBlbnRodXNpYXN0LgAAAAh0cmFuc2ZlcgAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAACaWQAAAAAAAYAAAABAAAD6QAAAAIAAAfQAAAADEdyaWRkbGVFcnJvcg==",
        "AAAAAQAAACJBIGJha2VyJ3MgbGlmZXRpbWUgZ3JpZGRsZSByZWNvcmQuAAAAAAAAAAAACkJha2VyU3RhdHMAAAAAAAMAAAAAAAAACmJlc3Rfc2NvcmUAAAAAAAQAAAAAAAAABWJ1cm50AAAAAAAABAAAAAAAAAAGZ29sZGVuAAAAAAAE",
        "AAAAAAAAAAAAAAAKZ2V0X3dhZmZsZQAAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6QAAB9AAAAAGV2FmZmxlAAAAAAfQAAAADEdyaWRkbGVFcnJvcg==",
        "AAAAAAAAAHpQb3VyIHRoZSBiYXR0ZXIuIEJ1cm5zIDEgZmxvdXIgKyAxIGVnZyArIDEgYnV0dGVyIGZyb20geW91ciBwYW50cnksCnBsdXMgd2hhdGV2ZXIgdG9wcGluZ3MgeW91IGRhcmUuIFRoZSBjbG9jayBzdGFydHMgbm93LgAAAAAACnN0YXJ0X2Jha2UAAAAAAAIAAAAAAAAABWJha2VyAAAAAAAAEwAAAAAAAAAIdG9wcGluZ3MAAAPqAAAH0AAAAApJbmdyZWRpZW50AAAAAAABAAAD6QAAAAIAAAfQAAAADEdyaWRkbGVFcnJvcg==",
        "AAAAAAAAAAAAAAAKd2FmZmxlc19vZgAAAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAA+oAAAAG",
        "AAAAAAAAAEBQZWVrIGF0IHdoYXQncyBvbiBhIGJha2VyJ3MgaXJvbiAoYW5kIGhvdyBsb25nIGl0J3MgYmVlbiB0aGVyZSkuAAAAC2lyb25fc3RhdHVzAAAAAAEAAAAAAAAABWJha2VyAAAAAAAAEwAAAAEAAAPoAAAH0AAAAARCYWtl",
        "AAAAAAAAAENBZG1pbiB3aXJpbmc6IHRlbGwgdGhlIGdyaWRkbGUgd2hpY2ggY29udHJhY3QgcnVucyB0aGUgQnJ1bmNoIEJhc2guAAAAAAtzZXRfY29udGVzdAAAAAABAAAAAAAAAAdjb250ZXN0AAAAABMAAAAA",
        "AAAABQAAADFBIHdhZmZsZSBjb21lcyBvZmYgdGhlIGlyb24sIGZvciBiZXR0ZXIgb3Igd29yc2UuAAAAAAAAAAAAAAtXYWZmbGVSZWFkeQAAAAABAAAADHdhZmZsZV9yZWFkeQAAAAQAAAAAAAAABWJha2VyAAAAAAAAEwAAAAEAAAAAAAAACXdhZmZsZV9pZAAAAAAAAAYAAAABAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMV2FmZmxlU3RhdHVzAAAAAAAAAAAAAAAFc2NvcmUAAAAAAAAEAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAADEdyaWRkbGVFcnJvcgAAAAgAAAAtWW91ciBpcm9uIGFscmVhZHkgaGFzIGJhdHRlciBpbiBpdC4gUGF0aWVuY2UuAAAAAAAACElyb25CdXN5AAAAAQAAACdOb3RoaW5nIGlzIGNvb2tpbmcuIFN0YXJ0IGEgYmFrZSBmaXJzdC4AAAAADk5vdGhpbmdDb29raW5nAAAAAAACAAAAQU1vcmUgdGhhbiB0aHJlZSB0b3BwaW5ncyBhbmQgaXQncyBub3QgYSB3YWZmbGUsIGl0J3MgYSBjYXNzZXJvbGUuAAAAAAAAD1Rvb01hbnlUb3BwaW5ncwAAAAADAAAAP1RoZSBwYW50cnkgd291bGRuJ3QgaGFuZCBvdmVyIHRoZSBnb29kcyAobWlzc2luZyBpbmdyZWRpZW50cz8pLgAAAAANUGFudHJ5UmVmdXNlZAAAAAAAAAQAAABFQ2xhaW1lZCB0b28gZWFybHkg4oCUIGdpdmUgaXQgYSBmZXcgbW9yZSBsZWRnZXJzLiBUaGUgYmFrZSBjb250aW51ZXMuAAAAAAAACFN0aWxsUmF3AAAABQAAABVObyB3YWZmbGUgYnkgdGhhdCBpZC4AAAAAAAAOV2FmZmxlTm90Rm91bmQAAAAAAAYAAAAgVGhhdCB3YWZmbGUgaXNuJ3QgeW91cnMgdG8gbW92ZS4AAAANTm90WW91cldhZmZsZQAAAAAAAAcAAAAwT25seSB0aGUgQnJ1bmNoIEJhc2ggbWF5IHBpbiByaWJib25zIG9uIHdhZmZsZXMuAAAADUNvbnRlc3ROb3RTZXQAAAAAAAAI",
        "AAAAAAAAAFNQaW4gYSBibHVlIHJpYmJvbiBvbiBhIHdpbm5pbmcgd2FmZmxlLgpPbmx5IHRoZSBCcnVuY2ggQmFzaCBjb250cmFjdCBtYXkgY2FsbCB0aGlzLgAAAAAMYXdhcmRfcmliYm9uAAAAAQAAAAAAAAAJd2FmZmxlX2lkAAAAAAAABgAAAAEAAAPpAAAAAgAAB9AAAAAMR3JpZGRsZUVycm9y",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGcGFudHJ5AAAAAAATAAAAAA==",
        "AAAAAQAAADNBIG9uZS1vZi1hLWtpbmQgd2FmZmxlLCBsb3ZpbmdseSBncmlkZGxlZCBvbi1jaGFpbi4AAAAAAAAAAAZXYWZmbGUAAAAAAAoAAAAtTGVkZ2VyIHNlcXVlbmNlIHRoZSB3YWZmbGUgY2FtZSBvZmYgdGhlIGlyb24uAAAAAAAACGJha2VkX2F0AAAABAAAADwwLi49MTAwLiBCdXJudCB3YWZmbGVzIGFyZSBhIHBlcmZlY3QgMTAwLiBTbWFsbCBjb25zb2xhdGlvbi4AAAAKY3Jpc3BpbmVzcwAAAAAABAAAAB1TdW0gb2YgdG9wcGluZyBmbGF2b3IgcG9pbnRzLgAAAAAAAAZmbGF2b3IAAAAAAAQAAAAIMC4uPTEwMC4AAAAKZmx1ZmZpbmVzcwAAAAAABAAAAAAAAAACaWQAAAAAAAYAAAAAAAAABW93bmVyAAAAAAAAEwAAACRCbHVlIHJpYmJvbnMgd29uIGF0IHRoZSBCcnVuY2ggQmFzaC4AAAAHcmliYm9ucwAAAAAEAAAAQWNyaXNwaW5lc3MgKyBmbHVmZmluZXNzICsgZmxhdm9yLiBXaGF0IHRoZSBicnVuY2gganVkZ2VzIGxvb2sgYXQuAAAAAAAABXNjb3JlAAAAAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADFdhZmZsZVN0YXR1cwAAAAAAAAAIdG9wcGluZ3MAAAPqAAAH0AAAAApJbmdyZWRpZW50AAA=",
        "AAAAAwAAALRFdmVyeXRoaW5nIHlvdSBtaWdodCBmaW5kIHJ1bW1hZ2luZyBhcm91bmQgdGhlIFBhbnRyeS4KClRoZSBmaXJzdCB0aHJlZSBhcmUgdGhlIGhvbHkgdHJpbml0eSBvZiBiYXR0ZXIuIFRoZSByZXN0IGFyZSB0b3BwaW5ncywKcmFua2VkIGJ5IGhvdyBtdWNoIHRoZSBicnVuY2gganVkZ2VzIHN3b29uIG92ZXIgdGhlbS4AAAAAAAAACkluZ3JlZGllbnQAAAAAAAoAAAAAAAAABUZsb3VyAAAAAAAAAAAAAAAAAAADRWdnAAAAAAEAAAAAAAAABkJ1dHRlcgAAAAAAAgAAAAAAAAAETWlsawAAAAMAAAAAAAAABVN1Z2FyAAAAAAAABAAAAAAAAAAJQmx1ZWJlcnJ5AAAAAAAABQAAAAAAAAAJQ2hvY29sYXRlAAAAAAAABgAAAAAAAAAGQmFuYW5hAAAAAAAHAAAAAAAAAAVCYWNvbgAAAAAAAAgAAAAAAAAACEdvbGRMZWFmAAAACQ==",
        "AAAAAwAAABZIb3cgYSBiYWtlIHR1cm5lZCBvdXQuAAAAAAAAAAAADFdhZmZsZVN0YXR1cwAAAAIAAAA0Q2xhaW1lZCBpbnNpZGUgdGhlIGdvbGRlbiB3aW5kb3cuIEEgdGhpbmcgb2YgYmVhdXR5LgAAAAZHb2xkZW4AAAAAAAAAAABJTGVmdCBvbiB0aGUgaXJvbiB0b28gbG9uZy4gVGVjaG5pY2FsbHkgc3RpbGwgYSB3YWZmbGUuIExlZ2FsbHksIGNoYXJjb2FsLgAAAAAAAAVCdXJudAAAAAAAAAE=" ]),
      options
    )
  }
  public readonly fromJSON = {
    claim: this.txFromJSON<Result<Waffle>>,
        stats_of: this.txFromJSON<BakerStats>,
        transfer: this.txFromJSON<Result<void>>,
        get_waffle: this.txFromJSON<Result<Waffle>>,
        start_bake: this.txFromJSON<Result<void>>,
        waffles_of: this.txFromJSON<Array<u64>>,
        iron_status: this.txFromJSON<Option<Bake>>,
        set_contest: this.txFromJSON<null>,
        award_ribbon: this.txFromJSON<Result<void>>
  }
}
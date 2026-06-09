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
    contractId: "CBTWOYSSPXUJOXERFDNJ4ICMPWRGJVRZKPUUVQ64LOOHFA5RHE5MAYVJ",
  }
} as const

export type DataKey = {tag: "Admin", values: void} | {tag: "Griddle", values: void} | {tag: "Shelf", values: readonly [string]} | {tag: "LastForage", values: readonly [string]} | {tag: "Welcomed", values: readonly [string]};


export const PantryError = {
  /**
   * The pantry gremlins are still restocking. Come back in a few ledgers.
   */
  1: {message:"StillRestocking"},
  /**
   * You can't bake with ingredients you don't have.
   */
  2: {message:"NotEnoughIngredients"},
  /**
   * The admin hasn't told the pantry where the Griddle lives yet.
   */
  3: {message:"GriddleNotSet"}
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
   * Construct and simulate a shelf transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The baker's whole shelf at a glance.
   */
  shelf: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<Map<Ingredient, u32>>>

  /**
   * Construct and simulate a forage transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rummage through the pantry for random ingredients.
   * 
   * First-time foragers also receive a welcome basket (flour, egg, butter)
   * so they can fire up the griddle right away. Repeat visits are limited
   * by [`FORAGE_COOLDOWN_LEDGERS`].
   */
  forage: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<Ingredient>>>>

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * How many of one ingredient a baker holds.
   */
  balance: ({who, item}: {who: string, item: Ingredient}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a consume transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pull ingredients off the shelves to feed the waffle iron.
   * Only the Griddle contract may call this.
   */
  consume: ({who, items}: {who: string, items: Array<Ingredient>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_griddle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin wiring: tell the pantry which contract is the Griddle.
   */
  set_griddle: ({griddle}: {griddle: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a forage_ready_in transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Ledgers until `who` can forage again (0 = ready now).
   */
  forage_ready_in: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin}: {admin: string},
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
    return ContractClient.deploy({admin}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAACRUaGUgYmFrZXIncyB3aG9sZSBzaGVsZiBhdCBhIGdsYW5jZS4AAAAFc2hlbGYAAAAAAAABAAAAAAAAAAN3aG8AAAAAEwAAAAEAAAPsAAAH0AAAAApJbmdyZWRpZW50AAAAAAAE",
        "AAAAAAAAAOBSdW1tYWdlIHRocm91Z2ggdGhlIHBhbnRyeSBmb3IgcmFuZG9tIGluZ3JlZGllbnRzLgoKRmlyc3QtdGltZSBmb3JhZ2VycyBhbHNvIHJlY2VpdmUgYSB3ZWxjb21lIGJhc2tldCAoZmxvdXIsIGVnZywgYnV0dGVyKQpzbyB0aGV5IGNhbiBmaXJlIHVwIHRoZSBncmlkZGxlIHJpZ2h0IGF3YXkuIFJlcGVhdCB2aXNpdHMgYXJlIGxpbWl0ZWQKYnkgW2BGT1JBR0VfQ09PTERPV05fTEVER0VSU2BdLgAAAAZmb3JhZ2UAAAAAAAEAAAAAAAAAA3dobwAAAAATAAAAAQAAA+kAAAPqAAAH0AAAAApJbmdyZWRpZW50AAAAAAfQAAAAC1BhbnRyeUVycm9yAA==",
        "AAAAAAAAAClIb3cgbWFueSBvZiBvbmUgaW5ncmVkaWVudCBhIGJha2VyIGhvbGRzLgAAAAAAAAdiYWxhbmNlAAAAAAIAAAAAAAAAA3dobwAAAAATAAAAAAAAAARpdGVtAAAH0AAAAApJbmdyZWRpZW50AAAAAAABAAAABA==",
        "AAAAAAAAAGJQdWxsIGluZ3JlZGllbnRzIG9mZiB0aGUgc2hlbHZlcyB0byBmZWVkIHRoZSB3YWZmbGUgaXJvbi4KT25seSB0aGUgR3JpZGRsZSBjb250cmFjdCBtYXkgY2FsbCB0aGlzLgAAAAAAB2NvbnN1bWUAAAAAAgAAAAAAAAADd2hvAAAAABMAAAAAAAAABWl0ZW1zAAAAAAAD6gAAB9AAAAAKSW5ncmVkaWVudAAAAAAAAQAAA+kAAAACAAAH0AAAAAtQYW50cnlFcnJvcgA=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAHR3JpZGRsZQAAAAABAAAAiFRoZSBiYWtlcidzIHdob2xlIHNoZWxmOiBpbmdyZWRpZW50IC0+IGNvdW50LiBLZXB0IGFzIG9uZSBtYXAgdW5kZXIKb25lIGtleSBzbyB0aGUgd3JpdGUgZm9vdHByaW50IG5ldmVyIGRlcGVuZHMgb24gd2hhdCB0aGUgUFJORyBkcm9wcy4AAAAFU2hlbGYAAAAAAAABAAAAEwAAAAEAAAArTGVkZ2VyIHNlcXVlbmNlIG9mIHRoZSBiYWtlcidzIGxhc3QgZm9yYWdlLgAAAAAKTGFzdEZvcmFnZQAAAAAAAQAAABMAAAABAAAAOFdoZXRoZXIgdGhlIGJha2VyIGFscmVhZHkgcmVjZWl2ZWQgdGhlaXIgd2VsY29tZSBiYXNrZXQuAAAACFdlbGNvbWVkAAAAAQAAABM=",
        "AAAABQAAADJQdWJsaXNoZWQgZXZlcnkgdGltZSBhIGJha2VyIHJ1bW1hZ2VzIHRoZSBzaGVsdmVzLgAAAAAAAAAAAAdGb3JhZ2VkAAAAAAEAAAAHZm9yYWdlZAAAAAACAAAAAAAAAAN3aG8AAAAAEwAAAAEAAAAAAAAABWZvdW5kAAAAAAAD6gAAB9AAAAAKSW5ncmVkaWVudAAAAAAAAAAAAAI=",
        "AAAAAAAAADxBZG1pbiB3aXJpbmc6IHRlbGwgdGhlIHBhbnRyeSB3aGljaCBjb250cmFjdCBpcyB0aGUgR3JpZGRsZS4AAAALc2V0X2dyaWRkbGUAAAAAAQAAAAAAAAAHZ3JpZGRsZQAAAAATAAAAAA==",
        "AAAABAAAAAAAAAAAAAAAC1BhbnRyeUVycm9yAAAAAAMAAABFVGhlIHBhbnRyeSBncmVtbGlucyBhcmUgc3RpbGwgcmVzdG9ja2luZy4gQ29tZSBiYWNrIGluIGEgZmV3IGxlZGdlcnMuAAAAAAAAD1N0aWxsUmVzdG9ja2luZwAAAAABAAAAL1lvdSBjYW4ndCBiYWtlIHdpdGggaW5ncmVkaWVudHMgeW91IGRvbid0IGhhdmUuAAAAABROb3RFbm91Z2hJbmdyZWRpZW50cwAAAAIAAAA9VGhlIGFkbWluIGhhc24ndCB0b2xkIHRoZSBwYW50cnkgd2hlcmUgdGhlIEdyaWRkbGUgbGl2ZXMgeWV0LgAAAAAAAA1HcmlkZGxlTm90U2V0AAAAAAAAAw==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAADVMZWRnZXJzIHVudGlsIGB3aG9gIGNhbiBmb3JhZ2UgYWdhaW4gKDAgPSByZWFkeSBub3cpLgAAAAAAAA9mb3JhZ2VfcmVhZHlfaW4AAAAAAQAAAAAAAAADd2hvAAAAABMAAAABAAAABA==",
        "AAAAAQAAADNBIG9uZS1vZi1hLWtpbmQgd2FmZmxlLCBsb3ZpbmdseSBncmlkZGxlZCBvbi1jaGFpbi4AAAAAAAAAAAZXYWZmbGUAAAAAAAoAAAAtTGVkZ2VyIHNlcXVlbmNlIHRoZSB3YWZmbGUgY2FtZSBvZmYgdGhlIGlyb24uAAAAAAAACGJha2VkX2F0AAAABAAAADwwLi49MTAwLiBCdXJudCB3YWZmbGVzIGFyZSBhIHBlcmZlY3QgMTAwLiBTbWFsbCBjb25zb2xhdGlvbi4AAAAKY3Jpc3BpbmVzcwAAAAAABAAAAB1TdW0gb2YgdG9wcGluZyBmbGF2b3IgcG9pbnRzLgAAAAAAAAZmbGF2b3IAAAAAAAQAAAAIMC4uPTEwMC4AAAAKZmx1ZmZpbmVzcwAAAAAABAAAAAAAAAACaWQAAAAAAAYAAAAAAAAABW93bmVyAAAAAAAAEwAAACRCbHVlIHJpYmJvbnMgd29uIGF0IHRoZSBCcnVuY2ggQmFzaC4AAAAHcmliYm9ucwAAAAAEAAAAQWNyaXNwaW5lc3MgKyBmbHVmZmluZXNzICsgZmxhdm9yLiBXaGF0IHRoZSBicnVuY2gganVkZ2VzIGxvb2sgYXQuAAAAAAAABXNjb3JlAAAAAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADFdhZmZsZVN0YXR1cwAAAAAAAAAIdG9wcGluZ3MAAAPqAAAH0AAAAApJbmdyZWRpZW50AAA=",
        "AAAAAwAAALRFdmVyeXRoaW5nIHlvdSBtaWdodCBmaW5kIHJ1bW1hZ2luZyBhcm91bmQgdGhlIFBhbnRyeS4KClRoZSBmaXJzdCB0aHJlZSBhcmUgdGhlIGhvbHkgdHJpbml0eSBvZiBiYXR0ZXIuIFRoZSByZXN0IGFyZSB0b3BwaW5ncywKcmFua2VkIGJ5IGhvdyBtdWNoIHRoZSBicnVuY2gganVkZ2VzIHN3b29uIG92ZXIgdGhlbS4AAAAAAAAACkluZ3JlZGllbnQAAAAAAAoAAAAAAAAABUZsb3VyAAAAAAAAAAAAAAAAAAADRWdnAAAAAAEAAAAAAAAABkJ1dHRlcgAAAAAAAgAAAAAAAAAETWlsawAAAAMAAAAAAAAABVN1Z2FyAAAAAAAABAAAAAAAAAAJQmx1ZWJlcnJ5AAAAAAAABQAAAAAAAAAJQ2hvY29sYXRlAAAAAAAABgAAAAAAAAAGQmFuYW5hAAAAAAAHAAAAAAAAAAVCYWNvbgAAAAAAAAgAAAAAAAAACEdvbGRMZWFmAAAACQ==",
        "AAAAAwAAABZIb3cgYSBiYWtlIHR1cm5lZCBvdXQuAAAAAAAAAAAADFdhZmZsZVN0YXR1cwAAAAIAAAA0Q2xhaW1lZCBpbnNpZGUgdGhlIGdvbGRlbiB3aW5kb3cuIEEgdGhpbmcgb2YgYmVhdXR5LgAAAAZHb2xkZW4AAAAAAAAAAABJTGVmdCBvbiB0aGUgaXJvbiB0b28gbG9uZy4gVGVjaG5pY2FsbHkgc3RpbGwgYSB3YWZmbGUuIExlZ2FsbHksIGNoYXJjb2FsLgAAAAAAAAVCdXJudAAAAAAAAAE=" ]),
      options
    )
  }
  public readonly fromJSON = {
    shelf: this.txFromJSON<Map<Ingredient, u32>>,
        forage: this.txFromJSON<Result<Array<Ingredient>>>,
        balance: this.txFromJSON<u32>,
        consume: this.txFromJSON<Result<void>>,
        set_griddle: this.txFromJSON<null>,
        forage_ready_in: this.txFromJSON<u32>
  }
}
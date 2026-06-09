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
    contractId: "CDQKUS47VA66YQS2IZTZ7VCTBSW44DOY22VLEPFDOFH3Y4G5I55J6TD5",
  }
} as const


/**
 * One waffle at the judging table.
 */
export interface Entry {
  baker: string;
  score: u32;
  waffle_id: u64;
}


/**
 * An open competition round.
 */
export interface Round {
  /**
 * Last ledger (exclusive) on which entries are accepted.
 */
closes_at: u32;
  host: string;
  id: u32;
  pot: i128;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Griddle", values: void} | {tag: "Token", values: void} | {tag: "NextRoundId", values: void} | {tag: "CurrentRound", values: void} | {tag: "Entries", values: readonly [u32]} | {tag: "Result", values: readonly [u32]} | {tag: "Trophies", values: readonly [string]};

export const BashError = {
  /**
   * A round is already underway — enter that one!
   */
  1: {message:"RoundInProgress"},
  /**
   * No round is open right now. Host one!
   */
  2: {message:"NoOpenRound"},
  /**
   * Entries have closed for this round.
   */
  3: {message:"EntriesClosed"},
  /**
   * The judges are still waiting for the entry window to close.
   */
  4: {message:"JudgingTooSoon"},
  /**
   * That waffle already has a seat at this round's table.
   */
  5: {message:"AlreadyEntered"},
  /**
   * You can only enter waffles you own.
   */
  6: {message:"NotYourWaffle"},
  /**
   * The judges politely decline to taste charcoal.
   */
  7: {message:"JudgesDeclineCharcoal"},
  /**
   * Round duration outside the allowed bounds.
   */
  8: {message:"BadDuration"},
  /**
   * No round by that id has been settled.
   */
  9: {message:"NoSuchResult"},
  /**
   * The champion already collected this pot.
   */
  10: {message:"AlreadyPaid"}
}


/**
 * The official record of a settled round.
 */
export interface RoundResult {
  champion: string;
  entries: u32;
  /**
 * Whether the pot has been collected (see [`BrunchBash::collect_pot`]).
 */
paid: boolean;
  pot: i128;
  round_id: u32;
  winning_waffle: u64;
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
   * Construct and simulate a enter transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Bring your waffle to the table. Costs [`ENTRY_FEE`] into the pot.
   * Burnt waffles are turned away at the door.
   */
  enter: ({baker, waffle_id}: {baker: string, waffle_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a judge transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Summon the judges. Callable by anyone once entries close.
   * 
   * Each entry rolls `score + prng(0..=JUDGE_WHIMSY)`; highest roll is
   * crowned champion. A round with no entries simply ends — the judges
   * eat toast and go home.
   * 
   * The verdict is recorded here; the pot changes hands in
   * [`Self::collect_pot`]. (Two phases keep every storage key this call
   * touches independent of the PRNG, so simulation footprints hold.)
   */
  judge: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Option<RoundResult>>>>

  /**
   * Construct and simulate a result transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The official record of a settled round.
   */
  result: ({round_id}: {round_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<RoundResult>>>

  /**
   * Construct and simulate a entries transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Entries at the current (or any past, if unsettled) round's table.
   */
  entries: ({round_id}: {round_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Entry>>>

  /**
   * Construct and simulate a trophies transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Golden Spatula count: rounds won by this baker.
   */
  trophies: ({baker}: {baker: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a open_round transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Throw a brunch! Anyone can host. Entries stay open for `duration`
   * ledgers, then anyone may call [`judge`].
   */
  open_round: ({host, duration}: {host: string, duration: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a collect_pot transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The podium ceremony: pay the recorded champion, pin the ribbon, and
   * add a golden spatula to their trophy shelf. Callable by anyone, once.
   */
  collect_pot: ({round_id}: {round_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<RoundResult>>>

  /**
   * Construct and simulate a current_round transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The round currently accepting entries, if any.
   */
  current_round: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Round>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, griddle, token}: {admin: string, griddle: string, token: string},
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
    return ContractClient.deploy({admin, griddle, token}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAACBPbmUgd2FmZmxlIGF0IHRoZSBqdWRnaW5nIHRhYmxlLgAAAAAAAAAFRW50cnkAAAAAAAADAAAAAAAAAAViYWtlcgAAAAAAABMAAAAAAAAABXNjb3JlAAAAAAAABAAAAAAAAAAJd2FmZmxlX2lkAAAAAAAABg==",
        "AAAAAQAAABpBbiBvcGVuIGNvbXBldGl0aW9uIHJvdW5kLgAAAAAAAAAAAAVSb3VuZAAAAAAAAAQAAAA2TGFzdCBsZWRnZXIgKGV4Y2x1c2l2ZSkgb24gd2hpY2ggZW50cmllcyBhcmUgYWNjZXB0ZWQuAAAAAAAJY2xvc2VzX2F0AAAAAAAABAAAAAAAAAAEaG9zdAAAABMAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAANwb3QAAAAACw==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAHR3JpZGRsZQAAAAAAAAAAAAAAAAVUb2tlbgAAAAAAAAAAAAAAAAAAC05leHRSb3VuZElkAAAAAAAAAAAhVGhlIGN1cnJlbnRseS1vcGVuIHJvdW5kLCBpZiBhbnkuAAAAAAAADEN1cnJlbnRSb3VuZAAAAAEAAAAAAAAAB0VudHJpZXMAAAAAAQAAAAQAAAABAAAAAAAAAAZSZXN1bHQAAAAAAAEAAAAEAAAAAQAAAAAAAAAIVHJvcGhpZXMAAAABAAAAEw==",
        "AAAAAAAAAGxCcmluZyB5b3VyIHdhZmZsZSB0byB0aGUgdGFibGUuIENvc3RzIFtgRU5UUllfRkVFYF0gaW50byB0aGUgcG90LgpCdXJudCB3YWZmbGVzIGFyZSB0dXJuZWQgYXdheSBhdCB0aGUgZG9vci4AAAAFZW50ZXIAAAAAAAACAAAAAAAAAAViYWtlcgAAAAAAABMAAAAAAAAACXdhZmZsZV9pZAAAAAAAAAYAAAABAAAD6QAAAAIAAAfQAAAACUJhc2hFcnJvcgAAAA==",
        "AAAAAAAAAZZTdW1tb24gdGhlIGp1ZGdlcy4gQ2FsbGFibGUgYnkgYW55b25lIG9uY2UgZW50cmllcyBjbG9zZS4KCkVhY2ggZW50cnkgcm9sbHMgYHNjb3JlICsgcHJuZygwLi49SlVER0VfV0hJTVNZKWA7IGhpZ2hlc3Qgcm9sbCBpcwpjcm93bmVkIGNoYW1waW9uLiBBIHJvdW5kIHdpdGggbm8gZW50cmllcyBzaW1wbHkgZW5kcyDigJQgdGhlIGp1ZGdlcwplYXQgdG9hc3QgYW5kIGdvIGhvbWUuCgpUaGUgdmVyZGljdCBpcyByZWNvcmRlZCBoZXJlOyB0aGUgcG90IGNoYW5nZXMgaGFuZHMgaW4KW2BTZWxmOjpjb2xsZWN0X3BvdGBdLiAoVHdvIHBoYXNlcyBrZWVwIGV2ZXJ5IHN0b3JhZ2Uga2V5IHRoaXMgY2FsbAp0b3VjaGVzIGluZGVwZW5kZW50IG9mIHRoZSBQUk5HLCBzbyBzaW11bGF0aW9uIGZvb3RwcmludHMgaG9sZC4pAAAAAAAFanVkZ2UAAAAAAAAAAAAAAQAAA+kAAAPoAAAH0AAAAAtSb3VuZFJlc3VsdAAAAAfQAAAACUJhc2hFcnJvcgAAAA==",
        "AAAABAAAAAAAAAAAAAAACUJhc2hFcnJvcgAAAAAAAAoAAAAvQSByb3VuZCBpcyBhbHJlYWR5IHVuZGVyd2F5IOKAlCBlbnRlciB0aGF0IG9uZSEAAAAAD1JvdW5kSW5Qcm9ncmVzcwAAAAABAAAAJU5vIHJvdW5kIGlzIG9wZW4gcmlnaHQgbm93LiBIb3N0IG9uZSEAAAAAAAALTm9PcGVuUm91bmQAAAAAAgAAACNFbnRyaWVzIGhhdmUgY2xvc2VkIGZvciB0aGlzIHJvdW5kLgAAAAANRW50cmllc0Nsb3NlZAAAAAAAAAMAAAA7VGhlIGp1ZGdlcyBhcmUgc3RpbGwgd2FpdGluZyBmb3IgdGhlIGVudHJ5IHdpbmRvdyB0byBjbG9zZS4AAAAADkp1ZGdpbmdUb29Tb29uAAAAAAAEAAAANVRoYXQgd2FmZmxlIGFscmVhZHkgaGFzIGEgc2VhdCBhdCB0aGlzIHJvdW5kJ3MgdGFibGUuAAAAAAAADkFscmVhZHlFbnRlcmVkAAAAAAAFAAAAI1lvdSBjYW4gb25seSBlbnRlciB3YWZmbGVzIHlvdSBvd24uAAAAAA1Ob3RZb3VyV2FmZmxlAAAAAAAABgAAAC5UaGUganVkZ2VzIHBvbGl0ZWx5IGRlY2xpbmUgdG8gdGFzdGUgY2hhcmNvYWwuAAAAAAAVSnVkZ2VzRGVjbGluZUNoYXJjb2FsAAAAAAAABwAAACpSb3VuZCBkdXJhdGlvbiBvdXRzaWRlIHRoZSBhbGxvd2VkIGJvdW5kcy4AAAAAAAtCYWREdXJhdGlvbgAAAAAIAAAAJU5vIHJvdW5kIGJ5IHRoYXQgaWQgaGFzIGJlZW4gc2V0dGxlZC4AAAAAAAAMTm9TdWNoUmVzdWx0AAAACQAAAChUaGUgY2hhbXBpb24gYWxyZWFkeSBjb2xsZWN0ZWQgdGhpcyBwb3QuAAAAC0FscmVhZHlQYWlkAAAAAAo=",
        "AAAAAAAAACdUaGUgb2ZmaWNpYWwgcmVjb3JkIG9mIGEgc2V0dGxlZCByb3VuZC4AAAAABnJlc3VsdAAAAAAAAQAAAAAAAAAIcm91bmRfaWQAAAAEAAAAAQAAA+kAAAfQAAAAC1JvdW5kUmVzdWx0AAAAB9AAAAAJQmFzaEVycm9yAAAA",
        "AAAAAAAAAEFFbnRyaWVzIGF0IHRoZSBjdXJyZW50IChvciBhbnkgcGFzdCwgaWYgdW5zZXR0bGVkKSByb3VuZCdzIHRhYmxlLgAAAAAAAAdlbnRyaWVzAAAAAAEAAAAAAAAACHJvdW5kX2lkAAAABAAAAAEAAAPqAAAH0AAAAAVFbnRyeQAAAA==",
        "AAAAAQAAACdUaGUgb2ZmaWNpYWwgcmVjb3JkIG9mIGEgc2V0dGxlZCByb3VuZC4AAAAAAAAAAAtSb3VuZFJlc3VsdAAAAAAGAAAAAAAAAAhjaGFtcGlvbgAAABMAAAAAAAAAB2VudHJpZXMAAAAABAAAAEVXaGV0aGVyIHRoZSBwb3QgaGFzIGJlZW4gY29sbGVjdGVkIChzZWUgW2BCcnVuY2hCYXNoOjpjb2xsZWN0X3BvdGBdKS4AAAAAAAAEcGFpZAAAAAEAAAAAAAAAA3BvdAAAAAALAAAAAAAAAAhyb3VuZF9pZAAAAAQAAAAAAAAADndpbm5pbmdfd2FmZmxlAAAAAAAG",
        "AAAAAAAAAC9Hb2xkZW4gU3BhdHVsYSBjb3VudDogcm91bmRzIHdvbiBieSB0aGlzIGJha2VyLgAAAAAIdHJvcGhpZXMAAAABAAAAAAAAAAViYWtlcgAAAAAAABMAAAABAAAABA==",
        "AAAABQAAABlTb21lb25lJ3MgaG9zdGluZyBicnVuY2ghAAAAAAAAAAAAAAxCcnVuY2hPcGVuZWQAAAABAAAADWJydW5jaF9vcGVuZWQAAAAAAAADAAAAAAAAAARob3N0AAAAEwAAAAEAAAAAAAAACHJvdW5kX2lkAAAABAAAAAAAAAAAAAAACWNsb3Nlc19hdAAAAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAAClUaGUgY2hhbXBpb24gaGFzIGJlZW4gcGFpZCBhbmQgZGVjb3JhdGVkLgAAAAAAAAAAAAAMUG90Q29sbGVjdGVkAAAAAQAAAA1wb3RfY29sbGVjdGVkAAAAAAAAAwAAAAAAAAAIY2hhbXBpb24AAAATAAAAAQAAAAAAAAAIcm91bmRfaWQAAAAEAAAAAAAAAAAAAAADcG90AAAAAAsAAAAAAAAAAg==",
        "AAAAAAAAAGpUaHJvdyBhIGJydW5jaCEgQW55b25lIGNhbiBob3N0LiBFbnRyaWVzIHN0YXkgb3BlbiBmb3IgYGR1cmF0aW9uYApsZWRnZXJzLCB0aGVuIGFueW9uZSBtYXkgY2FsbCBbYGp1ZGdlYF0uAAAAAAAKb3Blbl9yb3VuZAAAAAAAAgAAAAAAAAAEaG9zdAAAABMAAAAAAAAACGR1cmF0aW9uAAAABAAAAAEAAAPpAAAABAAAB9AAAAAJQmFzaEVycm9yAAAA",
        "AAAABQAAAC1BIHdhZmZsZSB0YWtlcyBpdHMgc2VhdCBhdCB0aGUganVkZ2luZyB0YWJsZS4AAAAAAAAAAAAADVdhZmZsZUVudGVyZWQAAAAAAAABAAAADndhZmZsZV9lbnRlcmVkAAAAAAADAAAAAAAAAAViYWtlcgAAAAAAABMAAAABAAAAAAAAAAhyb3VuZF9pZAAAAAQAAAAAAAAAAAAAAAl3YWZmbGVfaWQAAAAAAAAGAAAAAAAAAAI=",
        "AAAAAAAAAIlUaGUgcG9kaXVtIGNlcmVtb255OiBwYXkgdGhlIHJlY29yZGVkIGNoYW1waW9uLCBwaW4gdGhlIHJpYmJvbiwgYW5kCmFkZCBhIGdvbGRlbiBzcGF0dWxhIHRvIHRoZWlyIHRyb3BoeSBzaGVsZi4gQ2FsbGFibGUgYnkgYW55b25lLCBvbmNlLgAAAAAAAAtjb2xsZWN0X3BvdAAAAAABAAAAAAAAAAhyb3VuZF9pZAAAAAQAAAABAAAD6QAAB9AAAAALUm91bmRSZXN1bHQAAAAH0AAAAAlCYXNoRXJyb3IAAAA=",
        "AAAABQAAAEBSb3VuZCBlbmRlZCB3aXRoIG5vIGVudHJpZXM7IHRoZSBqdWRnZXMgYXRlIHRvYXN0IGFuZCB3ZW50IGhvbWUuAAAAAAAAAA5KdWRnZXNBdGVUb2FzdAAAAAAAAQAAABBqdWRnZXNfYXRlX3RvYXN0AAAAAQAAAAAAAAAIcm91bmRfaWQAAAAEAAAAAAAAAAI=",
        "AAAABQAAAEpBIGNoYW1waW9uIGlzIGNyb3duZWQuIChUaGUgcG90IGlzIHBhaWQgb3V0IGluIHRoZSBjZXJlbW9ueSB0aGF0IGZvbGxvd3MuKQAAAAAAAAAAAA9DaGFtcGlvbkNyb3duZWQAAAAAAQAAABBjaGFtcGlvbl9jcm93bmVkAAAABAAAAAAAAAAIY2hhbXBpb24AAAATAAAAAQAAAAAAAAAIcm91bmRfaWQAAAAEAAAAAAAAAAAAAAAJd2FmZmxlX2lkAAAAAAAABgAAAAAAAAAAAAAAA3BvdAAAAAALAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAHZ3JpZGRsZQAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAA",
        "AAAAAAAAAC5UaGUgcm91bmQgY3VycmVudGx5IGFjY2VwdGluZyBlbnRyaWVzLCBpZiBhbnkuAAAAAAANY3VycmVudF9yb3VuZAAAAAAAAAAAAAABAAAD6AAAB9AAAAAFUm91bmQAAAA=",
        "AAAAAQAAADNBIG9uZS1vZi1hLWtpbmQgd2FmZmxlLCBsb3ZpbmdseSBncmlkZGxlZCBvbi1jaGFpbi4AAAAAAAAAAAZXYWZmbGUAAAAAAAoAAAAtTGVkZ2VyIHNlcXVlbmNlIHRoZSB3YWZmbGUgY2FtZSBvZmYgdGhlIGlyb24uAAAAAAAACGJha2VkX2F0AAAABAAAADwwLi49MTAwLiBCdXJudCB3YWZmbGVzIGFyZSBhIHBlcmZlY3QgMTAwLiBTbWFsbCBjb25zb2xhdGlvbi4AAAAKY3Jpc3BpbmVzcwAAAAAABAAAAB1TdW0gb2YgdG9wcGluZyBmbGF2b3IgcG9pbnRzLgAAAAAAAAZmbGF2b3IAAAAAAAQAAAAIMC4uPTEwMC4AAAAKZmx1ZmZpbmVzcwAAAAAABAAAAAAAAAACaWQAAAAAAAYAAAAAAAAABW93bmVyAAAAAAAAEwAAACRCbHVlIHJpYmJvbnMgd29uIGF0IHRoZSBCcnVuY2ggQmFzaC4AAAAHcmliYm9ucwAAAAAEAAAAQWNyaXNwaW5lc3MgKyBmbHVmZmluZXNzICsgZmxhdm9yLiBXaGF0IHRoZSBicnVuY2gganVkZ2VzIGxvb2sgYXQuAAAAAAAABXNjb3JlAAAAAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADFdhZmZsZVN0YXR1cwAAAAAAAAAIdG9wcGluZ3MAAAPqAAAH0AAAAApJbmdyZWRpZW50AAA=",
        "AAAAAwAAALRFdmVyeXRoaW5nIHlvdSBtaWdodCBmaW5kIHJ1bW1hZ2luZyBhcm91bmQgdGhlIFBhbnRyeS4KClRoZSBmaXJzdCB0aHJlZSBhcmUgdGhlIGhvbHkgdHJpbml0eSBvZiBiYXR0ZXIuIFRoZSByZXN0IGFyZSB0b3BwaW5ncywKcmFua2VkIGJ5IGhvdyBtdWNoIHRoZSBicnVuY2gganVkZ2VzIHN3b29uIG92ZXIgdGhlbS4AAAAAAAAACkluZ3JlZGllbnQAAAAAAAoAAAAAAAAABUZsb3VyAAAAAAAAAAAAAAAAAAADRWdnAAAAAAEAAAAAAAAABkJ1dHRlcgAAAAAAAgAAAAAAAAAETWlsawAAAAMAAAAAAAAABVN1Z2FyAAAAAAAABAAAAAAAAAAJQmx1ZWJlcnJ5AAAAAAAABQAAAAAAAAAJQ2hvY29sYXRlAAAAAAAABgAAAAAAAAAGQmFuYW5hAAAAAAAHAAAAAAAAAAVCYWNvbgAAAAAAAAgAAAAAAAAACEdvbGRMZWFmAAAACQ==",
        "AAAAAwAAABZIb3cgYSBiYWtlIHR1cm5lZCBvdXQuAAAAAAAAAAAADFdhZmZsZVN0YXR1cwAAAAIAAAA0Q2xhaW1lZCBpbnNpZGUgdGhlIGdvbGRlbiB3aW5kb3cuIEEgdGhpbmcgb2YgYmVhdXR5LgAAAAZHb2xkZW4AAAAAAAAAAABJTGVmdCBvbiB0aGUgaXJvbiB0b28gbG9uZy4gVGVjaG5pY2FsbHkgc3RpbGwgYSB3YWZmbGUuIExlZ2FsbHksIGNoYXJjb2FsLgAAAAAAAAVCdXJudAAAAAAAAAE=" ]),
      options
    )
  }
  public readonly fromJSON = {
    enter: this.txFromJSON<Result<void>>,
        judge: this.txFromJSON<Result<Option<RoundResult>>>,
        result: this.txFromJSON<Result<RoundResult>>,
        entries: this.txFromJSON<Array<Entry>>,
        trophies: this.txFromJSON<u32>,
        open_round: this.txFromJSON<Result<u32>>,
        collect_pot: this.txFromJSON<Result<RoundResult>>,
        current_round: this.txFromJSON<Option<Round>>
  }
}
// All bakery state in one rune-powered store, polled from Testnet.
import type { Bake, BakerStats, Waffle } from 'griddle';
import { Ingredient } from 'griddle';
import type { Entry, Round, RoundResult } from 'brunch_bash';
import {
  brunchBash,
  friendlyError,
  griddle,
  INGREDIENTS,
  latestLedger,
  pantry,
  toMap,
} from './contracts';
import { signTransaction, wallet } from './wallet.svelte';

export type ToastKind = 'info' | 'success' | 'error';
export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

/** Unwrap a generated-bindings Result<T> (no-op for plain values). */
function unwrap<T>(value: unknown): T {
  if (value && typeof (value as { unwrap?: unknown }).unwrap === 'function') {
    return (value as { unwrap: () => T }).unwrap();
  }
  return value as T;
}

class GameState {
  ledger = $state(0);

  // Pantry
  shelf = $state<Map<Ingredient, number>>(new Map());
  forageReadyIn = $state(0);

  // Griddle
  iron = $state<Bake | undefined>(undefined);
  waffles = $state<Waffle[]>([]);
  stats = $state<BakerStats>({ golden: 0, burnt: 0, best_score: 0 });

  // Brunch Bash
  round = $state<Round | undefined>(undefined);
  entries = $state<Entry[]>([]);
  results = $state<RoundResult[]>([]);
  trophies = $state(0);

  busy = $state<string | null>(null);
  toasts = $state<Toast[]>([]);

  #toastSeq = 0;
  #timer: ReturnType<typeof setInterval> | undefined;
  #refreshing = false;

  toast(kind: ToastKind, text: string): void {
    const id = ++this.#toastSeq;
    this.toasts.push({ id, kind, text });
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, 6500);
  }

  startPolling(): void {
    if (this.#timer) return;
    void this.refresh();
    this.#timer = setInterval(() => {
      void this.tick();
    }, 5000);
  }

  stopPolling(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  /** Light tick: ledger + anything time-sensitive. Full refresh every third tick. */
  #tickCount = 0;
  async tick(): Promise<void> {
    try {
      this.ledger = await latestLedger();
    } catch {
      // RPC hiccup; try again next tick.
    }
    this.#tickCount += 1;
    if (this.#tickCount % 3 === 0) {
      await this.refresh();
    }
  }

  async refresh(): Promise<void> {
    if (this.#refreshing) return;
    this.#refreshing = true;
    try {
      const me = wallet.address;
      const [ledger, round] = await Promise.all([
        latestLedger(),
        brunchBash().current_round().then((tx) => tx.result),
      ]);
      this.ledger = ledger;
      this.round = round;

      if (round) {
        this.entries = await brunchBash()
          .entries({ round_id: round.id })
          .then((tx) => tx.result);
      } else {
        this.entries = [];
      }

      await this.refreshResults(round?.id);

      if (me) {
        const p = pantry();
        const g = griddle();
        const [shelf, readyIn, iron, stats, trophies, waffleIds] = await Promise.all([
          p.shelf({ who: me }).then((tx) => tx.result),
          p.forage_ready_in({ who: me }).then((tx) => tx.result),
          g.iron_status({ baker: me }).then((tx) => tx.result),
          g.stats_of({ baker: me }).then((tx) => tx.result),
          brunchBash().trophies({ baker: me }).then((tx) => tx.result),
          g.waffles_of({ owner: me }).then((tx) => tx.result),
        ]);
        this.shelf = toMap<Ingredient, number>(shelf);
        this.forageReadyIn = readyIn;
        this.iron = iron ?? undefined;
        this.stats = stats;
        this.trophies = trophies;
        this.waffles = (
          await Promise.all(
            waffleIds.map((id) =>
              g
                .get_waffle({ id })
                .then((tx) => unwrap<Waffle>(tx.result))
                .catch(() => null),
            ),
          )
        ).filter((w): w is Waffle => w !== null);
      } else {
        this.shelf = new Map();
        this.iron = undefined;
        this.waffles = [];
        this.trophies = 0;
      }
    } catch (e) {
      console.warn('refresh failed', e);
    } finally {
      this.#refreshing = false;
    }
  }

  /** Round ids are sequential, so probe a window of recent ids for results. */
  async refreshResults(currentId?: number): Promise<void> {
    const maxId = (currentId ?? 31) - 1;
    const ids = Array.from({ length: Math.min(maxId, 30) }, (_, i) => maxId - i).filter(
      (id) => id >= 1,
    );
    const found = await Promise.all(
      ids.map((round_id) =>
        brunchBash()
          .result({ round_id })
          .then((tx) => unwrap<RoundResult>(tx.result))
          .catch(() => null),
      ),
    );
    this.results = found
      .filter((r): r is RoundResult => r !== null)
      .sort((a, b) => b.round_id - a.round_id);
  }

  async #action<T>(
    label: string,
    contract: 'pantry' | 'griddle' | 'brunchBash',
    run: () => Promise<T>,
    onDone: (result: T) => void,
  ): Promise<void> {
    if (this.busy) return;
    if (!wallet.address) {
      this.toast('error', 'Connect your wallet first!');
      return;
    }
    this.busy = label;
    try {
      const result = await run();
      onDone(result);
      await this.refresh();
    } catch (e) {
      this.toast('error', friendlyError(e, contract));
    } finally {
      this.busy = null;
    }
  }

  async forage(): Promise<void> {
    await this.#action(
      'forage',
      'pantry',
      async () => {
        const tx = await pantry(wallet.address!, signTransaction).forage({ who: wallet.address! });
        const sent = await tx.signAndSend();
        return unwrap<Ingredient[]>(sent.result);
      },
      (found) => {
        const loot = found.map((i) => INGREDIENTS[i].emoji).join(' ');
        this.toast('success', `Foraged: ${loot}`);
      },
    );
  }

  async startBake(toppings: Ingredient[]): Promise<void> {
    await this.#action(
      'bake',
      'griddle',
      async () => {
        const tx = await griddle(wallet.address!, signTransaction).start_bake({
          baker: wallet.address!,
          toppings,
        });
        const sent = await tx.signAndSend();
        unwrap<void>(sent.result);
      },
      () => this.toast('info', '🔥 The iron sizzles. Claim between ledgers 6 and 18 — 12 is perfection!'),
    );
  }

  async claim(): Promise<void> {
    await this.#action(
      'claim',
      'griddle',
      async () => {
        const tx = await griddle(wallet.address!, signTransaction).claim({ baker: wallet.address! });
        const sent = await tx.signAndSend();
        return unwrap<Waffle>(sent.result);
      },
      (waffle) => {
        if (waffle.status === 1) {
          this.toast('error', `💀 Waffle #${waffle.id} is charcoal. A perfect 100 crispiness, though.`);
        } else {
          this.toast('success', `🧇 Waffle #${waffle.id} is GOLDEN! Score ${waffle.score}.`);
        }
      },
    );
  }

  async openRound(duration: number): Promise<void> {
    await this.#action(
      'open',
      'brunchBash',
      async () => {
        const tx = await brunchBash(wallet.address!, signTransaction).open_round({
          host: wallet.address!,
          duration,
        });
        const sent = await tx.signAndSend();
        return unwrap<number>(sent.result);
      },
      (id) => this.toast('success', `🥂 Brunch round #${id} is open — bring your waffles!`),
    );
  }

  async enter(waffleId: bigint): Promise<void> {
    await this.#action(
      'enter',
      'brunchBash',
      async () => {
        const tx = await brunchBash(wallet.address!, signTransaction).enter({
          baker: wallet.address!,
          waffle_id: waffleId,
        });
        const sent = await tx.signAndSend();
        unwrap<void>(sent.result);
      },
      () => this.toast('success', `🎟️ Waffle #${waffleId} is at the judging table (1 XLM in the pot).`),
    );
  }

  async judge(): Promise<void> {
    await this.#action(
      'judge',
      'brunchBash',
      async () => {
        const tx = await brunchBash(wallet.address!, signTransaction).judge();
        const sent = await tx.signAndSend();
        return unwrap<RoundResult | undefined>(sent.result);
      },
      (result) => {
        if (result) {
          this.toast('success', `🏅 Round ${result.round_id}: waffle #${result.winning_waffle} wins! Collect the pot to crown them.`);
        } else {
          this.toast('info', '🍞 No entries — the judges ate toast and went home.');
        }
      },
    );
  }

  async collectPot(roundId: number): Promise<void> {
    await this.#action(
      'collect',
      'brunchBash',
      async () => {
        const tx = await brunchBash(wallet.address!, signTransaction).collect_pot({ round_id: roundId });
        const sent = await tx.signAndSend();
        return unwrap<RoundResult>(sent.result);
      },
      (r) => this.toast('success', `💰 Pot of ${Number(r.pot) / 10_000_000} XLM paid to the champion!`),
    );
  }
}

export const game = new GameState();

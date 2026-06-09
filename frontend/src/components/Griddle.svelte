<script lang="ts">
  import { Ingredient } from 'griddle';
  import { game } from '../lib/game.svelte';
  import {
    ALL_INGREDIENTS,
    BATTER,
    GOLDEN_END,
    GOLDEN_START,
    INGREDIENTS,
  } from '../lib/contracts';
  import { bakePhase, bakeProgress, phaseLabel, timingBonus } from '../lib/timing';

  let selected = $state<Ingredient[]>([]);

  /** Counts left over for toppings: batter itself eats 1 of each staple. */
  function toppingCap(ing: Ingredient): number {
    const owned = game.shelf.get(ing) ?? 0;
    return BATTER.includes(ing) ? Math.max(owned - 1, 0) : owned;
  }

  function selectedCount(ing: Ingredient): number {
    return selected.filter((s) => s === ing).length;
  }

  const pickable = $derived(ALL_INGREDIENTS.filter((ing) => toppingCap(ing) > 0));
  const flavorSum = $derived(selected.reduce((sum, ing) => sum + INGREDIENTS[ing].flavor, 0));
  const hasBatter = $derived(BATTER.every((ing) => (game.shelf.get(ing) ?? 0) >= 1));

  function addTopping(ing: Ingredient): void {
    if (selected.length >= 3) return;
    if (selectedCount(ing) >= toppingCap(ing)) return;
    selected.push(ing);
  }

  function removeTopping(index: number): void {
    selected.splice(index, 1);
  }

  async function pour(): Promise<void> {
    await game.startBake([...selected]);
    if (game.iron) selected = [];
  }

  // Live bake state
  const elapsed = $derived(game.iron ? Math.max(game.ledger - game.iron.started_at, 0) : 0);
  const phase = $derived(bakePhase(elapsed));
  const progress = $derived(bakeProgress(elapsed));
  const goldenInSecs = $derived(Math.max(GOLDEN_START - elapsed, 0) * 5);
  const burnsInSecs = $derived(Math.max(GOLDEN_END + 1 - elapsed, 0) * 5);
</script>

<section class="card">
  <h2>🔥 The Griddle</h2>

  {#if game.iron}
    <div class="bake">
      <p class="phase phase-{phase}">{phaseLabel(phase)}</p>

      <div class="track">
        <div class="zone raw" style:width="{(GOLDEN_START / (GOLDEN_END + 1)) * 100}%"></div>
        <div
          class="zone golden"
          style:width="{((GOLDEN_END + 1 - GOLDEN_START) / (GOLDEN_END + 1)) * 100}%"
        ></div>
        <div class="fill fill-{phase}" class:sizzle={phase !== 'burnt'} style:width="{progress * 100}%"></div>
      </div>
      <div class="ticks">
        <span>pour</span>
        <span>golden</span>
        <span>charcoal</span>
      </div>

      <p class="timing">
        Ledger {elapsed} on the iron
        {#if phase === 'raw'}
          — golden in ~{goldenInSecs}s 🕰️
        {:else if phase === 'golden'}
          — burns in ~{burnsInSecs}s 🔥 Claim now for a +{timingBonus(elapsed)} timing bonus!
        {:else}
          — it has transcended breakfast. 💀
        {/if}
      </p>

      {#if game.iron.toppings.length > 0}
        <p class="toppings-line">
          Toppings aboard:
          {#each game.iron.toppings as t, i (i)}
            <span>{INGREDIENTS[t].emoji}</span>
          {/each}
        </p>
      {/if}

      <button class="claim" onclick={() => game.claim()} disabled={game.busy !== null}>
        {game.busy === 'claim' ? 'Lifting the iron…' : 'CLAIM THE WAFFLE 🧇'}
      </button>
      <p class="hint">Too early? The contract refuses raw claims — no harm done.</p>
    </div>
  {:else}
    <p class="hint">
      Pouring batter burns 1 🌾 + 1 🥚 + 1 🧈 automatically. Pick up to 3 toppings
      (yes, flour-on-flour is allowed — we don't judge, the brunch judges do).
    </p>

    <div class="picker">
      {#each pickable as ing (ing)}
        {@const info = INGREDIENTS[ing]}
        <button
          class="chip"
          onclick={() => addTopping(ing)}
          disabled={selected.length >= 3 || selectedCount(ing) >= toppingCap(ing)}
          title="+{info.flavor} flavor"
        >
          {info.emoji} {info.name}
          <small>×{toppingCap(ing) - selectedCount(ing)}</small>
        </button>
      {/each}
      {#if pickable.length === 0}
        <p class="hint">Nothing toppable on the shelf — forage some goodies first.</p>
      {/if}
    </div>

    <div class="selection">
      {#if selected.length > 0}
        <span>On the waffle ({flavorSum} flavor pts):</span>
        {#each selected as ing, i (i)}
          <button class="chip picked" onclick={() => removeTopping(i)} title="Remove">
            {INGREDIENTS[ing].emoji} ✕
          </button>
        {/each}
      {:else}
        <span class="hint">A plain waffle. Bold. Minimalist. Cheap.</span>
      {/if}
    </div>

    {#if !hasBatter}
      <p class="warn">
        ⚠️ You need 1 🌾 flour, 1 🥚 egg, and 1 🧈 butter for batter. Hit the pantry!
      </p>
    {/if}

    <button class="pour" onclick={pour} disabled={game.busy !== null || !hasBatter}>
      {game.busy === 'bake' ? 'Pouring…' : 'Pour the batter 🫗'}
    </button>
  {/if}
</section>

<style>
  .card {
    background: var(--card);
    border: 1px solid var(--card-edge);
    border-radius: 18px;
    box-shadow: var(--shadow);
    padding: 1rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  h2 {
    font-size: 1.2rem;
    color: var(--maple-dark);
  }

  .hint {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  .warn {
    font-size: 0.9rem;
    background: #fdeaea;
    border: 1px solid #e2a4a4;
    color: #8c3030;
    border-radius: 10px;
    padding: 0.4rem 0.7rem;
  }

  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .chip {
    font-size: 0.85rem;
    padding: 0.3rem 0.7rem;
    background: #fffdf6;
    border-color: var(--card-edge);
    box-shadow: 0 1px 0 var(--card-edge);
  }

  .chip small {
    color: var(--ink-soft);
  }

  .chip.picked {
    background: var(--butter-soft);
    border-color: var(--butter);
  }

  .selection {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.9rem;
    min-height: 2rem;
  }

  .pour,
  .claim {
    align-self: flex-start;
    font-size: 1rem;
  }

  .claim {
    background: var(--maple);
    color: #fff8ec;
    border-color: var(--maple-dark);
    font-size: 1.1rem;
    padding: 0.6rem 1.4rem;
  }

  .bake {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .phase {
    font-size: 1.35rem;
    font-weight: 800;
  }

  .phase-raw {
    color: var(--ink-soft);
  }

  .phase-golden {
    color: var(--maple);
  }

  .phase-burnt {
    color: var(--burnt);
  }

  .track {
    position: relative;
    height: 22px;
    border-radius: 999px;
    overflow: hidden;
    background: #d8c3ac; /* the burnt zone peeks through at the end */
    border: 2px solid var(--card-edge);
    display: flex;
  }

  .zone {
    height: 100%;
  }

  .zone.raw {
    background: #f3e9d2;
  }

  .zone.golden {
    background: var(--butter-soft);
  }

  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 999px;
    transition: width 0.6s ease;
  }

  .fill-raw {
    background: rgba(138, 106, 77, 0.55);
  }

  .fill-golden {
    background: linear-gradient(90deg, var(--butter), var(--maple));
  }

  .fill-burnt {
    background: var(--burnt);
  }

  .fill.sizzle {
    animation: sizzle 0.8s ease-in-out infinite;
  }

  @keyframes sizzle {
    0%,
    100% {
      filter: brightness(1);
      transform: scaleY(1);
    }
    50% {
      filter: brightness(1.18);
      transform: scaleY(0.92);
    }
  }

  .ticks {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--ink-soft);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .timing {
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  .toppings-line {
    font-size: 0.9rem;
  }
</style>

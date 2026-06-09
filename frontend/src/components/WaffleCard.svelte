<script lang="ts">
  import type { Waffle } from 'griddle';
  import { WaffleStatus } from 'griddle';
  import { INGREDIENTS } from '../lib/contracts';

  let { waffle }: { waffle: Waffle } = $props();

  const burnt = $derived(waffle.status === WaffleStatus.Burnt);
</script>

<article class="waffle" class:burnt>
  <div class="top">
    <span class="face">{burnt ? '🌑' : '🧇'}</span>
    <span class="id">#{String(waffle.id)}</span>
    <span class="score" title="crispiness + fluffiness + flavor">{waffle.score}</span>
  </div>

  <div class="bars">
    <div class="bar">
      <span class="label">Crisp</span>
      <div class="meter"><div class="meter-fill" style:width="{Math.min(waffle.crispiness, 100)}%"></div></div>
      <span class="val">{waffle.crispiness}</span>
    </div>
    <div class="bar">
      <span class="label">Fluff</span>
      <div class="meter"><div class="meter-fill" style:width="{Math.min(waffle.fluffiness, 100)}%"></div></div>
      <span class="val">{waffle.fluffiness}</span>
    </div>
    <div class="bar">
      <span class="label">Flavor</span>
      <div class="meter"><div class="meter-fill" style:width="{Math.min(waffle.flavor, 100)}%"></div></div>
      <span class="val">{waffle.flavor}</span>
    </div>
  </div>

  {#if waffle.toppings.length > 0}
    <p class="toppings">
      {#each waffle.toppings as t, i (i)}<span>{INGREDIENTS[t].emoji}</span>{/each}
    </p>
  {:else}
    <p class="toppings plain">plain &amp; proud</p>
  {/if}

  {#if waffle.ribbons > 0}
    <p class="ribbons" title="{waffle.ribbons} blue ribbon(s) from the Brunch Bash">
      {'🎗️'.repeat(waffle.ribbons)}
    </p>
  {/if}
</article>

<style>
  .waffle {
    background: #fffdf6;
    border: 2px solid var(--butter);
    border-radius: 14px;
    padding: 0.7rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    box-shadow: var(--shadow);
  }

  .waffle.burnt {
    border-color: var(--burnt);
    background: #f4efe8;
    filter: saturate(0.6);
  }

  .top {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }

  .face {
    font-size: 1.6rem;
  }

  .id {
    color: var(--ink-soft);
    font-weight: 700;
  }

  .score {
    margin-left: auto;
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--maple-dark);
    font-variant-numeric: tabular-nums;
  }

  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .bar {
    display: grid;
    grid-template-columns: 3.2rem 1fr 2rem;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
  }

  .label {
    color: var(--ink-soft);
    font-weight: 700;
  }

  .val {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .meter {
    height: 8px;
    border-radius: 999px;
    background: #efe4cc;
    overflow: hidden;
  }

  .meter-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--butter), var(--maple));
  }

  .toppings {
    font-size: 1.1rem;
    letter-spacing: 0.15em;
  }

  .toppings.plain {
    font-size: 0.8rem;
    color: var(--ink-soft);
    font-style: italic;
  }

  .ribbons {
    font-size: 1rem;
  }
</style>

<script lang="ts">
  import { game } from '../lib/game.svelte';
  import { ALL_INGREDIENTS, INGREDIENTS } from '../lib/contracts';

  const coolingDown = $derived(game.forageReadyIn > 0);
  const cooldownSecs = $derived(game.forageReadyIn * 5);
</script>

<section class="card">
  <div class="head">
    <h2>🧺 The Pantry</h2>
    <button
      onclick={() => game.forage()}
      disabled={game.busy !== null || coolingDown}
    >
      {#if game.busy === 'forage'}
        Rummaging…
      {:else if coolingDown}
        Restocking… ~{cooldownSecs}s
      {:else}
        Forage 🔍
      {/if}
    </button>
  </div>
  <p class="hint">
    Rummage for random ingredients. First trip includes a free welcome basket of
    flour, egg, and butter.
  </p>

  <div class="grid">
    {#each ALL_INGREDIENTS as ing (ing)}
      {@const info = INGREDIENTS[ing]}
      {@const count = game.shelf.get(ing) ?? 0}
      <div class="item rarity-{info.rarity}" class:empty={count === 0}>
        <span class="emoji">{info.emoji}</span>
        <span class="name">{info.name}</span>
        <span class="count">×{count}</span>
      </div>
    {/each}
  </div>
</section>

<style>
  .card {
    background: var(--card);
    border: 1px solid var(--card-edge);
    border-radius: 18px;
    box-shadow: var(--shadow);
    padding: 1rem 1.1rem;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  h2 {
    font-size: 1.2rem;
    color: var(--maple-dark);
  }

  .hint {
    font-size: 0.85rem;
    color: var(--ink-soft);
    margin: 0.35rem 0 0.8rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 0.5rem;
  }

  .item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    background: #fffdf6;
    border: 2px solid var(--card-edge);
    border-radius: 12px;
    padding: 0.5rem 0.25rem;
    text-align: center;
  }

  .item.empty {
    opacity: 0.4;
    filter: grayscale(0.6);
  }

  .rarity-common {
    border-color: #ddd0b6;
  }

  .rarity-tasty {
    border-color: #8fbf7a;
  }

  .rarity-fancy {
    border-color: var(--berry);
  }

  .rarity-legendary {
    border-color: var(--butter);
    box-shadow: 0 0 8px rgba(242, 193, 78, 0.6);
  }

  .emoji {
    font-size: 1.5rem;
  }

  .name {
    font-size: 0.75rem;
    font-weight: 700;
  }

  .count {
    font-size: 0.8rem;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }
</style>

<script lang="ts">
  import { game } from '../lib/game.svelte';
  import WaffleCard from './WaffleCard.svelte';

  const newestFirst = $derived(
    [...game.waffles].sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0)),
  );
</script>

<section class="card">
  <h2>🍽️ Your Waffle Gallery</h2>
  {#if newestFirst.length === 0}
    <p class="empty">No waffles yet. The iron awaits.</p>
  {:else}
    <div class="grid">
      {#each newestFirst as waffle (waffle.id)}
        <WaffleCard {waffle} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .card {
    background: var(--card);
    border: 1px solid var(--card-edge);
    border-radius: 18px;
    box-shadow: var(--shadow);
    padding: 1rem 1.1rem;
  }

  h2 {
    font-size: 1.2rem;
    color: var(--maple-dark);
    margin-bottom: 0.7rem;
  }

  .empty {
    color: var(--ink-soft);
    font-style: italic;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 0.7rem;
  }
</style>

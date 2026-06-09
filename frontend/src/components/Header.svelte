<script lang="ts">
  import { wallet } from '../lib/wallet.svelte';
  import { game } from '../lib/game.svelte';
  import { shortAddress } from '../lib/contracts';
</script>

<header>
  <div class="brand">
    <h1>🧇 The Laughing Waffle</h1>
    <span class="ledger" title="Current Stellar Testnet ledger">
      ⛓️ ledger {game.ledger || '…'}
    </span>
  </div>

  <div class="side">
    {#if wallet.connected}
      <div class="chips">
        <span class="chip" title="Golden waffles baked">🥇 {game.stats.golden}</span>
        <span class="chip" title="Waffles tragically burnt">💀 {game.stats.burnt}</span>
        <span class="chip" title="Best waffle score">⭐ {game.stats.best_score}</span>
        <span class="chip" title="Golden-spatula trophies">🏆 {game.trophies}</span>
      </div>
      <button onclick={() => wallet.disconnect()} title="Disconnect wallet">
        {shortAddress(wallet.address!)} ✕
      </button>
    {:else}
      <button onclick={() => wallet.connect()} disabled={wallet.connecting}>
        {wallet.connecting ? 'Knocking on Freighter…' : '🔌 Connect wallet'}
      </button>
    {/if}
  </div>
</header>
{#if wallet.error}
  <p class="wallet-error">⚠️ {wallet.error}</p>
{/if}

<style>
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 0 1rem;
  }

  .brand {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  h1 {
    font-size: 1.7rem;
    color: var(--maple-dark);
  }

  .ledger {
    font-size: 0.85rem;
    color: var(--ink-soft);
    background: var(--card);
    border: 1px solid var(--card-edge);
    border-radius: 999px;
    padding: 0.15rem 0.6rem;
    font-variant-numeric: tabular-nums;
  }

  .side {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .chips {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .chip {
    background: var(--butter-soft);
    border: 1px solid var(--butter);
    border-radius: 999px;
    padding: 0.15rem 0.55rem;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .wallet-error {
    background: #fdeaea;
    border: 1px solid #e2a4a4;
    color: #8c3030;
    border-radius: 10px;
    padding: 0.4rem 0.8rem;
    margin-bottom: 0.75rem;
    font-size: 0.9rem;
  }
</style>

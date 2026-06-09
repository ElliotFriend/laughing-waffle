<script lang="ts">
  import { onMount } from 'svelte';
  import { wallet } from './lib/wallet.svelte';
  import { game } from './lib/game.svelte';
  import { CONTRACT_IDS, shortAddress } from './lib/contracts';
  import Header from './components/Header.svelte';
  import Pantry from './components/Pantry.svelte';
  import Griddle from './components/Griddle.svelte';
  import WaffleGallery from './components/WaffleGallery.svelte';
  import BrunchBash from './components/BrunchBash.svelte';
  import Toasts from './components/Toasts.svelte';

  onMount(() => {
    void wallet.restore().then(() => game.startPolling());
    return () => game.stopPolling();
  });

  const explorer = 'https://stellar.expert/explorer/testnet/contract';
</script>

<Header />

{#if wallet.connected}
  <main class="grid">
    <Pantry />
    <Griddle />
    <div class="full"><WaffleGallery /></div>
    <div class="full"><BrunchBash /></div>
  </main>
{:else}
  <section class="hero">
    <p class="big-waffle">🧇</p>
    <h2>Welcome to The Laughing Waffle!</h2>
    <p>
      A fully on-chain waffle bakery on Stellar Testnet. <strong>Forage</strong> the
      pantry for ingredients, <strong>pour batter</strong> on your very own waffle
      iron, and nail the timing — lift between ledgers 6 and 18 for a
      <strong>golden waffle</strong> (ledger 12 is peak crispiness; wait too long and
      you mint artisanal charcoal 💀).
    </p>
    <p>
      Then bring your golden best to the <strong>Brunch Bash</strong>: 1 XLM buys a
      seat at the judging table, and the tastiest waffle takes the whole pot, a blue
      ribbon, and a golden-spatula trophy. 🏆
    </p>
    <button onclick={() => wallet.connect()} disabled={wallet.connecting}>
      {wallet.connecting ? 'Knocking on Freighter…' : '🔌 Connect Freighter to start baking'}
    </button>
    <p class="fine">Testnet only — the waffles are priceless, the XLM is free.</p>
  </section>
{/if}

<Toasts />

<footer>
  <span>Contracts on Testnet:</span>
  <a href="{explorer}/{CONTRACT_IDS.pantry}" target="_blank" rel="noreferrer">
    🧺 Pantry {shortAddress(CONTRACT_IDS.pantry)}
  </a>
  <a href="{explorer}/{CONTRACT_IDS.griddle}" target="_blank" rel="noreferrer">
    🔥 Griddle {shortAddress(CONTRACT_IDS.griddle)}
  </a>
  <a href="{explorer}/{CONTRACT_IDS.brunchBash}" target="_blank" rel="noreferrer">
    🥂 Brunch Bash {shortAddress(CONTRACT_IDS.brunchBash)}
  </a>
</footer>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: start;
  }

  .full {
    grid-column: 1 / -1;
  }

  @media (max-width: 800px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .hero {
    background: var(--card);
    border: 1px solid var(--card-edge);
    border-radius: 22px;
    box-shadow: var(--shadow);
    padding: 2rem 1.5rem;
    max-width: 640px;
    margin: 2rem auto;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    align-items: center;
  }

  .big-waffle {
    font-size: 4rem;
    line-height: 1;
  }

  .hero h2 {
    color: var(--maple-dark);
  }

  .hero button {
    font-size: 1.05rem;
    padding: 0.6rem 1.4rem;
  }

  .fine {
    font-size: 0.8rem;
    color: var(--ink-soft);
  }

  footer {
    margin-top: 2rem;
    padding: 1rem 0 0.5rem;
    border-top: 1px dashed var(--card-edge);
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
    font-size: 0.8rem;
    color: var(--ink-soft);
    justify-content: center;
  }
</style>

<script lang="ts">
  import { WaffleStatus } from 'griddle';
  import { game } from '../lib/game.svelte';
  import { ENTRY_FEE_XLM, shortAddress } from '../lib/contracts';

  const DURATIONS = [
    { ledgers: 25, label: '25 ledgers (~2 min)' },
    { ledgers: 60, label: '60 ledgers (~5 min)' },
    { ledgers: 360, label: '360 ledgers (~30 min)' },
  ];

  let duration = $state(60);

  function xlm(pot: bigint): string {
    return (Number(pot) / 10_000_000).toLocaleString(undefined, {
      maximumFractionDigits: 7,
    });
  }

  const closed = $derived(game.round !== undefined && game.ledger >= game.round.closes_at);
  const ledgersLeft = $derived(game.round ? Math.max(game.round.closes_at - game.ledger, 0) : 0);
  const eligible = $derived(
    game.waffles
      .filter(
        (w) =>
          w.status === WaffleStatus.Golden &&
          !game.entries.some((e) => e.waffle_id === w.id),
      )
      .sort((a, b) => b.score - a.score),
  );
</script>

<section class="card">
  <h2>🥂 The Brunch Bash</h2>

  {#if game.round}
    {@const round = game.round}
    <div class="round-head">
      <span class="pot">💰 {xlm(round.pot)} XLM pot</span>
      <span class="meta">Round #{round.id} · hosted by {shortAddress(round.host)}</span>
      {#if closed}
        <span class="meta closed-tag">🔔 Entries closed!</span>
      {:else}
        <span class="meta">⏳ closes in {ledgersLeft} ledgers (~{ledgersLeft * 5}s)</span>
      {/if}
    </div>

    {#if game.entries.length > 0}
      <table>
        <thead>
          <tr><th>Waffle</th><th>Baker</th><th>Score</th></tr>
        </thead>
        <tbody>
          {#each game.entries as entry (entry.waffle_id)}
            <tr>
              <td>🧇 #{String(entry.waffle_id)}</td>
              <td>{shortAddress(entry.baker)}</td>
              <td class="num">{entry.score}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="hint">No entries yet — the judging table is bare.</p>
    {/if}

    {#if closed}
      <button class="big" onclick={() => game.judge()} disabled={game.busy !== null}>
        {game.busy === 'judge' ? 'Deliberating…' : 'Summon the judges 🧑‍⚖️'}
      </button>
    {:else if eligible.length > 0}
      <div class="enter-box">
        <p class="hint">
          Enter a golden waffle (costs {ENTRY_FEE_XLM} XLM into the pot, one entry per waffle):
        </p>
        <div class="enter-list">
          {#each eligible as w (w.id)}
            <button
              onclick={() => game.enter(w.id)}
              disabled={game.busy !== null}
            >
              {game.busy === 'enter' ? 'Plating…' : `Enter 🧇 #${String(w.id)} (score ${w.score})`}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <p class="hint">
        No golden waffles free to enter — bake one (or all yours are already at the table).
      </p>
    {/if}
  {:else}
    <div class="host-box">
      <p>No brunch underway. Host one and let the neighborhood compete!</p>
      <div class="durations">
        {#each DURATIONS as d (d.ledgers)}
          <button
            class="chip"
            class:active={duration === d.ledgers}
            onclick={() => (duration = d.ledgers)}
          >
            {d.label}
          </button>
        {/each}
      </div>
      <button class="big" onclick={() => game.openRound(duration)} disabled={game.busy !== null}>
        {game.busy === 'open' ? 'Setting the table…' : 'Host a brunch 🥞'}
      </button>
    </div>
  {/if}

  {#if game.results.length > 0}
    <h3>📜 Recent results</h3>
    <ul class="results">
      {#each game.results as r (r.round_id)}
        <li>
          <span>
            Round #{r.round_id} — champion {shortAddress(r.champion)}, waffle
            #{String(r.winning_waffle)}, pot {xlm(r.pot)} XLM
            {r.paid ? '· paid 🏆' : ''}
          </span>
          {#if !r.paid}
            <button onclick={() => game.collectPot(r.round_id)} disabled={game.busy !== null}>
              {game.busy === 'collect' ? 'Polishing the trophy…' : 'Run the ceremony 💰'}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
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
    gap: 0.7rem;
  }

  h2 {
    font-size: 1.2rem;
    color: var(--maple-dark);
  }

  h3 {
    font-size: 1rem;
    color: var(--maple-dark);
    margin-top: 0.4rem;
  }

  .hint {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  .round-head {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    flex-wrap: wrap;
  }

  .pot {
    font-size: 1.3rem;
    font-weight: 900;
    color: var(--maple-dark);
  }

  .meta {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  .closed-tag {
    color: var(--maple);
    font-weight: 800;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9rem;
  }

  th {
    text-align: left;
    color: var(--ink-soft);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  th,
  td {
    padding: 0.3rem 0.5rem;
    border-bottom: 1px dashed var(--card-edge);
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  .big {
    align-self: flex-start;
    font-size: 1.05rem;
    background: var(--maple);
    color: #fff8ec;
    border-color: var(--maple-dark);
    padding: 0.55rem 1.3rem;
  }

  .enter-box,
  .host-box {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .enter-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .enter-list button {
    font-size: 0.85rem;
    padding: 0.35rem 0.8rem;
  }

  .durations {
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

  .chip.active {
    background: var(--butter-soft);
    border-color: var(--maple);
  }

  .results {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.9rem;
  }

  .results li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    flex-wrap: wrap;
    border-bottom: 1px dashed var(--card-edge);
    padding-bottom: 0.4rem;
  }

  .results button {
    font-size: 0.8rem;
    padding: 0.3rem 0.7rem;
  }
</style>

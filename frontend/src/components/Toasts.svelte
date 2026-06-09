<script lang="ts">
  import { game } from '../lib/game.svelte';
</script>

<div class="stack" aria-live="polite">
  {#each game.toasts as toast (toast.id)}
    <div class="toast {toast.kind}">
      <span class="icon">
        {toast.kind === 'success' ? '🎉' : toast.kind === 'error' ? '😬' : '🧈'}
      </span>
      <span>{toast.text}</span>
    </div>
  {/each}
</div>

<style>
  .stack {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 100;
    max-width: min(360px, calc(100vw - 2rem));
  }

  .toast {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    background: var(--card);
    border: 2px solid var(--card-edge);
    border-radius: 14px;
    padding: 0.6rem 0.9rem;
    box-shadow: var(--shadow);
    font-size: 0.9rem;
    animation: pop-in 0.25s ease;
  }

  .toast.success {
    border-color: #8fbf7a;
    background: #f3f9ee;
  }

  .toast.error {
    border-color: #e2a4a4;
    background: #fdf0f0;
  }

  .toast.info {
    border-color: var(--butter);
    background: var(--butter-soft);
  }

  .icon {
    font-size: 1.1rem;
  }

  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>

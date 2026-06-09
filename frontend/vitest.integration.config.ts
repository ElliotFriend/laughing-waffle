import { defineConfig } from 'vitest/config';

// Integration tests talk to the live Testnet contracts: they fund a fresh
// keypair via friendbot and play a whole bake. Expect a couple of minutes.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 240_000,
    hookTimeout: 120_000,
  },
});

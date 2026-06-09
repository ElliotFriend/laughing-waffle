# 🧇 The Laughing Waffle

*A fully on-chain, competitively-judged, timing-critical waffle bakery on Stellar Testnet.*

Forage a pantry for random ingredients, pour batter onto your very own waffle
iron, and play a timing game measured in **real ledgers**: lift too early and
the contract refuses ("still raw!"), nail the golden window and you mint a
scored waffle, dawdle and you mint artisanal charcoal. Then enter your golden
best in the **Brunch Bash** — 1 XLM buys a seat at the judging table, and the
tastiest waffle (usually... the judges have whimsy) takes the whole pot, a
blue ribbon, and a golden-spatula trophy.

## The contracts (live on Testnet)

| Contract | ID | What it does |
|---|---|---|
| 🥚 **Pantry** | [`CBTWOYSSPXUJOXERFDNJ4ICMPWRGJVRZKPUUVQ64LOOHFA5RHE5MAYVJ`](https://stellar.expert/explorer/testnet/contract/CBTWOYSSPXUJOXERFDNJ4ICMPWRGJVRZKPUUVQ64LOOHFA5RHE5MAYVJ) | PRNG ingredient drops, 12-ledger forage cooldown, welcome baskets |
| 🔥 **Griddle** | [`CA5PODGBAVRG2AUYZLYEILEATUO2NCLXQLOKI2G7GEJJXSLG762GAPXW`](https://stellar.expert/explorer/testnet/contract/CA5PODGBAVRG2AUYZLYEILEATUO2NCLXQLOKI2G7GEJJXSLG762GAPXW) | Timed bakes, waffle minting/scoring, transfers, ribbons |
| 🏆 **Brunch Bash** | [`CDQKUS47VA66YQS2IZTZ7VCTBSW44DOY22VLEPFDOFH3Y4G5I55J6TD5`](https://stellar.expert/explorer/testnet/contract/CDQKUS47VA66YQS2IZTZ7VCTBSW44DOY22VLEPFDOFH3Y4G5I55J6TD5) | Competition rounds, XLM pots (native SAC), PRNG-whimsy judging |

How they trust each other (Soroban invoker auth):

```
          consume()                    award_ribbon()
Pantry  ◄──────────────  Griddle  ◄──────────────────  Brunch Bash
  only the Griddle may       │           only the Bash may
  burn your ingredients      │           pin ribbons
                             ▼
                      Waffles (owned, scored,
                      transferable, be-ribboned)
```

## How to play (CLI, any Testnet account)

```bash
PANTRY=CBTWOYSSPXUJOXERFDNJ4ICMPWRGJVRZKPUUVQ64LOOHFA5RHE5MAYVJ
GRIDDLE=CA5PODGBAVRG2AUYZLYEILEATUO2NCLXQLOKI2G7GEJJXSLG762GAPXW
BASH=CDQKUS47VA66YQS2IZTZ7VCTBSW44DOY22VLEPFDOFH3Y4G5I55J6TD5
ME=your_key_alias   # stellar keys generate ME --network testnet --fund

# 1. Forage. Your first visit includes a welcome basket (flour, egg, butter)
#    so you can bake immediately. Cooldown: 12 ledgers (~1 min).
stellar contract invoke --id $PANTRY --source $ME --network testnet -- \
  forage --who $ME

# Ingredients are numbered: 0 Flour, 1 Egg, 2 Butter, 3 Milk, 4 Sugar,
# 5 Blueberry, 6 Chocolate, 7 Banana, 8 Bacon, 9 GoldLeaf (1% drop!)
stellar contract invoke --id $PANTRY --source $ME --network testnet -- \
  shelf --who $ME

# 2. Pour the batter (burns 1 flour + 1 egg + 1 butter) with up to 3 toppings.
stellar contract invoke --id $GRIDDLE --source $ME --network testnet -- \
  start_bake --baker $ME --toppings '[6]'

# 3. NOW WATCH THE CLOCK. The bake is measured in ledgers (~5s each):
#      < 6 ledgers  (< ~30s)  → claim refused, still raw (no harm done)
#      6–18 ledgers (~30–90s) → GOLDEN waffle; ledger 12 is peak crispiness
#      > 18 ledgers (> ~90s)  → charcoal (score: 1, crispiness: a perfect 100)
stellar contract invoke --id $GRIDDLE --source $ME --network testnet -- \
  claim --baker $ME

# 4. Throw a brunch (or join one — only one round runs at a time).
stellar contract invoke --id $BASH --source $ME --network testnet -- \
  open_round --host $ME --duration 60        # entries close in ~5 min

# 5. Enter your waffle (costs 1 XLM into the pot; charcoal is turned away).
stellar contract invoke --id $BASH --source $ME --network testnet -- \
  enter --baker $ME --waffle_id 1

# 6. After the round closes: summon the judges, then run the podium ceremony.
#    Each waffle rolls score + whimsy(0..40); the best roll wins everything.
stellar contract invoke --id $BASH --source $ME --network testnet -- judge
stellar contract invoke --id $BASH --source $ME --network testnet -- \
  collect_pot --round_id 1

# Brag:
stellar contract invoke --id $BASH --source $ME --network testnet -- \
  trophies --baker $ME
stellar contract invoke --id $GRIDDLE --source $ME --network testnet -- \
  stats_of --baker $ME
```

## How to play (browser)

```bash
cd frontend
npm install
npm run dev          # then open http://localhost:5173
```

Connect [Freighter](https://freighter.app) (set to Testnet) and the whole
game is point-and-click: a live pantry shelf, an animated waffle iron with a
raw→golden→burnt progress bar, your waffle gallery, and the Brunch Bash table.

## Repository layout

```
contracts/
  types/        bakery-types: Ingredient, Waffle (shared by all contracts)
  pantry/       foraging, cooldowns, ingredient shelves
  griddle/      timed bakes, waffle minting, transfers, ribbons
  brunch-bash/  rounds, entries, judging, pots, trophies
frontend/
  packages/     TypeScript bindings generated from the deployed contracts
  src/lib/      wallet (Freighter), contract clients, game store, timing math
  src/          Svelte 5 app
  tests/        Vitest integration suite (plays a real bake on Testnet)
```

## Tests

```bash
cargo test                  # 15 contract tests (3 crates, soroban-sdk testutils)
cd frontend
npm test                    # 14 unit tests (timing math, error mapping, metadata)
npm run test:integration    # 5 tests against the LIVE Testnet contracts:
                            # funds a fresh keypair via friendbot, forages,
                            # bakes and claims a real golden waffle (~1 min)
```

## Design notes (the fun engineering bits)

- **PRNG vs. simulation footprints.** Soroban transactions declare their
  storage footprint at simulation time, but `env.prng()` reseeds every
  ledger — so any *storage key* derived from a random outcome will trap
  on-chain (`simulation ≠ execution`). Two consequences here:
  - The pantry keeps each baker's shelf as **one map under one key, always
    containing all ten ingredients**, so random drops never change the shape
    or size of the write.
  - Judging is **two-phase**: `judge` rolls the dice and records the champion
    under deterministic keys; `collect_pot` pays out based on what's already
    in storage.
- **Cross-contract auth without admin keys.** `consume` and `award_ribbon`
  call `require_auth()` on a stored contract address — Soroban's invoker
  auth makes that pass exactly when the trusted contract is the direct
  caller, no signatures involved.
- **Recoverable failure as game design.** Claiming a raw waffle is a
  *contract error*, so the transaction reverts and your bake keeps cooking.
  The only way to ruin a waffle is to wait too long, which is canon.
- **The XLM pot** uses the native Stellar Asset Contract directly — entry
  fees escrow in the Brunch Bash contract address and pay out with a
  self-authorized transfer.

## Redeploying your own bakery

```bash
stellar contract build
CHEF=$(stellar keys address you)
NATIVE=$(stellar contract id asset --asset native --network testnet)
PANTRY=$(stellar contract deploy --wasm target/wasm32v1-none/release/pantry.wasm \
  --source you --network testnet -- --admin $CHEF)
GRIDDLE=$(stellar contract deploy --wasm target/wasm32v1-none/release/griddle.wasm \
  --source you --network testnet -- --admin $CHEF --pantry $PANTRY)
BASH=$(stellar contract deploy --wasm target/wasm32v1-none/release/brunch_bash.wasm \
  --source you --network testnet -- --admin $CHEF --griddle $GRIDDLE --token $NATIVE)
stellar contract invoke --id $PANTRY --source you --network testnet -- set_griddle --griddle $GRIDDLE
stellar contract invoke --id $GRIDDLE --source you --network testnet -- set_contest --contest $BASH
# then regenerate frontend bindings:
#   stellar contract bindings typescript --contract-id $PANTRY --network testnet \
#     --output-dir frontend/packages/pantry --overwrite   (etc.)
```

---

*Built with soroban-sdk 26, Svelte 5, and an unreasonable fondness for
breakfast. The waffles are priceless; the XLM is free.* 🥞

# Multi-pet foundation — design (Phase B-1)

**Date:** 2026-06-25
**Status:** approved, pre-plan
**Supersedes:** the original "Phase B: pet unlocks" handoff plan (buy-a-species into the shared `owned` set). The product direction changed to a **gacha + battle** collection game, which requires a multi-pet data model rather than a species-skin swap.

## Context

Sentence-pet is a Tamagotchi-style English sentence-builder for Thai M.4 students. Phase A shipped a decor shop with a generic `owned: string[]` ownership set + a cozy storybook PetRoom HUD. The next direction is a **pet collection** the player grows via **gacha**, with a future **Pokémon-style battle** (team of 3, per-pet HP/ATK/DEF/SPD/LUK stats).

This larger vision decomposes into three sub-projects, each its own spec → plan → build:

| # | Sub-project | Depends on | Delivers |
|---|---|---|---|
| **1** | **Multi-pet foundation** (this spec) | — | `pets[]` + `activePetId`, shared coin wallet, nurture/rewards rewired to the active pet, a PetRoom collection switcher, battle-stat rolling for owned pets, persist migrate v4→v5. |
| 2 | Gacha | 1 | Egg-pull UI, random species + rarity-tiered stats, coin cost, duplicates, reveal animation. Replaces the idea of a Shop "Pets tab". Also folds in the deferred Shop scroll-chain fix + a11y tab roles. |
| 3 | Battle | 1, 2 | Team of 3, HP/ATK/DEF/SPD/LUK combat. Multiplayer ("battle with friends") rides the future Firebase phase (gated on Blaze + Thai PDPA consent). |

**This spec covers only #1.** It builds the data model and surfaces everything #2 and #3 need, without building gacha or battle themselves (YAGNI).

## Goals

- Player owns **multiple pet instances**; duplicates of a species are allowed (each a distinct creature with its own rolled stats).
- One pet is **active** — the creature shown and nurtured in the PetRoom. Switching active is the player-facing feature shipped here.
- **Coins are an account-level wallet**, not per-pet (you spend coins to gacha later).
- Each pet carries innate **battle stats** (HP/ATK/DEF/SPD/LUK), rolled once at creation, displayed in the PetRoom (flavor now, battle-ready later).
- Existing save data migrates cleanly: the player's single pet becomes their first instance; their coins become the wallet.

## Non-goals (explicitly later)

- **Gacha pull UI + rarity tiering** — phase #2. Foundation rolls stats from a flat range only.
- **Battle engine / combat / multiplayer** — phase #3.
- **Shop scroll-chain fix + a11y tab roles** — deferred to #2, which rebuilds the Shop. Foundation barely touches the Shop (only the `pet.coins` → wallet read).
- **Shop "Pets tab" / PetCard / shared ShopItemCard** — dropped; gacha (#2) replaces the buy-a-species flow entirely.

## Data model (`src/data/types.ts`)

```ts
export interface BattleStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  luk: number;
}

export interface PetInstance {
  id: string;          // unique; 'starter-leaf' for the seeded/migrated first pet
  species: Species;    // leaf | fire | air | water
  hatched: boolean;    // egg ceremony still gates the FIRST pet
  xp: number;
  happiness: number;
  bars: NutritionBars;
  stats: BattleStats;  // rolled once at creation, immutable thereafter
}
```

`coins` is **not** on `PetInstance` — it moves to root state.

## Root state (`src/state/gameStore.ts`)

Replace the single `pet: Pet` with:

- `pets: PetInstance[]`
- `activePetId: string` — **invariant: always resolves to a member of `pets`** (guaranteed by fresh state, migrate, and a guarded `switchPet`).
- `coins: number` — shared wallet (lifted out of `pet.coins`).

Unchanged: `screen`, `inventory`, `selectedDrill`, `selectedLevel`, `lastReward`, `owned`, `activeBackground` (the last two are decor — untouched by this work).

Active-pet accessor (selector helper, used by store actions and components):

```ts
const selectActivePet = (s: GameState): PetInstance =>
  s.pets.find((p) => p.id === s.activePetId)!; // invariant guarantees a hit
```

### Actions rewired to the active pet

- `finishRound`: xp / happiness / bars applied to the **active** pet (map `pets`, update the matching id); **coins added to the root wallet**; `lastReward` unchanged.
- `feed`: feeds the **active** pet's bars.
- `buyTreat`: spends **root coins**; boosts the **active** pet's happiness.
- `buyDecor`: spends **root coins** (was `pet.coins`); `owned`/`activeBackground` logic unchanged.
- `hatch`: flips the **active** pet's `hatched` to true. **`pickSpecies` is removed** — species no longer randomizes on hatch; the seed pet is leaf, and gacha (#2) becomes the species randomizer. (`src/domain/species.ts` / `pickSpecies` go unused by the app; leave the module + its tests in place, to be removed or repurposed in #2.)
- `stage()`: `stageForXp(activePet.xp, activePet.hatched)`.
- **new `switchPet(id: string)`**: sets `activePetId` only if `id` exists in `pets` (guards the invariant); no-op otherwise. This is the collection switcher action.
- test/dev helpers: `addCoinsForTest` → root wallet; `addXpForTest` → active pet; `resetForTest` → seeded single-leaf fresh state.

## Domain (new `src/domain/pets.ts`)

Pure, unit-tested with a seeded RNG (matches the project's "real logic in pure modules" convention).

```ts
// each stat rolled in a flat range; rarity/price tiering is gacha phase #2
export function rollStats(rng: () => number): BattleStats; // each stat ∈ [40, 90]

export function makePet(args: {
  id: string;
  species: Species;
  stats: BattleStats;
  hatched?: boolean; // default false
}): PetInstance; // fresh xp=0, happiness/bars from GAME_CONFIG
```

IDs: the **store** generates ids via `crypto.randomUUID()` when creating pets at runtime; the **factory** takes `id` as a param so tests stay deterministic. The seeded/migrated first pet uses the fixed id `'starter-leaf'`.

## Fresh state + persist migrate (v4 → v5)

Fresh state:

```ts
pets: [ makePet({ id: 'starter-leaf', species: 'leaf', stats: rollStats(rng), hatched: false }) ],
activePetId: 'starter-leaf',
coins: 0,
```

Migrate is **non-additive** (it restructures `pet` → `pets` and lifts `coins`) — the first migration that genuinely needs **version-branching**. The handoff noted the existing `migrate` ignores its `version` arg; this bump fixes that for the v<5 path:

- transform old `{ pet: { species, xp, happiness, bars, hatched, coins } }` into
  `pets: [ { id: 'starter-leaf', species, xp, happiness, bars, hatched, stats: rollStats(rng) } ]`,
  `activePetId: 'starter-leaf'`, `coins: old.pet.coins ?? 0`.
- keep `inventory`, `owned`, `activeBackground`, `selectedDrill`/`selectedLevel`.
- earlier additive backfills (v1→v4) still apply before the v<5 restructure.

Migrate test (against the real `persist.getOptions().migrate`): asserts `pets.length === 1`, species preserved, `activePetId === 'starter-leaf'`, coins lifted to wallet, `stats` present with every field in `[40, 90]`.

## Collection switcher (PetRoom)

In the carved warm bottom panel:

- an **egg-chip row** — one chip per owned pet showing `ELEMENTAL_EGGS[species]` + `PET_NAME[species]`. The **active** chip is highlighted; tapping a chip calls `switchPet(id)`.
- a compact **active-pet battle-stats readout** (HP/ATK/DEF/SPD/LUK) — flavor now, the "see my pet" payoff, battle-ready later.
- all existing `pet.*` reads become `activePet.*`; coins read from the root wallet.
- a11y: each chip carries an `aria-label` (`Switch to {name}` / `{name} (active)`); unique accessible names to avoid the multi-match `getByRole` trap noted in the handoff.

## Other affected files

- `App.tsx`, `Shop.tsx` (coins read `s.pet.coins` → `s.coins`), `DevPanel.tsx` (xp/coins/stage/hatch/reset → active pet + wallet), `EggHatch.tsx` (`hatch` action signature unchanged).
- Tests updated to the new shape: `gameStore.test`, `PetRoom.test`, `Shop.test`, `DevPanel.test`, `TreatCard.test` (any `pet.coins` references).

## Testing approach

TDD throughout. jsdom can't drive @dnd-kit/framer-motion, so:

- **pure modules** (`rollStats`, `makePet`) — seeded-rng unit tests (range, shape, determinism).
- **store** — action tests: `switchPet` changes active (+ guards bad id), `finishRound` credits active pet xp & root wallet, `feed`/`buyTreat`/`buyDecor` hit active pet + wallet, two pets level independently.
- **migrate** — against the real `persist.getOptions().migrate`.
- **components** — render-only: chip row renders one per pet, active highlighted, switch-click changes the displayed pet/stats. Mock `canvas-confetti` in any test transitively importing `effects/celebrate`.

Green bar = all existing 191 tests + new tests pass (`npm test -- --run`), `npm run build` clean, **`npx tsc -b`** clean (never `tsc --noEmit` — root tsconfig `files:[]` makes it a no-op).

## Risks

- **`activePetId` invariant** — every path that mutates `pets` must keep ≥1 pet and a valid active id; `switchPet` validates; fresh/migrate guarantee the seed pet.
- **Non-additive migrate** — first of its kind; covered by a dedicated migrate test.
- **Wide blast radius** (~9 files) — controlled via subagent-per-task TDD with main-thread review between tasks.

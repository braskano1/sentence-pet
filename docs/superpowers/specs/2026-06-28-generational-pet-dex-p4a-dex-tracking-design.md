# Design — Generational Pet Dex P4a: Dex tracking + evolution-chain detail

**Date:** 2026-06-28
**Repo:** `sentence-pet` — checkout `D:/ai_projects/AI_design_thinking/sentence-pet`
**Branch:** `journey-redesign` (integration branch; do NOT merge to `main`).
**Slice:** P4a of the P4+ end-game epic (`docs/superpowers/plans/2026-06-28-generational-pet-dex-p4-plus-handoff.md`).
**Predecessors:** `[[sentence-pet-generational-dex-p3b]]`, `[[sentence-pet-admin-petdef-hydration-fix]]`.

## Goal

Record which `PetDef`s the player has obtained and surface them in a **Dex** tab inside the
Collection screen: every enabled `PetDef` shown caught (full art) or undiscovered (silhouette).
Tapping a dex tile opens a detail view of that pet's **evolution chain** (def-chain, Axis 2).
This is the foundation for obtainability (P4b) and reward pets (P4c).

## Decisions (locked in brainstorm)

- **One persisted "caught" flag** (no seen-vs-caught distinction — YAGNI).
- **Persisted accumulating set**, not a derived selector. Rationale: must survive a future
  pet-release/sacrifice feature (pet leaves `pets[]` but stays recorded in the dex). The set
  accumulates; defIds are only ever added.
- **Dex entry = one per `PetDef`** (not one per growth stage). Stage growth
  (`egg→baby→young→adult`, Axis 1) is the same `defId`/dexNo and does NOT create entries.
  A multi-form evolution line is authored as multiple linked `PetDef`s (`evolvesToId`, Axis 2)
  and shows as multiple dex numbers — the real-Pokemon model. The existing `gen`/`dexNo` model
  already supports this.
- **Dex tile art = highest (adult) stage**, stable catalog look regardless of owned pet level.
- **Dex lives as a tab inside `Collection.tsx`** (`My Pets` | `Dex`); existing owned-pet roster
  is untouched.
- **Tile click → evolution-chain detail** for that def.

## Two "evolutions" — do not conflate

- **Axis 1 — Stage:** `egg→baby→young→adult` growth of one `PetInstance` by leveling. Same
  `defId`. Art shared per element. NOT a dex axis.
- **Axis 2 — Def-chain:** separate `PetDef`s linked by `evolvesFromId`/`evolvesToId`, each its
  own `gen`/`dexNo`. THIS is the dex/chain axis. Runtime transform between defs is P4d (unwired);
  P4a only *displays* the authored chain.

## Architecture

### 1. State — persisted accumulating caught set (`src/state/gameStore.ts`)

- Add field `caughtDefIds: string[]` to `GameState`, `PersistedState`, and `selectPersisted`.
- **Bump `PERSIST_VERSION` 16 → 17** (`gameStore.ts:109`).
- Migration step v16 → v17: seed `caughtDefIds` from the union of existing `pets[].defId`
  (defensive: `?? []`, dedupe). Old saves keep their full caught history derived from owned pets.
- `freshState`: `caughtDefIds: [starterDef().id]` (starter pet is present from game start).
- Tiny pure helper `addCaught(caught: string[], defId: string): string[]` — returns a new array
  with `defId` unioned (no dup). Call it at both pet-add sites:
  - gacha pull (`gameStore.ts:384`)
  - reward-egg path (`gameStore.ts:279`-ish, inside `finishBoss`/lesson reward)
  Each site already builds the new pet with a `defId`; union that defId into `caughtDefIds`.
- Selector `selectCaughtSet = (s) => new Set(s.caughtDefIds)` for O(1) membership in the UI.

### 2. Domain helper — evolution chain (`src/domain/dex.ts`, new, pure)

```ts
/** Ordered evolution chain containing `def`: walk evolvesFromId to the root,
 *  then evolvesToId forward. Cycle-guarded. No links → [def]. */
export function evolutionChain(def: PetDef, defs: readonly PetDef[]): PetDef[]
```

- Build `byId` map. Walk back via `evolvesFromId` to the root, guarding against cycles with a
  `seen` set. Then walk forward from the root via `evolvesToId`, collecting in order, same guard.
- Validation (`content/validate.ts`) already rejects cycles and dangling refs at author time;
  the guard here is defensive belt-and-suspenders so a bad catalog can never infinite-loop the UI.

### 3. UI — `Collection.tsx` tabs

- Local `const [tab, setTab] = useState<'pets'|'dex'>('pets')`. No store change (transient view).
- Header gets a two-button tab toggle. `'pets'` renders the existing roster + active-pet detail
  exactly as today (no behavior change). `'dex'` renders `<DexGrid>`.

### 4. UI — `DexGrid` (new component, `src/components/DexGrid.tsx`)

- Source: `getActivePetDefs().filter(d => d.enabled)`, sorted by `gen` then `dexNo`.
- `const caught = selectCaughtSet(store)`.
- One tile per def:
  - Art: `spriteSrc(def.element, 'adult', 'happy', def)`.
  - Caught (`caught.has(def.id)`): full-color art + `def.name` + `#NNN` (dexNo, zero-padded).
  - Uncaught: same sprite with `style={{ filter: 'brightness(0)' }}` silhouette + `???` label;
    dexNo still shown.
- Header line: `Caught {caughtCount} / {total}`.
- Tile click → set selected def → render `<DexDetail def=… onClose=… />` (modal/overlay).

### 5. UI — `DexDetail` (new component, `src/components/DexDetail.tsx`)

- `const chain = evolutionChain(def, getActivePetDefs())`.
- Render chain left→right; an arrow (→) between consecutive nodes.
- Each node: caught → full art + name; uncaught → silhouette + `???`. Always show its dexNo.
- Below: selected def's `element` (emoji + name), `types`, dexNo. Close button.
- Single-entry chain (no links) renders one node — graceful.

## Data flow

```
pet added (gacha/reward) ──▶ addCaught(caughtDefIds, pet.defId) ──▶ persisted
Collection 'dex' tab ──▶ DexGrid reads getActivePetDefs() + selectCaughtSet
DexGrid tile click ──▶ DexDetail(def) ──▶ evolutionChain(def, defs)
```

## Error handling / edge cases

- Old saves with no `caughtDefIds`: migration seeds from `pets[]`; `?? []` defensive read.
- Orphaned defId in `caughtDefIds` (def later disabled/deleted): not in
  `getActivePetDefs().filter(enabled)`, so it simply isn't shown. Harmless.
- Never-blank invariant: dex art goes through `spriteSrc`, which already falls back to element art.
- Cycle / dangling evolution refs: `evolutionChain` cycle-guard prevents infinite loop even if a
  bad catalog slips past validation.

## Testing

Append to existing files; never clobber. Verify a "create" target doesn't already exist.

- `src/domain/dex.test.ts` (new): `evolutionChain` — lone def, linear 3-stage, start from mid-chain,
  cycle guard, dangling ref. `addCaught` — add new, add dup (no-op).
- `src/state/gameStore.test.ts` (append): migration v16→v17 seeds `caughtDefIds` from `pets[]`;
  gacha pull / reward grant unions the pulled defId into `caughtDefIds`; `freshState` has starter.
- `src/components/Collection.test.tsx` (append): tab toggle renders Dex; caught def shows full art,
  uncaught shows silhouette/`???`; `Caught X / Y` count; tile click opens `DexDetail` showing chain.

## Verify gate

`npm test`, `npx tsc -b` (NOT `--noEmit`), `npm run build`. Flaky Windows worker-fork crash
("Worker exited unexpectedly") → re-run, not a real failure.

## Conventions / hazards

- **Never `git add -A`** — stage explicit files (concurrent-session contamination).
- **Append, don't overwrite** test files — subagent listings miss subdir test files (has clobbered
  files before).
- `src/content/seed.ts` is generated — do not hand-edit (not touched by this slice).
- Pure domain (`evolutionChain`, `addCaught`) stays pure — pass `defs` in, no registry reach-in.

## Out of scope (later slices)

- P4b gacha-over-the-dex (defId assignment + obtainability) — but P4a's `addCaught` at the pull
  site means P4b's defId flows into the dex automatically once gacha assigns one.
- P4c reward pets; P4d def-chain runtime transform.
- Evo/Gacha custom-art threading; orphan-sprite cleanup.

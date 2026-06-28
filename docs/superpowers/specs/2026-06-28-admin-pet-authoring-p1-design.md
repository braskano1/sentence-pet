# Spec — Admin Pet Authoring P1: data-driven pet definitions + persistence + migration

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell)
**Branch:** `journey-redesign` (integration branch — commit here, do NOT merge to `main`)
**Phase:** P1 of 4 (see handoff `docs/superpowers/plans/2026-06-28-admin-pet-authoring-handoff.md`)
**Status:** Design approved, ready for implementation plan.

## Goal

Introduce a data-driven **pet definition** (`PetDef`) — the authorable creature — split from the fixed
4-element battle taxonomy, plus its persistence layer and the migration that gives every `PetInstance`
a stable `defId`. **No admin UI** (that is P2). **No sprite upload** (P3). **No gacha-pool/course
reward wiring** (P4). P1 ships the model, the built-in registry, Firestore persistence, and the
migration — green tests + build — without changing how any existing consumer reads `species`.

## Scope decisions (settled in brainstorming — do not re-litigate)

1. **Keep element, add creature.** `PetInstance.species` stays = element (drives the matchup wheel,
   unchanged). A new required `PetInstance.defId: string` names the authored creature. `PetDef.element`
   is one of the fixed 4. This is the keep-element-add-defId split from the handoff.
2. **`defId` is required** (hard migration backfills every existing pet). No optional/two-path variant.
3. **Stages stay global.** All defs use the existing `STAGE_LEVEL = {baby:1,young:16,adult:36}`. `PetDef`
   carries no stage config. (`src/domain/xp.ts` untouched.)
4. **Stat bands per-rarity, on the def.** `PetDef.statBands: Record<Rarity, Record<keyof BattleStats,
   [min,max]>>` — matches today's rarity-banded gacha so authored creatures plug into the existing
   roll pipeline later.
5. **Starter is data-driven.** A `starter` flag on `PetDef` marks the first-egg creature. The built-in
   leaf def carries it; `freshPet()` stamps the starter def's id (keeping `species:'leaf'`).
6. **Firestore: single doc.** `content/petDefs` → `{ defs: PetDef[] }`. The catalog is small; one
   fetch / one validate / one cache. (Courses use per-id docs because each course is large; defs are not.)
7. **Thin P1.** Existing consumers (gacha stat-roll, `spriteSrc`, battle, collection, bosses) keep
   reading `species` exactly as today. Routing resolution through the def registry is deferred to P2+.
   P1 only lands the field, the registry, persistence, and migration.

## Current state (grounded 2026-06-28 — verified)

- **Model** `src/data/types.ts`: `Species` L102 (`'leaf'|'fire'|'air'|'water'`), `Rarity` L104
  (`'common'|'rare'|'epic'|'legendary'`), `PetStage` L88, `BattleStats {hp,atk,def,spd,luk}` L108–114,
  `NutritionBars` L93–98, `PetInstance` L117–128 (`id, species, hatched, xp, happiness, bars, stats,
  growth, rarity, name` — no `defId` today).
- **Domain** `src/domain/pets.ts`: `makePet(args:{id,species,stats,rarity,name?,hatched?})` L75 (no
  `defId` arg today), `rollStats`, `rollRarity`, `rollStatsForRarity(rarity,rng,table)`, `rarityForStats`,
  `allocateStatPoints`. `src/domain/species.ts`: `SPECIES` const L4, `pickSpecies`, `moodFor`.
  `src/domain/xp.ts`: `STAGE_LEVEL` L9.
- **Sprites** `src/config/sprites.ts`: static `SPRITES: Record<Species,Record<stage,Record<mood,string>>>`,
  `spriteSrc(species,stage,mood)` L67. Bundled `.webp` imports. (Untouched in P1.)
- **Gacha** `src/domain/gacha.ts` `pullEgg` L16–26 (rng: rarity → species uniform → stats from
  `table`); config `src/config/gameConfig.ts` `gacha.rarities` (per-rarity weights + stat bands).
  `src/state/gameStore.ts` `pullEgg` action L376–384.
- **Persistence** `src/state/gameStore.ts`: `PERSIST_VERSION = 15` L108; `PersistedState` Pick L111–115
  (includes `pets`, `activePetId`); `selectPersisted` L117–137; `freshState()` L176–201 (`pets:[freshPet()]`,
  `activePetId: STARTER_ID`); `freshPet()` L168–170 (`makePet({id:STARTER_ID, species:'leaf',
  stats:rollStats(rng), rarity:'common', hatched:false})`); `STARTER_ID = 'starter-leaf'` L22; `migrate`
  L461–568 (cumulative chain; v13→14 backfills `l1Mode ?? 'TH'`; v14→15 backfills `courseComplete ?? {}`).
- **Cloud sync** `src/sync/mapping.ts`: `PetDoc = PetInstance` alias L7; `toCloud` splits `pets` out of
  profile L19–22; `fromCloud` rejoins L24–29. `src/sync/cloudSync.ts` debounced; saves profile + pet docs
  separately. `src/sync/reconcile.ts` reconciles.
- **Content pattern (mirror)** `src/content/validate.ts` `validateCourse`/`validateContent`;
  `src/content/load.ts` `hydrateContent`/`hydrateCourse`/`loadCoursesIndex`; `src/firebase/content.ts`
  `saveCourse` + Firestore layout (`content/coursesIndex`, `content/courses/{id}/doc`, legacy
  `content/pool`, `content/journey`); `src/content/cache.ts` `cachedCourse`/`writeCourseCache`.
- **Seed** `src/content/seed.ts`: generated, header says "Do NOT hand-edit … regenerate with
  `npm run seed:export`" (`scripts/export-seed.ts`).

## Design

### 1. New entities

`PetDef` type (in `src/data/types.ts`, near `Species`/`PetInstance`):

```ts
export type StatRange = [min: number, max: number];

export interface PetDef {
  id: string;          // stable, course-referenceable later (P4 rewardPetDefId)
  name: string;
  element: Species;    // one of the fixed 4 — drives the matchup wheel
  statBands: Record<Rarity, Record<keyof BattleStats, StatRange>>;
  starter?: boolean;   // marks the first-egg creature (exactly one def true)
  enabled: boolean;    // gacha-pool gate; P1 stores only, P4 reads it
}
```

`PetInstance` gains one required field:

```ts
export interface PetInstance {
  id: string;
  defId: string;       // NEW — the authored creature
  species: Species;    // element, unchanged (matchup wheel)
  // …existing fields unchanged…
}
```

### 2. Built-in registry + resolution (`src/content/petDef.ts`, new)

- `BUILTIN_PET_DEFS: readonly PetDef[]` — 4 defs, one per element (`leaf`,`fire`,`air`,`water`).
  - Each def's `statBands` extracted from today's `GAME_CONFIG.gacha.rarities` stat bands (same numbers
    today across all elements). A unit test asserts the extracted bands reproduce the existing
    `rollStatsForRarity` output for each rarity.
  - `leaf` def: `starter: true`. All four: `enabled: true`.
  - Built-in ids are stable constants (e.g. `def-leaf`, `def-fire`, `def-air`, `def-water`).
- Resolution helpers (pure, registry passed in or default to active registry):
  - `resolvePetDef(defId, defs): PetDef` — id lookup; falls back to element-default, then the starter def.
    Never returns null (never-blank discipline).
  - `defaultDefForElement(element, defs): PetDef` — the built-in def for that element.
  - `starterDef(defs): PetDef` — the def flagged `starter` (built-in: leaf).
- The "active registry" is the hydrated catalog (Firestore) when present, else `BUILTIN_PET_DEFS`.

### 3. Persistence (mirror course discipline; single-doc)

- **Firestore:** `content/petDefs` → `{ defs: PetDef[] }`. (New constant alongside the course paths in
  `src/firebase/content.ts`.)
- **Validate** `validatePetDefs(defs: PetDef[]): {ok, errors[]}` (in `src/content/validate.ts` or a sibling):
  - ids unique and non-empty; `name` non-empty; `element ∈ SPECIES`;
  - `statBands` present for every `Rarity`, every `BattleStats` key, each `[min,max]` with `min ≤ max`
    and `min ≥ 0` (no upper cap enforced — match the looseness of today's gacha bands);
  - exactly one def has `starter === true`;
  - at least one def `enabled`.
- **Fetch/save** `fetchPetDefs()`, `savePetDefs(defs)` in `src/firebase/content.ts` (mirror `saveCourse`).
- **Hydrate** `hydratePetDefs()` in `src/content/load.ts` — cache-first, validate, swap into the active
  registry; seed/built-in fallback so a cold or failed load never blanks (mirrors `hydrateCourse`).
- **Cache** `cachedPetDefs()` / `writePetDefsCache(defs)` in `src/content/cache.ts` (localStorage).
- **Seed:** built-ins are the bundled fallback. If a `content/petDefs` seed is exported, follow the
  generated `seed:export` pattern — do not hand-edit `seed.ts`. (P1 can ship with `BUILTIN_PET_DEFS` as
  the sole fallback and no Firestore seed row required; admin authoring in P2 populates Firestore.)
- **No admin UI in P1.** Nothing writes `content/petDefs` yet; P1 only reads/hydrates with built-in fallback.

### 4. Migration + write paths (`src/state/gameStore.ts`, `src/domain/pets.ts`, `src/domain/gacha.ts`)

- `makePet` arg gains required `defId`; sets `defId` on the returned instance.
- `freshPet()` → `makePet({ id: STARTER_ID, defId: starterDef().id, species: 'leaf', … })`. Keeps
  `species:'leaf'` and `id:'starter-leaf'` so the freshState invariants hold; adds `defId`.
- `pullEgg` (domain `src/domain/gacha.ts`) stamps `defId: defaultDefForElement(species).id` after the
  species roll. RNG order unchanged (rarity → species → stats).
- **`PERSIST_VERSION` 15 → 16.** New migrate step (after the v14→15 step, cumulative-chain style):
  for every pet lacking `defId`, set `defId = defaultDefForElement(pet.species).id`. Idempotent; legacy
  saves resolve to the correct element default.
- **Cloud sync:** `PetDoc = PetInstance` alias picks up `defId` with no signature change. Legacy cloud
  pet docs (no `defId`) are backfilled when loaded — confirm `fromCloud` output flows through the same
  migrate backfill (or add an explicit backfill in the sync load path) so cloud-restored pets are never
  missing `defId`. Update `mapping` / `reconcile` / `cloudSync` test fixtures to carry `defId`.

## Out of scope (P1) — noted for later phases

- **P2** — admin "Pets" catalog tab (CRUD over `content/petDefs`, validate-gates-save, a11y). The Bosses
  tab's hardcoded species/stage dropdowns can later source from the catalog.
- **P3** — `PetDef.sprites` (per-stage × mood Storage URLs), dynamic `spriteSrc` with built-in fallback,
  Storage rules + emulator. (P1 reuses existing element art via `species`; `PetDef` has no `sprites` field yet.)
- **P4** — gacha pool sourced from `enabled` defs + weights; course/boss `rewardPetDefId` referencing
  pet-def ids. Stat-roll routed through `def.statBands` (P1 only stores the bands).
- `firebase.json` is **not** touched in P1 (Storage emulator is P3). Leave it modified-but-unstaged.

## Testing & gates

- `src/content/petDef.test.ts` (new): `validatePetDefs` happy path + each failure (dup id, empty name,
  bad element, missing/inverted band, zero or multiple starters, none enabled); `resolvePetDef` /
  `defaultDefForElement` / `starterDef` incl. fallbacks; built-in `statBands` reproduce existing
  `rollStatsForRarity` output per rarity.
- `gameStore` migrate v15→16: legacy pet (no `defId`) → correct element default; freshState invariants
  (`pets[0].id='starter-leaf'`, `species='leaf'`, `length===1`, `coins===0`) hold and `pets[0].defId`
  is the starter def id.
- `pullEgg` domain: pulled pet has `defId === defaultDefForElement(species).id`.
- Sync fixtures (`mapping`/`reconcile`/`cloudSync`): round-trip `PetInstance` with `defId`; legacy cloud
  pet without `defId` is backfilled on load.
- **Gates:** `npm test`, `npm run build`, `npx tsc -b` (type gate is `tsc -b`, NOT `--noEmit`).

## Landmines (carried)

- `PersistedState` change touches the chain: `GameState`, `freshState`, the `PersistedState` Pick (already
  includes `pets`, so no Pick edit needed — `defId` rides inside `PetInstance`), `selectPersisted`,
  `migrate` backfill, `PERSIST_VERSION` bump, and the cloud-sync fixtures. Reference patterns: `l1Mode`
  (v14), `courseComplete` (v15).
- `Species` union stays load-bearing and unchanged; do not turn it into a free string. The split keeps the
  matchup wheel intact.
- Never-blank: registry always resolves to a def (built-in fallback); cold/failed catalog load falls back
  to `BUILTIN_PET_DEFS`.
- Stage explicit files only — never `git add -A`. Do not stage/commit `firebase.json`.
- `src/content/seed.ts` is generated — do not hand-edit.

# Design — Generational Pet Dex (`PetDef` v2) + Admin Authoring (P2)

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell)
**Branch:** `journey-redesign` (integration branch — commit here, do NOT merge to `main`; the whole drill-revamp + pet-authoring line promotes as one release later)
**Status:** Design approved; ready for implementation planning.
**Supersedes:** the narrower "Admin Pets Tab (P2)" handoff (`docs/superpowers/plans/2026-06-28-admin-pets-tab-p2-handoff.md`). That handoff scoped P2 as flat CRUD over the P1 model. This design widens P2 into a **generational dex** epic: the catalog becomes generation-aware (gens, per-gen dex numbers, expandable types, evolution chains) and the admin authors it. The 4-phase umbrella shifts accordingly.

## Goal

Turn the pet-def catalog into a **generational Pokédex-style structure** an admin authors over time. This phase delivers the *structure*, not the content: the data model, validation, migration, and the authoring UI. The user fills in the actual creatures (e.g. Gen 1's 150 entries) later through the admin UI — we ship an empty-but-capable dex, seeded only by the existing builtins.

Sprites, obtainability/gacha, dex tracking, and evolution *execution* are explicitly out of this phase (see Phasing). Evolution is **structured and validated** here but nothing triggers an evolution until P4.

## What P1 already built (reuse — do NOT rebuild)

- **Type:** `PetDef { id, name, element: Species, statBands: Record<Rarity, Record<keyof BattleStats, StatRange>>, starter?, enabled }` (`src/data/types.ts`). `StatRange = readonly [min,max]`.
- **Registry:** `src/domain/petDef.ts` — `BUILTIN_PET_DEFS` (1 per element, leaf=starter), `getActivePetDefs()`, `setActivePetDefs(defs)` (rejects empty → builtins), `defaultDefForElement`, `starterDef`, `resolvePetDef`. Module-level mutable `active`, defaults to builtins (never-blank).
- **Validation:** `validatePetDefs(defs): {ok, errors[]}` (`src/content/validate.ts:128`) — dup ids, empty id/name, element ∈ SPECIES, every rarity+stat band present, min≤max & min≥0, exactly one `starter`, ≥1 `enabled`.
- **Persistence:** `fetchPetDefs()`, `savePetDefs(defs)` (single doc `content/petDefs` → `{defs}`, `setDoc`) in `src/firebase/content.ts`. `cachedPetDefs()` / `writePetDefsCache(defs)` (`src/content/cache.ts`). `hydratePetDefs()` (`src/content/load.ts`). Startup seed+hydrate wired in `main.tsx`.
- Every `PetInstance` carries `defId`; `makePet` defaults it from element. Consumers still read `species` (thin P1).
- **Admin surface:** `AdminShell.tsx` (Course draft, `type Tab = 'pool'|'journey'|'bosses'|'import'`); tabs `BossesTab`/`PoolTab`/`JourneyTab`/`ImportTab`/`ItemEditor` (+ tests). Admin gate: hash route `#admin`, `AdminRoute.tsx` requires `isAdmin`, DEV 🔑 sign-in (`npm run dev:admin` seeds `admin@test.dev`).

## Design decisions (locked in brainstorm 2026-06-28)

1. **Draft shape — A, self-contained `PetsTab`.** The tab owns its own `useState<PetDef[]>` draft, its own `validatePetDefs` gate, its own Save (`savePetDefs` → `setActivePetDefs` + `writePetDefsCache`). `AdminShell` only adds a `'pets'` tab button + conditional render. Course save logic stays untouched.
2. **Scope — authoring-only.** Admin creates/edits/deletes defs; they persist, validate, hydrate. Players do NOT yet obtain them; gacha still pulls hardcoded species. Obtainability lands in P4.
3. **statBands editor — per-rarity single band (8 inputs).** One editable `[min,max]` per rarity (4 rarities × min/max), applied to all 5 stats. Stored expanded into the per-stat `statBands` shape on save so the stored type is unchanged.
4. **id policy — editable + validate uniqueness.** `id` is the stable primary key, editable, uniqueness-validated. Evolution refs use `id`; validation catches dangling refs so a rename can't silently orphan a chain or a future `rewardPetDefId`.
5. **Invariant UX — block-in-UI + validate backstop.** Starter selection is exclusive; UI prevents deleting the last enabled def or the sole starter; `validatePetDefs` still gates Save.
6. **Seed — builtins-only.** No Firestore `content/petDefs` seed. Builtins are the sole fallback; admin populates the catalog via the UI.
7. **Dex numbering — per-gen index.** Each generation restarts: Gen 1 #1–N, Gen 2 #1–N. `(gen, dexNo)` is unique-together dex-ordering metadata.
8. **Evolution — structured now.** `evolvesFromId` / `evolvesToId` / `evolutionStage` on `PetDef`, authorable + validated. Execution (battle/leveling consuming it) deferred to P4.
9. **Starters — single global starter, pinned to Gen 1 / dex #1.** Exactly one def has `starter: true`, and that def must be `gen === 1 && dexNo === 1`.
10. **Types — expandable taxonomy, decoupled from art.** New `PetType` registry (string ids), seeded from the 4 current element names. `element: Species` stays separate as the art-family / fallback sprite source until P3.

## Model — `PetDef` v2

```ts
type PetType = string;   // expandable taxonomy id, member of the PetType registry
                         // NOT the 4 art families — decoupled from sprite source

interface PetDef {
  id: string;            // stable primary key — editable, unique (validate)
  name: string;
  gen: number;           // ≥ 1
  dexNo: number;         // ≥ 1; (gen, dexNo) unique across the catalog
  types: PetType[];      // ≥ 1; each ∈ PetType registry
  element: Species;      // art-family / fallback sprite source (1 of 4) until P3
  statBands: Record<Rarity, Record<keyof BattleStats, StatRange>>;
  evolvesFromId?: string;   // ref to another PetDef.id
  evolvesToId?: string;     // ref to another PetDef.id
  evolutionStage?: number;  // 1-based stage in its chain
  starter?: boolean;        // exactly one globally; must be the gen 1, dexNo 1 def
  enabled: boolean;
}
```

### PetType registry
- New module (e.g. `src/domain/petType.ts`): an expandable list of type ids plus a membership check (`isPetType` / `PET_TYPES`).
- **Seeded from the 4 current element names** so existing data + the builtins map cleanly and nothing breaks.
- Code (and, later, the admin) can extend the registry. `element: Species` is unchanged and remains the art source — types and art are independent axes.

## Validation — additions to `validatePetDefs`

On top of the P1 rules (unique `id`, non-empty `id`/`name`, `element ∈ SPECIES`, complete statBands, min≤max & min≥0, ≥1 `enabled`):

- `gen ≥ 1`; `dexNo ≥ 1`; **`(gen, dexNo)` unique** across the catalog.
- `types`: at least one; every entry ∈ PetType registry.
- **Evolution refs:** any set `evolvesFromId` / `evolvesToId` must reference an existing `PetDef.id`; **no cycles** in the evolution graph; `evolutionStage` (if present) consistent along a chain (monotonic from the chain root).
- **Starter:** exactly one def has `starter: true`, and that def satisfies `gen === 1 && dexNo === 1`.

Errors are returned in the existing `{ ok, errors[] }` shape and surfaced via the admin's `aria-live="polite"` error `<ul>`.

## Migration

- **Builtins (`BUILTIN_PET_DEFS`, code):** updated in place to v2 — `gen: 1`, `dexNo: 1..4`, `types` derived from each def's `element`, and the `dexNo === 1` def carries `starter: true`. (These are source, so updated directly, not migrated at runtime.)
- **Firestore `content/petDefs` (runtime):** `hydratePetDefs()` backfills missing `gen` / `dexNo` / `types` on any older stored docs so a pre-v2 catalog loads without blanking. Backfill is deterministic (e.g. gen 1, dexNo by stored order, types from element). Never-blank preserved — a failed fetch falls back to builtins.
- **No `PERSIST_VERSION` bump:** `PetInstance` gains no field; only the content-type `PetDef` (Firestore `content/petDefs`) changes, which has its own hydrate/backfill path. Flag at plan time if any task discovers a `PetInstance` change is actually needed.

## Authoring UI — `PetsTab.tsx` (Shape A)

Self-contained tab. Mirrors `BossesTab`/`AdminShell` conventions: controlled inputs, implicit `<label>`-wraps-input, `<select>` over enumerations, `<fieldset>/<legend>` for groups, full accessible names on icon/delete buttons, immutable patch updates, `aria-live` errors.

- **List:** grouped / filterable **by gen**; row per def shows `dexNo`, name, `element`, types, enabled state, starter badge; **edit** + **delete** per row; **add** button (creates a def with a generated id, next free `dexNo` in the selected gen, defaults from `defaultDefForElement`).
- **Edit form per def:**
  - `id` — text, editable, uniqueness-validated.
  - `name` — text.
  - `gen` — number input (≥1).
  - `dexNo` — number input (≥1; unique within gen).
  - `types` — multi-select over the PetType registry (≥1).
  - `element` — `<select>` over `SPECIES` (art-family / fallback sprite).
  - `enabled` — checkbox.
  - `starter` — exclusive control; selecting locks/requires the def to be gen 1 / dex 1 (UI guides this; validate enforces).
  - `statBands` — 8 inputs: per-rarity `[min,max]`, expanded into the per-stat shape on save.
  - **Evolution pickers** — `evolvesFromId` / `evolvesToId` as `<select>` of other defs (by name/id); optional `evolutionStage` number.
- **Save path:** validate-gates-save mirroring the Course flow — `validatePetDefs(draft)`, Save disabled on `!ok`, `aria-live` error `<ul>`, `await savePetDefs(draft)`, then `setActivePetDefs(draft)` + `writePetDefsCache(draft)` so the live registry + cache update without reload. Seed the draft from `getActivePetDefs()` (never blank).
- **AdminShell wiring:** add `'pets'` to the `Tab` union, a tab button, conditional `<PetsTab />`. Course draft/save untouched.

## Phasing (revised umbrella)

- **P1 — DONE.** Base `PetDef` model + persistence + migration.
- **P2 — this design. Splits into two reviewable slices at plan time:**
  - **P2a — model + validation + migration.** `PetDef` v2 fields, `PetType` registry, extended `validatePetDefs`, builtins updated to v2, `hydratePetDefs` backfill. No UI. Verified by unit tests + type gate.
  - **P2b — authoring UI.** `PetsTab.tsx` CRUD over the v2 model, AdminShell wiring, `PetsTab.test.tsx`. Verified by unit tests + manual emulator smoke.
- **P3 — later.** Per-`PetDef` sprite upload (overrides element art); Storage rules + emulator.
- **P4 — later.** Gacha pool sourced from `enabled` defs over the dex; dex tracking (seen/caught); obtainability; course/boss `rewardPetDefId`; **evolution execution** (battle/leveling triggers a chain).

## Out of scope (this design)

- Sprite upload / per-pet art (P3).
- Gacha obtainability, dex tracking UI, `rewardPetDefId` (P4).
- Evolution *execution* — structure + validation only here; nothing fires an evolution until P4.
- Authoring the actual creature content (the 150+ entries) — the user does this later through the UI.
- Sourcing the Bosses tab species/stage dropdowns from the catalog (follow-on; note, don't do).

## Tests

- **P2a:** unit tests for the new validate rules (bad gen/dexNo, dup `(gen,dexNo)`, empty/unknown types, dangling evolution ref, evolution cycle, starter not at gen1/dex1, missing starter); migration/backfill test (pre-v2 doc → hydrated v2); builtins still pass `validatePetDefs`.
- **P2b:** `PetsTab.test.tsx` mirroring `BossesTab.test.tsx`/`AdminShell.test.tsx` — add/edit/delete mutate the draft; validate gate blocks Save on dup id, dup `(gen,dexNo)`, 0/2 starters, no enabled, dangling/cyclic evolution; Save calls `savePetDefs` + swaps the registry; starter control is exclusive; delete is blocked for the last enabled / sole starter. Mock `savePetDefs` / `useAuth` like `AdminShell.test.tsx`.

## Landmines (carried + new)

- **Don't fold pet defs into the Course draft.** Separate content type, separate validate/save/hydrate. Shape A keeps it that way.
- **Swap the live registry after save** — `setActivePetDefs(draft)` + `writePetDefsCache(draft)`, or the running game won't see edits until reload.
- **Starter invariant is now two-part:** exactly one `starter: true` AND that def is gen 1 / dex 1. The UI must guide this; validate enforces it. The starter def is the first-egg creature (`freshPet`/`starterDef`).
- **`(gen, dexNo)` uniqueness** is a new failure mode — the add button should pick the next free `dexNo` to avoid accidental collisions.
- **Evolution refs by `id`** — a rename or delete that orphans a ref must be caught by validate (dangling ref) and not silently break a chain. No cycles.
- **`enabled` invariant:** ≥1 def enabled.
- **Never-blank:** seed the draft from `getActivePetDefs()`; a failed `fetchPetDefs` / `hydratePetDefs` falls back to builtins, never an empty editor.
- **Stage explicit files only**, never `git add -A` (concurrent sessions). **Never stage `firebase.json`** (intentionally modified-but-unstaged; Storage emulator is P3).
- **Two version-sentinel tests exist** if persistence is touched: `gameStore.test.ts` AND `gameStore.persisted.test.ts`. P2 should not need a `PERSIST_VERSION` bump (no `PetInstance` field change) — flag if a task thinks it does.
- **`src/content/seed.ts` is generated** (`npm run seed:export`); builtins-only here, so no `content/petDefs` seed — don't hand-edit the generated file.

## Dev / test harness (reuse)

- Emulators (auth :9099, firestore :8080); `npm run dev:admin` seeds `admin@test.dev` + `{admin:true}`; one-click 🔑 Dev admin sign-in on `/#admin` (DEV-only).
- Verify with `npm test`, `npm run build`, `npx tsc -b` (type gate is `tsc -b`, NOT `--noEmit`). Manual smoke offline against the emulator: open `/#admin`, dev sign-in, Pets tab, add/edit/delete (incl. gen/dexNo/types/evolution), save, reload → persists.

# Handoff — Generational Pet Dex P2b: the `PetsTab` authoring UI

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell)
**Branch:** `journey-redesign` (integration branch — commit here, do NOT merge to `main`; whole drill-revamp + pet-authoring line promotes as one release later).
**Status:** NOT STARTED. **P2a is DONE** (model + types registry + validate + migration, all merged on `journey-redesign`). Next agent: brainstorm only if a UI question is genuinely open, else go straight to plan → build (subagent-driven, two-stage review per task — same cadence P2a ran).
**Spec:** `docs/superpowers/specs/2026-06-28-generational-pet-dex-design.md` (the whole epic; the "Authoring UI — `PetsTab.tsx`" section is your scope).
**P2a plan (for reference):** `docs/superpowers/plans/2026-06-28-generational-pet-dex-p2a.md`.

## Goal

Build the self-contained **`PetsTab`** admin UI that CRUDs the `PetDef` v2 catalog: list defs grouped/filterable by gen; add/edit/delete; per-def form for all v2 fields incl. evolution pickers; validate-gates-save; swap the live registry on save. **Authoring-only** — no gacha/obtainability (P4), no sprite upload (P3). This is the surface that lets the user author Gen 1's creatures (and later gens) over time.

## What P2a already shipped (reuse — do NOT rebuild)

All on `journey-redesign`, verified `npx tsc -b` clean + 863 tests green:

- **`PetType` registry** — `src/domain/petType.ts`: `PET_TYPES: readonly PetType[]` (seeded from the 4 `SPECIES` element names) and `isPetType(t): t is PetType`. `type PetType = string` lives in `src/data/types.ts`. Extend `PET_TYPES` to add new types later.
- **`PetDef` v2** (`src/data/types.ts`): `{ id, name, gen, dexNo, types: PetType[], element: Species, statBands, evolvesFromId?, evolvesToId?, evolutionStage?, starter?, enabled }`. `gen`/`dexNo`/`types` are **required**; evolution fields optional.
- **Built-ins** (`src/domain/petDef.ts` `BUILTIN_PET_DEFS`): gen 1, dexNo 1..4, `types:[element]`, starter pinned to dexNo 1 (leaf). Registry helpers unchanged: `getActivePetDefs()`, `setActivePetDefs()` (re-floors empty → builtins), `defaultDefForElement`, `starterDef`, `resolvePetDef`.
- **Validation** (`src/content/validate.ts` `validatePetDefs(defs): {ok, errors[]}`): dup ids; empty id/name; element ∈ SPECIES; `gen>=1`; `dexNo>=1`; **`(gen,dexNo)` unique**; `types` non-empty & each `isPetType`; statBands complete & min≤max & min≥0; evolution refs exist; **no cycles** (each cycle reported once); `evolutionStage>=1` & strictly increasing along an `evolvesToId` chain; exactly one `starter` AND it must be `gen===1 && dexNo===1`; ≥1 `enabled`.
- **Persistence** (unchanged from P1): `fetchPetDefs()`, `savePetDefs(defs)` (`src/firebase/content.ts`, single doc `content/petDefs`); `cachedPetDefs()` / `writePetDefsCache(defs)` (`src/content/cache.ts`); `hydratePetDefs()` (`src/content/load.ts`).
- **Forward migration** — `src/content/petDefMigrate.ts` `backfillPetDefs(raw): PetDef[]` fills v2 defaults (gen 1, dexNo by order, types from element) on pre-v2 raw data; already wired into `cachedPetDefs` + `hydratePetDefs` BEFORE validate. **P2b will likely reuse `backfillPetDefs` as a draft-normalizer** before calling `validatePetDefs` on partially-filled drafts (see Landmines).

## Design decisions locked for P2b (from the spec — do NOT relitigate)

- **Shape A — self-contained `PetsTab`.** Tab owns its own `useState<PetDef[]>` draft (seed from `getActivePetDefs()`, never blank), its own `validatePetDefs` gate, its own Save. `AdminShell` only adds a `'pets'` tab button + conditional render. **Course draft/save stays untouched** (no coupling to the P3b course/admin work).
- **statBands editor = per-rarity single band (8 inputs).** One editable `[min,max]` per rarity (4 rarities × min/max), applied to all 5 stats. **Store expanded** into the per-stat `statBands` shape on save so the stored type is unchanged.
- **id = editable + uniqueness-validated** (stable primary key; evolution refs use it).
- **Invariant UX = block-in-UI + validate backstop.** Starter control is exclusive (selecting one clears others) and locked to gen 1 / dex 1; UI prevents deleting the last enabled def or the sole starter; `validatePetDefs` still gates Save.
- **Builtins-only seed** (no Firestore `content/petDefs` seed).

## Scope (the PetsTab)

1. **`src/components/admin/PetsTab.tsx` (new)** — self-contained. Mirror `BossesTab`/`AdminShell` conventions: controlled inputs, implicit `<label>`-wraps-input, `<select>` over enumerations, `<fieldset>/<legend>` groups, full accessible names on icon/delete buttons, immutable patch updates, `aria-live="polite"` error `<ul>`.
   - **List:** grouped/filterable **by gen**; row per def shows `dexNo`, name, `element`, types, enabled, starter badge; edit + delete per row; **add** button (generated id, next free `dexNo` in the selected gen, defaults from `defaultDefForElement`).
   - **Edit form per def:** `id` (text, editable), `name` (text), `gen` (number ≥1), `dexNo` (number ≥1), `types` (multi-select over `PET_TYPES`, ≥1), `element` (`<select>` over `SPECIES`), `enabled` (checkbox), `starter` (exclusive, locked to gen1/dex1), `statBands` (8 inputs per-rarity, expanded on save), **evolution pickers** (`evolvesFromId`/`evolvesToId` as `<select>` of other defs; optional `evolutionStage` number).
2. **Wire into `AdminShell`** (`src/components/admin/AdminShell.tsx`): add `'pets'` to `type Tab` (currently `'pool'|'journey'|'bosses'|'import'`), a tab button, conditional `<PetsTab />`. Do not touch the Course draft/save (`validateCourse`/`saveCourse`/`setCourse`) flow.
3. **Save path:** `validatePetDefs(draft)` (run `backfillPetDefs(draft)` first if drafts can be partial — see Landmines), Save disabled on `!ok`, `aria-live` error `<ul>`, `await savePetDefs(draft)`, then **`setActivePetDefs(draft)` + `writePetDefsCache(draft)`** so the live registry + cache update without reload.
4. **Tests:** `src/components/admin/PetsTab.test.tsx` mirroring `BossesTab.test.tsx`/`AdminShell.test.tsx` — add/edit/delete mutate the draft; validate gate blocks Save on dup id, dup `(gen,dexNo)`, 0/2 starters, no enabled, dangling/cyclic evolution; Save calls `savePetDefs` + swaps the registry; starter control exclusive; delete blocked for last-enabled / sole-starter. Mock `savePetDefs`/`useAuth` like `AdminShell.test.tsx`.

## Landmines / heads-ups (carried + new from the P2a final review)

- **Drafts are partial → normalize before validate.** A half-typed new def won't have valid `gen`/`dexNo`/`types`. `validatePetDefs` takes fully-typed `PetDef[]`. Run `backfillPetDefs(draft)` (or an equivalent draft-normalizer) before validating, mirroring the cache/hydrate pattern. The **add** button should set a real `gen`/`dexNo`/`types` up front so the draft is valid-by-construction where possible.
- **`(gen, dexNo)` uniqueness is a new failure mode.** The add button must pick the next free `dexNo` within the chosen gen to avoid accidental collisions.
- **Evolution refs are NOT reciprocal in the validator.** `A.evolvesToId = B` does not require `B.evolvesFromId = A`. The form should **auto-maintain reciprocity on save** (set the back-pointer when you set the forward one) so authors can't create one-directional links that pass validation but read wrong. (Alternatively, a reciprocity rule could be added to `validatePetDefs` — but the spec scoped validation in P2a; prefer handling it in the UI.)
- **`element` and `types` can diverge freely** (a `fire`-element def may have `types:['water']`) — intentional decoupling. Make the relationship explicit in the form so authors don't set them inconsistently by accident.
- **Swap the live registry after save** — `setActivePetDefs(draft)` + `writePetDefsCache(draft)`, or the running game won't see edits until reload (unlike Course, which uses `setCourse`).
- **Starter is two-part:** exactly one `starter:true` AND that def is gen 1 / dex 1. The UI must guide this; the starter def is the first-egg creature (`starterDef`/`freshPet`). Don't let an author orphan or duplicate it.
- **Never-blank:** seed the draft from `getActivePetDefs()` (always ≥ builtins); a failed `fetchPetDefs`/`hydratePetDefs` must not blank the editor.
- **Stage explicit files only**, never `git add -A` (concurrent sessions). **Never stage `firebase.json`** (intentionally modified-but-unstaged locally; Storage emulator is P3).
- **No `PERSIST_VERSION` bump** expected (no `PetInstance` change). Two sentinel tests exist if you ever touch persistence: `gameStore.test.ts` AND `gameStore.persisted.test.ts`.

## Out of scope (later phases)
- **P3** — per-`PetDef` sprite upload (overrides `element` art); Storage rules + emulator (`firebase.json` change).
- **P4** — gacha pool over the dex, dex tracking (seen/caught), obtainability, course/boss `rewardPetDefId`, **evolution execution** (battle/leveling triggering a chain). P2b authors the structure; nothing fires an evolution yet.
- Sourcing the Bosses tab species/stage dropdowns from the catalog (follow-on; note, don't do).

## Dev / test harness (reuse)
- Emulators (auth :9099, firestore :8080); `npm run dev:admin` seeds `admin@test.dev` + `{admin:true}`; one-click 🔑 Dev admin sign-in on `/#admin` (DEV-only).
- Admin gate: hash route `#admin` (`src/auth/adminEntry.ts`), `AdminRoute.tsx` requires `isAdmin`.
- Verify: `npm test`, `npx tsc -b` (NOT `--noEmit`), `npm run build`. Manual smoke offline against the emulator: `/#admin` → dev sign-in → Pets tab → add/edit/delete (incl. gen/dexNo/types/evolution) → save → reload → persists.

## Suggested skills for the next session
- `superpowers:writing-plans` → `superpowers:subagent-driven-development` — per-task, two-stage review (how P2a ran: 4 tasks, spec-review then quality-review each, final whole-feature review).
- `accessibility` — the new Pets admin form + list (full accessible names, aria-live errors, exclusive starter control, multi-select types).
- `superpowers:brainstorming` only if a real UI-shape question surfaces (e.g. the per-gen grouping/filter interaction, or the statBands 8-input layout) — most decisions are already locked in the spec.

# Handoff — Admin Pets Tab (P2): author the pet-def catalog (CRUD over existing element art)

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell)
**Branch:** `journey-redesign` (integration branch — commit here, do NOT merge to `main`; whole drill-revamp + pet-authoring line promotes as one release later)
**Status:** NOT STARTED. Next agent: brainstorm → spec → plan → build (subagent-driven, two-stage review per task), same cadence P1 ran.
**Phase:** P2 of 4. **P1 is DONE** (model + persistence + migration) — see `docs/superpowers/specs/2026-06-28-admin-pet-authoring-p1-design.md`, plan `...plans/2026-06-28-admin-pet-authoring-p1.md`, umbrella `...plans/2026-06-28-admin-pet-authoring-handoff.md`.

## Goal

Give an admin a UI to **author the pet-def catalog** — create / edit / delete `PetDef`s — persisted to Firestore `content/petDefs`, validated before save. P2 reuses the existing 4-element sprite art (NO sprite upload — that's P3). The catalog already loads/hydrates/migrates (P1); this phase adds the authoring surface.

## What P1 already built (reuse — do NOT rebuild)

- **Type:** `PetDef { id, name, element: Species, statBands: Record<Rarity, Record<keyof BattleStats, StatRange>>, starter?: boolean, enabled: boolean }` (`src/data/types.ts`). `StatRange = readonly [min,max]`.
- **Registry:** `src/domain/petDef.ts` — `BUILTIN_PET_DEFS` (1 per element, leaf=starter, bands from `GAME_CONFIG.gacha.rarities`), `getActivePetDefs()`, `setActivePetDefs(defs)` (rejects empty → builtins), `defaultDefForElement`, `starterDef`, `resolvePetDef`. Module-level mutable `active`, defaults to builtins (never-blank).
- **Validation:** `validatePetDefs(defs): {ok, errors[]}` (`src/content/validate.ts:128`) — dup ids, empty id/name, element ∈ SPECIES, every rarity+stat band present, min≤max & min≥0, exactly one `starter`, ≥1 `enabled`.
- **Persistence:** `fetchPetDefs(): Promise<PetDef[]|null>`, `savePetDefs(defs): Promise<void>` (single doc `content/petDefs` → `{defs}`, `setDoc`) in `src/firebase/content.ts`. `cachedPetDefs()` / `writePetDefsCache(defs)` (`src/content/cache.ts`). `hydratePetDefs()` (`src/content/load.ts`). Startup seed+hydrate wired in `main.tsx`.
- Every `PetInstance` carries `defId`; `makePet` defaults it from element. Consumers still read `species` (thin P1).

## Current state — the admin surface (grounded 2026-06-28, verify before relying)

- **`src/components/admin/AdminShell.tsx`** drafts a single **`Course`**: `type Tab = 'pool'|'journey'|'bosses'|'import'` (L12,19); `useState<Tab>('pool')`; `draft`/`setDraft` (L18) seeded from `useContentStore((s)=>s.course)`; `const validation = validateCourse(currentDraft)` (L24); `save()` (L26-36) gates on `validation.ok`, `await saveCourse(currentDraft)` then `setCourse(currentDraft,'live')`; Save button disabled when `!validation.ok` (L71); error display is an `aria-live="polite"` `<ul>` of `validation.errors` (L76-79). It does **NOT** touch pet defs (grep confirms no PetDef/savePetDefs/etc in `src/components/admin/`).
- **Admin tabs:** `BossesTab`, `PoolTab`, `JourneyTab`, `ImportTab`, `ItemEditor` (+ tests for each). Form convention (e.g. `BossesTab.tsx:12-69`): controlled inputs, implicit `<label>`-wraps-input, `<select>` over `SPECIES`, `<fieldset>/<legend>` for groups, `aria-label` on icon/delete buttons (e.g. `delete gate ${id}`), immutable `onPatch(partial)` → parent merges. Tabs are dumb: `<Tab course={course} onChange={onChange} />`, parent owns state.
- **Admin gate / access:** hash route `#admin` (`src/auth/adminEntry.ts` `isAdminEntry`); `AdminRoute.tsx` requires `isAdmin` (`token.claims.admin === true`, read in `AuthProvider.tsx:52`); DEV-only 🔑 **Dev admin sign-in** button (`AdminRoute.tsx:54`, uses `src/dev/adminAccount.ts`). `npm run dev:admin` seeds `admin@test.dev` + claim.
- **Admin tests:** `AdminShell.test.tsx` (mocks `useAuth`+`saveCourse`, seeds `useContentStore.setState()`, queries by role/label, `fireEvent`+`waitFor`); `BossesTab.test.tsx` (factory `course()`, render `<Tab course onChange={vi.fn()} />`, fire change on labeled input, assert callback arg). Mirror this for a `PetsTab.test.tsx`.

## The key design tension (resolve FIRST in brainstorm)

**Where does the Pets draft live?** The umbrella handoff said "a new tab in `AdminShell` with its own draft+save (NOT the Course draft), or a sibling route." Two clean shapes:

- **(A, recommended) Self-contained `PetsTab`:** the tab owns its own `useState<PetDef[]>` draft (seeded from `getActivePetDefs()` / `fetchPetDefs()`), its own `validatePetDefs` gate, its own Save (`savePetDefs` → `setActivePetDefs` + `writePetDefsCache`). `AdminShell` only adds a `'pets'` tab button + conditional render. **Course save logic stays untouched** — no risk to the P3b course/admin work. This keeps pet defs course-independent global content, as the umbrella handoff demands.
- **(B) AdminShell holds two drafts:** lift a `petDefs` draft + second validate/save into `AdminShell` next to the Course draft. More central but couples two unrelated content types in one shell and risks the existing save flow. Not recommended.

Go with **A** unless brainstorm surfaces a reason not to.

## The OTHER key scope decision (resolve FIRST in brainstorm)

**Does P2 make authored creatures obtainable, or is P2 authoring-only?** The umbrella handoff's P2 line said "players can now obtain admin-authored creatures," but P1 deliberately deferred **gacha-pool-from-catalog + obtainability to P4** (thin-P1 kept gacha/sprite/battle reading `species`). So:

- **(Recommended) P2 = authoring CRUD only.** Admin creates/edits/deletes defs; they persist, validate, hydrate. Players do NOT yet obtain them (gacha still pulls the 4 hardcoded species). Keeps gacha untouched; smallest reviewable slice; obtainability lands in P4 with the rest of the reward wiring. Demoable: author a def → save → reload → it's in the catalog, validated; the running registry swaps live.
- **(Alternative) P2 = authoring + minimal obtainability.** Also pull P4's gacha-pool slice forward: gacha rolls over `enabled` defs (by element) so authored stat/name variants are immediately obtainable. Bigger; touches `domain/gacha.ts` + `gameStore.pullEgg` + tests. Only do this if a player-facing P2 is required.

Pick authoring-only unless the user wants immediate player payoff. Whichever, **say so explicitly in the spec** — it changes the scope materially.

## Scope (assuming A + authoring-only)

1. **`PetsTab.tsx` (new):** CRUD list of pet defs.
   - List existing defs (name, element, enabled, starter badge) with **edit** + **delete** per row and an **add** button.
   - **Edit form** per def: `name` (text), `element` (`<select>` over `SPECIES`), `enabled` (checkbox), `starter` (radio/exclusive — exactly one across all defs), `id` (text; immutable once saved? decide — ids are course-referenceable in P4, so prefer generate-on-create + read-only, or validate-uniqueness on edit).
   - **statBands editor:** 4 rarities × 5 stats × [min,max]. That's heavy. Options to decide in brainstorm: (i) per-rarity single `[min,max]` applied to all 5 stats (matches the builtins + today's gacha — far simpler UI, 8 inputs); (ii) full per-stat grid (20×2 inputs). Recommend (i) for P2; full per-stat can come later if ever needed. If (i), store it expanded into the per-stat `statBands` shape on save so the type is unchanged.
   - Reuse `BossesTab`/`PoolTab` form conventions: controlled inputs, full accessible-name labels (P3b a11y pass), immutable patch updates.
2. **Wire into `AdminShell`:** add `'pets'` to `Tab`, a tab button, conditional render of `<PetsTab />`. If shape A, `PetsTab` is self-contained (no Course-draft coupling).
3. **Save path:** validate-gates-save mirroring the Course flow — `validatePetDefs(draft)`, Save disabled on `!ok`, `aria-live` error `<ul>` (copy AdminShell's pattern), `await savePetDefs(draft)`, then `setActivePetDefs(draft)` + `writePetDefsCache(draft)` so the live registry + cache update immediately. Seed the draft from `getActivePetDefs()` (or a fresh `fetchPetDefs()`), never blank.
4. **Tests:** `PetsTab.test.tsx` mirroring `BossesTab.test.tsx` — add/edit/delete mutate the draft; validate gate blocks save on bad input (dup id, 0/2 starters, no enabled); save calls `savePetDefs` + swaps registry. Mock `savePetDefs`/`useAuth` like `AdminShell.test.tsx`.

## Out of scope (later phases)
- **P3** — `PetDef.sprites` (per-stage × mood Storage URLs), sprite **upload** UI, dynamic `spriteSrc` with built-in fallback, Storage rules + emulator (`firebase.json` change). P2 reuses existing element art via `species`/`element`; `PetDef` gains no `sprites` field.
- **P4** — gacha pool sourced from `enabled` defs + weights; obtainability; course/boss `rewardPetDefId`. (Unless pulled forward per the scope decision above.)
- Sourcing the **Bosses tab** species/stage dropdowns from the catalog (follow-on; note it, don't do it).

## Landmines (carried + new)
- **Don't fold pet defs into the Course draft.** Separate content type, separate validate/save/hydrate (already separate in P1). Shape A keeps it that way.
- **Swap the live registry after save.** Unlike Course (which calls `setCourse`), pet defs live in the module-level registry — after `savePetDefs`, call `setActivePetDefs(draft)` + `writePetDefsCache(draft)` or the running game won't see edits until reload.
- **`starter` invariant:** exactly one def must have `starter:true` (validate enforces). The edit UI must make `starter` exclusive (selecting one clears others) or saving will fail the gate. Also: the **starter def is the first-egg creature** (`freshPet` uses `starterDef().id`) — deleting/renaming it is allowed but it must remain exactly one.
- **`enabled` invariant:** ≥1 def enabled (validate enforces).
- **Stable ids:** P4 will reference defs by `id` (`rewardPetDefId`). Prefer generate-id-on-create + read-only id, or strictly validate uniqueness + warn on rename. Don't let an edit silently orphan a future reference.
- **Never-blank:** seed the draft from `getActivePetDefs()` (always ≥ builtins). A failed `fetchPetDefs` must not blank the editor.
- **Stage explicit files only**, never `git add -A` (concurrent sessions). **Never stage `firebase.json`** (intentionally modified-but-unstaged; Storage emulator is P3).
- **Two version-sentinel tests exist** if you ever touch persistence: `gameStore.test.ts` AND `gameStore.persisted.test.ts` (P1 final-gate caught the 2nd). P2 should not need a PERSIST_VERSION bump (no `PetInstance` field change) — flag if you think you do.
- **`src/content/seed.ts` is generated** (`npm run seed:export`); if P2 wants a `content/petDefs` Firestore seed, follow the generated pattern, don't hand-edit. (P1 ships builtins as the sole fallback — a Firestore seed is optional.)

## Open decisions for brainstorming
- Shape A (self-contained PetsTab) vs B (AdminShell two-drafts). → recommend A.
- P2 authoring-only vs authoring+obtainability (gacha slice from P4). → recommend authoring-only.
- statBands editor: per-rarity single band (8 inputs, recommended) vs full per-stat grid (20 inputs).
- id policy: generate-on-create + read-only vs editable-with-uniqueness-validation.
- Delete-the-starter / delete-the-last-enabled UX: block in UI, or let validate reject on save?
- Do we add a `content/petDefs` Firestore seed (so non-builtin defs exist out of the box), or ship builtins-only and let admin populate?

## Dev / test harness (reuse)
- Emulators (auth :9099, firestore :8080); `npm run dev:admin` seeds `admin@test.dev` + `{admin:true}`; one-click 🔑 **Dev admin sign-in** on `/#admin` (DEV-only).
- P3b opt-in browser smoke harness: `e2e/p3b-smoke.spec.ts` (`RUN_P3B_SMOKE=1`) + `scripts/p3b-smoke-setup.mjs`; `dist-smoke/` gitignored. Mirror for a pets-catalog smoke if wanted.
- Verify with `npm test`, `npm run build`, `npx tsc -b` (type gate is `tsc -b`, NOT `--noEmit`); manual smoke offline against the emulator: open `/#admin`, dev sign-in, Pets tab, add/edit/delete, save, reload → persists.

## Suggested skills for the next session
- `superpowers:brainstorming` — pin shape A/B + authoring-only-vs-obtainability + statBands editor BEFORE planning.
- `superpowers:writing-plans` → `superpowers:subagent-driven-development` — per-task, two-stage review (how P1 ran: 7 tasks, spec-review then quality-review each, final whole-feature review).
- `accessibility` — the new Pets admin form + list (full accessible names, aria-live errors, exclusive starter control).
- `claude-api` is NOT relevant here.

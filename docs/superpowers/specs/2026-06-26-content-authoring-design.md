# Content Authoring — design (Firebase slice 2)

**Date:** 2026-06-26
**Slice:** 2 of 4 (Firebase). Builds on the foundation merged in PR #11 (`content/{doc=**}` already public-read + admin-write; `AdminShell` mounted behind `#admin`).
**Goal:** Make journey content data-driven. An admin authors the drill-item pool **and** the journey (units → lessons that reference item ids) into Firestore; players fetch it live, with a bundled snapshot fallback so the game is always playable.

## Locked decisions

1. **Full authoring** — admin authors the item pool AND journey structure (units, lessons, ordering, checkpoints). The whole journey becomes live-editable; no redeploy to change content.
2. **Homogeneous lessons** — a lesson keeps one drill type and references explicit item ids:
   `Lesson = { id, drill, level, itemIds[], isCheckpoint?, title? }`. `drill`/`level` still drive food group (`DRILL_FOOD`) and xp; `itemIds` choose *which* pool items run (no longer "all items of that (drill,level)").
3. **Player loading** — bundled snapshot fallback → live fetch → swap + `localStorage` cache of last-good. Instant first paint, always playable cold-offline.
4. **Storage shape** — two aggregate Firestore docs:
   - `content/pool` — `{ items: Record<itemId, DrillItem> }`
   - `content/journey` — `{ units: Unit[] }` (lessons embedded; each lesson carries `itemIds`)
   Player = 2 reads, gets everything; single trusted admin saves whole docs (last-write-wins). 1 MB/doc cap ≈ thousands of items — fine for years.
5. **Admin UI** — two-tab workspace **Pool | Journey** (one tab per doc). Functional-first; `impeccable` polish deferred.

## Architecture — new units

Each unit has one purpose, a clear interface, and is testable in isolation.

### `src/content/model.ts` (pure, no I/O)
- `ContentBundle = { pool: Record<string, DrillItem>; units: Unit[] }`
- Accessors over a passed-in bundle:
  - `orderedUnits(bundle): Unit[]` — units sorted by `order`
  - `findLesson(bundle, lessonId): { unit, lesson } | undefined`
  - `itemsForLesson(bundle, lesson): DrillItem[]` — resolve `lesson.itemIds` → pool items (skip/flag missing)
  - `tutorialItem(bundle): DrillItem | undefined` — the egg-hatch tutorial item (first `pattern` lvl1, or a designated id)
- `Unit`/`Lesson` interfaces move here (from `data/journey.ts`); `DrillItem`/`DrillType` stay in `data/types.ts`.

### `src/content/validate.ts` (pure)
- `validateContent(bundle): { ok: boolean; errors: string[] }`, porting the invariants currently asserted in `data/journey.test.ts`, plus pool-resolution checks:
  - ≥1 unit; orders unique and ascending-sortable
  - every unit has ≥1 lesson; exactly one checkpoint, and it is **last**
  - all unit ids and lesson ids unique across the journey
  - every `lesson.itemIds` is non-empty and every id resolves in `pool`
  - each resolved item: `slots.length === answer.length`; trap `slot` indices in range
- Used at **two** gates: author-save (block invalid writes) and live fetch (reject an invalid live doc → keep current/fallback bundle).

### `src/content/seed.ts`
- The current static content (`data/journey.ts` + `data/wordBank.ts`) transformed **once** into the new pool+lesson `ContentBundle` shape. Lessons that were `(drill, level)` become `{ drill, level, itemIds: [<all items of that drill+level>] }`, preserving today's behavior.
- **Single source of truth for two consumers:** the bundled fallback (imported by the player) and the seed-script input (pushed to Firestore). Must pass `validateContent`.

### `src/content/load.ts` + `ContentProvider`
- First paint synchronously: `cachedBundle()` (from `localStorage`, validated) ?? `seed`.
- Then async `fetchContent()` → `validateContent`:
  - valid → set active bundle + write `localStorage` last-good
  - invalid/error → keep current bundle (log)
- Exposes the active bundle + status via a React context/hook (`useContent()`); accessors from `model.ts` are called against it.

### `src/firebase/content.ts` (repo)
- `fetchContent(): Promise<ContentBundle>` — reads `content/pool` + `content/journey` (2 reads), assembles bundle.
- `saveContent(bundle): Promise<void>` — atomic `writeBatch` writing both docs; admin-only (enforced by existing rules + auth).

## Player consumer refactor (the risk seam)

Today these read static modules synchronously; they move to the active bundle:
- `gameStore.startLesson(lessonId)` → `findLesson` + `itemsForLesson` from the active bundle; resolve items, pass `drill`/`level` for food/xp; hand the resolved **items list** to the drill screen.
- `DrillScreen` takes a resolved `items: DrillItem[]` prop instead of `({drill, level})` + internal `itemsFor`.
- `JourneyMap` → `orderedUnits(bundle)`.
- `EggHatch` → `tutorialItem(bundle)`.
- `journeyProgress.ts` keeps `Unit`/`Lesson` types (now imported from `content/model`); logic unchanged.
- `data/journey.ts` + `data/wordBank.ts` retire after `seed.ts` derives from them (thin re-export bridge during migration, removed at the end).

## Admin UI (two-tab, in/around `AdminShell`)

- **Pool tab:** item list filterable by drill/level; item editor for `slots`, `answer`, `distractors`, `traps` (`{slot, word, tip}`), `strictness`, `thaiHint`, `id`. Add/edit/delete.
- **Journey tab:** units tree (title, emoji, order, add/remove unit) + lesson editor (drill, level, `isCheckpoint`, multi-select `itemIds` from the pool).
- **Validation banner** from `validateContent` on every edit; **Save disabled while invalid**. Save → `saveContent(bundle)`.
- **Lazy-load** the admin tree (`React.lazy` behind `#admin`) — deferred PR-#11 followup folded in here so admin components stay out of the player path (firebase SDK is now in the player bundle anyway via live fetch).

## Migration / seed

- `scripts/seed-content.mjs` — firebase-admin (pattern of `scripts/set-admin-claim.mjs`): idempotent `writeBatch` push of the `seed` bundle to `content/pool` + `content/journey`. Re-runnable (overwrites). Document as an operator step in `docs/firebase-setup.md`.

## Error handling

- Live fetch failure or invalid live doc → silently keep the current/fallback bundle; never blank the game.
- Missing `itemId` in a lesson → `validateContent` fails it before save and on fetch; `itemsForLesson` defensively skips unknown ids at runtime.
- Save with validation errors → blocked client-side; rules still enforce admin-only.

## Testing

- **Pure unit tests:** `model` accessors, `validateContent` (port the `journey.test.ts` cases + new pool/itemId cases), `seed` passes `validateContent`.
- **Migration parity:** for every lesson in `seed`, resolved items equal the old `itemsFor(drill, level)` set — guarantees no gameplay change from the migration.
- **Components:** render-only, mocking `src/content/load` + `src/firebase/content` (per the `AdminShell.test.tsx` pattern).
- **Rules:** extend `src/firebase/rules.test.ts` — public read of `content/*`, admin-only write; run via `npm run test:rules` (emulator, JDK 21).
- **Persist:** **no version bump** — content is not persisted player state (`lessonStars` keys unchanged; lesson ids preserved by the migration).

## Out of scope (parked)

- Student accounts / cloud save (slice 3).
- AI-generated word banks / `reviewQueue` workflow (needs Blaze/Cloud Functions).
- Admin UI visual polish (`impeccable`) beyond functional.
- Per-item food groups / free-mix lessons (rejected: keeps nutrition/xp model intact).

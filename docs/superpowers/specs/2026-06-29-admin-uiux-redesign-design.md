# Admin UI/UX Redesign — Design

**Date:** 2026-06-29
**Repo:** `sentence-pet` (`D:/ai_projects/AI_design_thinking/sentence-pet`)
**Branch:** create `admin-uiux` off `main` @ `7dcafd0`
**Process:** brainstormed (visual companion) → this spec → writing-plans → subagent-driven execution
**Status:** approved, ready for plan

## Goal

Lift the admin surface (`src/components/admin/`) from a bare "debug-panel" look to a coherent, low-cognitive-load internal tool. The admin is an emulator-only, desktop, internal/dev surface — invest in clarity and consistency, **not** mobile/responsive polish.

## Locked decisions

1. **Scope:** the whole admin, built **design-system-led** and shipped in **slices** (phases). Not a one-shot rewrite.
2. **Visual direction:** **Neutral SaaS** base (slate neutrals, indigo primary, emerald success, red danger, amber warn; soft cards, uppercase section eyebrows, base font bumped from `text-xs` to `text-sm`/`text-base`) **with a playful accent header** (the one branded flourish — a warm gradient/title that nods to the game).
3. **Save model:** keep the two existing per-domain saves (course via `saveCourse`, pet-defs via `savePetDefs`) but unify them behind **one shared `SaveBar` primitive** — consistent look, dirty-state indicator, disabled-until-valid, status text. No merging of persistence paths (avoids the regression-prone post-save registry swap). No autosave (admin writes the live Firestore catalog).
4. **PetsTab layout:** **master–detail rail** (pet list left, grouped form right — same pattern as JourneyTab). Form grouped into **Identity / Stats / Evolution / Art** sections instead of one flat 16-field + 7-upload stack.

## Token strategy (important constraint)

The game uses the **default Tailwind palette**; there is **no `@theme` block** today (only `@import "tailwindcss"` + keyframes in `src/index.css`). A global `@theme` override would re-skin the whole game.

→ Admin tokens are **admin-scoped**, not global. Use Tailwind default utilities (slate/indigo/emerald/red/amber already exist) for most of it, plus a small set of CSS custom properties under an admin root (`.admin-root` class or `data-admin` attribute wrapping `AdminShell`) for anything the defaults don't cover (card shadow, eyebrow color, header gradient). Do **not** add a global `@theme` block. Do **not** bump the persist version (pure UI).

## Architecture: foundation + primitives

New folder `src/components/admin/ui/`. Each primitive is small, single-purpose, independently testable, and consumes only props (no store coupling).

- **`Field`** — label + control slot + optional hint + inline error. Replaces the inline `label+input` idiom repeated across every tab.
- **Inputs:** `TextInput`, `NumberInput`, `Select`, `MultiSelect`, `Checkbox`, `Toggle`. Consistent sizing/border/focus-ring; forward `aria-*`.
- **`Button`** — variants `primary` / `ghost` / `danger`; replaces ad-hoc indigo/emerald/slate/red `<button>` classes.
- **`Card`** + **`SectionLabel`** (uppercase eyebrow) — the grouping container for form sections.
- **`SaveBar`** — sticky bar: dirty indicator, validation-error count, Save (disabled until valid), status (`saving…` / `saved ✓` / `save failed: …`). Driven by props: `dirty`, `valid`, `errorCount`, `status`, `onSave`. Used by both the course domain (AdminShell) and the pet-def domain (PetsTab).
- **`ValidationSummary`** — replaces the raw red `<ul>`; `aria-live="polite"`, error list, count.
- **`EmptyState`**, **`Tabs`**, **`AdminHeader`** (the playful accent header).

All primitives get render/interaction tests. Accessibility: keep/forward existing `aria-label`s (tests depend on them), visible focus rings, label association.

## Phase plan

Each phase ships working software. Fresh subagent per task, main-thread review between tasks (two-stage spec→quality, plus a whole-feature review per phase). Handoff doc between phases.

- **P0 — Foundation.** Build `ui/` tokens (admin-scoped vars) + primitives + their tests. No tab wired yet (or wire one trivially to prove it).
- **P1 — AdminShell chrome.** Playful `AdminHeader`, `Tabs`, sticky `SaveBar` (course domain), `ValidationSummary`. Establishes the frame all tabs sit in.
- **P2 — PetsTab (deep).** Master–detail rail; group `PetForm` into Identity / Stats / Evolution / Art Cards (collapsible or sub-tabbed); re-skin `SpriteUpload`; PetsTab's own `SaveBar` (pet-def domain). Likely **decompose `PetsTab.tsx`** (currently ~370 lines) into the rail, the section components, and the sprite group — but only as far as the UX work requires.
- **P3 — BossesTab.** Apply primitives; group fields into Cards (Boss · Sprite · Reward · Reviews · Pins). **Fix leaky labels:** the literal test-selector strings (`"gate gate-1 afterUnit"`, `"final boss reviews unit-1"`, etc.) currently render as visible UI text. Split into a human-readable visible label (e.g. "After unit") with the existing selector string moved to `aria-label` so current tests keep passing.
- **P4 — Journey / Pool / Import / ItemEditor.** JourneyTab is already master-detail — re-skin to the shared rail/primitive look. Pool/Import/ItemEditor: apply `Field` / `Button` / `Card` / `SaveBar` / `ValidationSummary`.

## Testing & verify gate (every slice)

- **Append** to co-located `*.test.tsx` — never overwrite (clobber hazard already hit AdminRoute and PetsTab tests).
- Primitives get their own render/interaction tests.
- Gate before declaring a task done: `npx vitest run`, `npx tsc -b` (**not** `--noEmit`), `npx vite build`. Windows worker-fork flake ("Worker exited unexpectedly") → re-run.
- Manual smoke for admin: `npm run emulators` (storage :9199) + `npm run dev:admin` → `/#admin` → 🔑 Dev admin.

## Risks & guardrails

- **PetsTab post-save registry swap** had an optimistic-update regression before (caught in review). Re-verify on P2 if save/hydration is touched.
- Views read the live registry via `usePetDefs()` (`useSyncExternalStore`); store actions use the `getActivePetDefs()` snapshot — don't cross them.
- `src/content/seed.ts` is generated (`npm run seed:export`) — never hand-edit.
- Stage explicit files; **never `git add -A`** (concurrent-session contamination).
- No persist-version bump (pure UI).
- Admin tokens stay admin-scoped — never a global `@theme` change that bleeds into the game.

## Out of scope

- Mobile/responsive admin.
- Firebase go-live (separate deferred ops phase).
- Merging the two save domains; autosave.
- Any change to game-facing UI or game token palette.

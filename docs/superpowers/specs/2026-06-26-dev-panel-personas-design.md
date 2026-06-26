# Dev Panel "View As" Personas — Design Spec

**Date:** 2026-06-26
**Status:** approved (brainstorm), pending implementation plan.
**Scope:** the DEV-only `DevPanel` cheat panel. Adds quick persona switches. Tree-shaken from production (DevPanel and anything it imports are eliminated when `import.meta.env.DEV` is false).

## Context

`DevPanel` (`src/components/DevPanel.tsx`, rendered by `App` only in DEV) already cheats game state via inline `useGameStore.setState` plus the store's `*ForTest` helpers (`resetForTest` = `freshState()` = the new-player first run). It does **not** touch auth today. We want one-click ways to view the app as the two key personas — a brand-new player and a returning player with progress — including the real signed-out path.

## Locked decisions (from brainstorm)

| Fork | Decision |
|---|---|
| **New player** | Two buttons: (a) reset game state to the first-run egg hatch (stay signed in); (b) sign out → title menu (real anonymous guest, exercises New Game/signup). |
| **Test account** | Two things: (a) a **Test loadout** that applies a representative progress state to the current session (no auth); (b) a **Test account** sign-in to a fixed account that lands as a **returning player with progress**. |
| **Test-account = returning player with progress** | The fixed account's saved state IS the progress loadout. First use creates the account and seeds the loadout (cloud-sync mirrors it up); later uses sign in and reconcile pulls that saved progress. |

## Design

### 1. Shared progress builder — `src/dev/testLoadout.ts`
A pure function `devTestLoadout(opts?): Partial<GameState>` returning a representative mid-game state, applied via `useGameStore.setState(...)`:
- `screen: 'petRoom'`
- `pets`: 2 **hatched** pets built with the existing `makePet` / `rollStatsForRarity` / `pickSpecies`; pet 1 set to a mid level (xp via `totalXpForLevel`, e.g. level 12 → "young"), pet 2 a rarer species. `activePetId` = pet 1.
- `coins: 500`
- `inventory`: a few of each food group (e.g. 5 each of protein/veggie/vitamin/treat).
- `journey.lessonStars`: the first few lesson ids marked cleared (2–3 stars). Lesson ids are passed in by the caller (`opts.clearedLessonIds`) from the content store, so the builder stays pure and content-agnostic; default `[]`.
- `owned` + `activeBackground`: one decor from the catalog, owned and equipped (id resolved from `config/decorSprites`).
- `lastReward`, `lastPull`, `lastLevelUp`, `currentLessonId`: null.
- Accepts an injectable `rng` (default `Math.random`) for deterministic tests.

### 2. Dev test account — `src/dev/testAccount.ts`
- Exports `TEST_EMAIL = 'dev@test.local'`, `TEST_PASSWORD = 'devpass123'`, and `createTestAccount()` = `createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD)` (using the `auth` instance + the firebase fn).
- Exports an orchestrator `viewAsTestAccount({ signIn, seed })`:
  1. `try { await createTestAccount(); seed(); }` — first use: creates the account (a fresh non-anonymous sign-in fires `onAuthChange` → `isAnonymous` false → game), then `seed()` applies `devTestLoadout(...)`. Cloud-sync mirrors the seeded progress up for this uid.
  2. `catch (e)` if `e.code === 'auth/email-already-in-use'` → `await signIn(TEST_EMAIL, TEST_PASSWORD)` — returning: `AuthProvider.signIn` reconciles cloud-wins, pulling the previously-seeded progress. Else rethrow.
- Result either way: signed in to the fixed account as a returning player with progress.

### 3. DevPanel wiring
- DevPanel consumes `useAuth()` (`signIn`, `signOut`) and reads `clearedLessonIds` from the content store (`useContentStore`) for the loadout.
- New **"VIEW AS"** button row (4 actions):
  - **👶 new player** → `resetForTest()` (replaces today's red `reset` button — same action, clearer label).
  - **🚪 sign out** → `void signOut()` → anon re-bootstrap → `PlayerRoot` shows `MainMenu`.
  - **🎒 loadout** → `useGameStore.setState(devTestLoadout({ clearedLessonIds, ... }))`.
  - **🧪 test acct** → `void viewAsTestAccount({ signIn, seed: () => useGameStore.setState(devTestLoadout({ clearedLessonIds })) })`.
- Auth actions are fire-and-forget with a `.catch` that `console.error`s (dev tooling; no UI error surface needed).

## Architecture / boundaries
- `devTestLoadout` is a pure, unit-tested builder; no side effects. `testAccount.ts` isolates the firebase create/sign-in orchestration. DevPanel stays the only consumer of both → both are tree-shaken from production along with DevPanel.
- No production store API or `firebase/auth` change. The dev modules use existing primitives (`makePet`, the `auth` instance, `useAuth`).

## Testing
- **`devTestLoadout`** (unit): with a seeded rng + sample `clearedLessonIds`, returns `screen:'petRoom'`, 2 hatched pets, `coins:500`, stocked inventory, the given lessons in `journey.lessonStars`, one owned+equipped decor. Both pets `hatched:true`; `activePetId` is a real pet id.
- **DevPanel** (render, extend existing test, mock `useAuth` + content store): the 4 VIEW AS buttons render; **new player** calls `resetForTest`; **loadout** raises `coins` to 500 and `pets.length` to 2; **sign out** calls the mocked `signOut`; **test acct** calls a mocked `viewAsTestAccount` (mock `../dev/testAccount`).
- **Green bar:** `npx tsc -b`, `npm run build` (confirm DevPanel + dev modules tree-shake — no `dev@test.local` string in `dist`), full `vitest`.

## Non-goals
- ❌ Any production behavior change — DEV-only.
- ❌ Real (non-emulator) test-account creation guarantees — meant for the local emulator; in DEV without a backend the auth buttons simply reject (logged).
- ❌ A general account-switcher UI, multiple named test accounts, or seeding arbitrary journey states.

## Success criteria
- DevPanel shows a VIEW AS row with the 4 actions.
- **👶 new player** drops to the egg-hatch first run; **🚪 sign out** returns to the title menu.
- **🎒 loadout** populates the current session with 2 hatched pets, 500 coins, journey progress, and a decorated room.
- **🧪 test acct** signs into `dev@test.local` and lands as a returning player with the progress loadout (created+seeded on first use, reconciled thereafter).
- `tsc -b`, `build`, full `vitest` green; the test-account credentials/dev modules do not appear in the production bundle.

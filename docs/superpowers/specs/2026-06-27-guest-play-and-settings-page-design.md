# Guest play + global Settings page — design

**Date:** 2026-06-27
**Branch:** `journey-redesign`

## Goal

Let a player enter and play **without creating an account** ("Play as guest"),
with a later **upgrade-to-account** path that preserves progress. Fold all
account controls and the existing sound mixer into one **global Settings page**
reached from a gear button on every in-game screen.

## Background (current state)

- `AuthProvider` (`player` mode) auto-creates an anonymous Firebase guest on
  signed-out; for a guest `isAnonymous === true`. Cloud sync already runs for the
  anon uid, so guest progress is already mirrored to cloud.
- `PlayerRoot` routes `loading → splash`, `showIntro → IntroVideo`,
  **`isAnonymous → MainMenu`**, else `→ App`. That `isAnonymous` gate is what
  blocks guest play: an anon user can only ever see the menu.
- `MainMenu` choose-sheet offers **New Game** (sign-up) / **Continue** (sign-in).
- `AccountButton` renders in the App top bar on every screen; returns `null` for
  guests; for real users shows email + Replay intro + Sign out.
- `SettingsSheet` is a sound-only bottom sheet; opened by a gear ⚙️ button that
  lives **only** in the PetRoom HUD (`PetRoom.tsx:101` / `:188`).

## Decisions

- Guest "Play as guest" **plays the intro first**, then drops into the game.
- In-game save/account lives in a **new Settings page** (not just sound),
  reached from the **same gear** entry point.
- The top-bar `AccountButton` is **absorbed into Settings** and removed.
- The gear becomes **global** (every in-game screen), not PetRoom-only.
- Guest sign-out / exit **keeps local progress** and returns to the menu.

## Part A — Guest play path

### PlayerRoot

Add `guestPlay` boolean state. Render precedence:

1. `loading` → splash
2. `showIntro` (`pendingIntro || replayIntro`) → `IntroVideo`
3. `!isAnonymous` → `App`
4. `isAnonymous && guestPlay` → `App`
5. else → `MainMenu`

Thread two callbacks into `MainMenu` and `App`:

- `onPlayGuest = () => { setGuestPlay(true); setPendingIntro(true); }`
  (intro plays; on `endIntro`, `guestPlay` is still true → game).
- `onExitToMenu = () => setGuestPlay(false)` (passed into `App` → Settings).

### MainMenu

Add a **"Play as guest"** action in the `view === 'choose'` block, alongside
New Game / Continue. Wire it to `onPlayGuest`. Visual treatment via impeccable
(lower-emphasis than New Game; it is the "just try it" path).

### Sign-out / exit semantics (keep local, back to menu)

- **Real user** "Sign out" → `auth.signOut()` → `onAuthChange(null)` → anon
  re-bootstrap → `isAnonymous` true; `guestPlay` is already false → `MainMenu`.
  localStorage persists (no reconcile; landmine below).
- **Guest** "Exit to menu" → `onExitToMenu()` (`setGuestPlay(false)`). Stays
  anon, same uid, localStorage intact → re-entering as guest resumes.

No reconcile is added to the guest, link, or sign-out path (cloud-wins reconcile
stays confined to `signIn()`).

## Part B — Global Settings page

Replace the sound-only `SettingsSheet` and the top-bar `AccountButton` with one
Settings surface.

### Entry (global gear)

- A fixed gear button in `App` (the in-game root), top-right, opening the
  Settings page. Covers every in-game screen via App's single AppShell.
- **Remove** PetRoom's local gear + `SettingsSheet` usage (`PetRoom.tsx:101`,
  `:188`) and App's top `AccountButton` bar (`App.tsx:114`).
- The gear overlaps PetRoom's coins / My-Pets HUD corner — resolve placement and
  styling with **impeccable**.

### Sections

1. **Account**
   - Guest → **"Save your progress"** CTA that opens `SignUpForm` (already drives
     `linkEmail` → `linkWithCredential`). On success `isAnonymous → false`, close
     the page, stay in game.
   - Real user → email + **Sign out**.
   - **Replay intro** (both) — moved here from the removed top bar.
   - Guest → **Exit to menu** → `onExitToMenu()`.
2. **Sound** — existing per-channel mixer, logic unchanged.

Account UI keys off explicit `isAnonymous` state, never derived from `user`.

## Landmines (carried from handoff)

- `isAnonymous` is **explicit state**, not derived from `user`.
  `linkWithCredential` upgrades the same `User` in place and does NOT refire
  `onAuthChange`; `AuthProvider.linkEmail` compensates with `setIsAnonymous(false)`.
  Drive all new guest/auth UI from explicit state (memory:
  `sentence-pet-signup-game-auth-bounce`, PR #16).
- Reconcile (cloud-wins) runs ONLY in `signIn()`. Reloads and anon→email link
  must NOT pull cloud or they clobber local guest progress.
- `anonBootstrapInFlight` guards double `signInAnon` under StrictMode — keep it.
- Stage **explicit files only**, never `git add -A` (memory:
  `git-add-all-concurrent-session-contamination`). `firebase.json` is left
  modified in the working tree on purpose — don't stage it.

## Tests

- `src/PlayerRoot.test.tsx` — anon + `guestPlay` → GAME not MENU; "Play as guest"
  → intro → game; `onExitToMenu` resets `guestPlay` back to MENU.
- New Settings page tests — guest account section (Save progress, Exit to menu)
  vs real account section (email, Sign out); sound mixer still works.
- `src/components/menu/MainMenu.test.tsx` — "Play as guest" button present + wired.
- Trim `AccountButton.test` (component absorbed) and `PetRoom.test` gear test
  (gear moved to App).
- `src/auth/AuthProvider.test.tsx` — touch only if link/guest behaviour changes.
- Verify: `npm test`, `npm run build`, `npm run e2e`. Boss e2e **test B
  self-skips** when the Firebase test account is unavailable — expected, not a
  regression (`e2e/boss.spec.ts:127`).

## Out of scope

- No changes to cloud sync, reconcile strategy, or the anon-bootstrap mechanism.
- No new persistence backend; localStorage stays the instant source of truth.

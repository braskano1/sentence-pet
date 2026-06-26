# Main Menu + Sign-in — Design Spec

**Date:** 2026-06-26
**Sub-project:** accounts phase — **slice 3.5** (UI shell for student accounts), follows slice 3 on branch `student-accounts-cloud-save`.
**Status:** approved (brainstorm), pending implementation plan.
**Builds on:** `2026-06-26-student-accounts-cloud-save-design.md` (slice 3 — anonymous-first auth, cloud save, `linkWithCredential` upgrade, cloud-wins reconcile on sign-in).

## Context

Browser E2E of slice 3 (Playwright against the auth+firestore emulators) confirmed the cloud-save core works end-to-end — anonymous bootstrap, profile/pets docs written, `linkWithCredential` upgrade preserving uid + progress — but exposed a **gap**: the account UI only had a sign-up/**link** form (`linkEmail`). There was **no sign-in path**. A returning student on a new device who entered their existing email hit `linkWithCredential` → `auth/email-already-in-use` → error. The cloud-wins reconcile (`signIn` → `reconcileFromCloud`) was wired in `AuthProvider` and unit-tested, but nothing in the UI called it, so the spec's "second-device sign-in overwrites local with cloud" success criterion was unreachable by a real user.

This slice adds a proper **game main menu** that houses both account paths, framed as a title screen, closing that gap. The menu also reframes onboarding: **an account is now required to play** (the slice-3 "play immediately as anonymous guest" path is removed; the anonymous account becomes an internal bootstrap that gets linked at sign-up).

## Locked decisions (from brainstorm)

| Fork | Decision |
|---|---|
| **Menu timing** | Main menu shows **only when signed out** (anonymous/guest). Once the player holds an email account (signed up or signed in), launches skip the menu and go straight to the game. |
| **Account required?** | **Account required to play.** No guest play. The anonymous Firebase user is an internal bootstrap only; New Game links it to email, Continue signs into an existing account. |
| **Title-screen direction** | **Direction B — "Tap to start → reveal".** Cinematic title (hero pet, floating POS word-tiles, pulsing "TAP TO START") → tap dims the scene and slides up a sheet with **New Game** (sign up) and **Continue** (sign in). Auth forms are bottom sheets in the same word-adventure look. The **New Game / Continue** metaphor (console-RPG convention) makes the returning-player path obvious. |
| **Intro video** | **Placeholder now, real asset later.** After New Game (sign-up), a full-screen intro/cutscene screen with a **Skip** button plays before the first run; it points at a placeholder until the partner's art pipeline supplies the real clip. Continue (sign-in) skips the intro. |

> Visual fidelity in the mockups (emoji, gradients) is **direction only** — the real visual polish is a later **`impeccable`** pass once the partner's art exists. This slice ships the flow, the structure, and functional (un-polished) screens.

## Goal

A signed-out player lands on a game title screen; tapping it reveals New Game / Continue. New Game creates an account (links the anonymous user to email), plays a placeholder intro, then drops into the first-run egg hatch. Continue signs into an existing account and loads its cloud save (cloud-wins) straight into the game. Signed-in players skip the menu entirely; signing out returns to the title screen. The sign-in path that slice 3 wired but never surfaced is now reachable, closing the second-device gap.

## Architecture

### Routing — auth-state router

A new top-level **`PlayerRoot`** replaces `<App/>` as the player entry (mounted by `main.tsx` inside `<AuthProvider player>`). It selects what to render from auth state + a transient intro flag:

```
loading                         → minimal inline splash  (brief centered logo/spinner in PlayerRoot; avoids menu/game flash)
isAnonymous (signed out/guest)  → <MainMenu/>            (title screen + New Game / Continue)
!isAnonymous && pendingIntro    → <IntroVideo/>          (placeholder cutscene + Skip)
!isAnonymous                    → <App/>                 (the existing game: AppShell + CurrentScreen)
```

The `loading` splash is a few lines of inline JSX in `PlayerRoot` (centered in `AppShell`), not a separate component.

`pendingIntro` is **transient React state in `PlayerRoot`** (NOT persisted, NOT in the game store). It is set true by the New Game (sign-up) success path and cleared when the intro ends/skips. Sign-in never sets it. On a mid-intro reload the flag is lost and the player simply lands in the game — acceptable for a skippable placeholder.

Because the auth flip (`isAnonymous → false`) and `setPendingIntro(true)` both happen around the sign-up success, `PlayerRoot` must not unmount between them; the flag is owned by `PlayerRoot` (which never unmounts) and set via a callback passed down to the sign-up form, so the ordering is safe.

### Module layout

```
src/
  PlayerRoot.tsx                      // NEW: auth-state router (loading/menu/intro/game)
  main.tsx                            // MODIFY: render <PlayerRoot/> instead of <App/>
  App.tsx                             // MODIFY: drop the inline AccountButton wrapper (menu owns auth now)
  components/menu/
    MainMenu.tsx                      // NEW: title → tap → reveal sheet → New Game / Continue; hosts the auth sheets
    TitleScene.tsx                    // NEW: the hero title art (pet + floating tiles + pulse). Presentational.
    IntroVideo.tsx                    // NEW: placeholder full-screen cutscene + Skip → onDone
  components/account/
    SignInForm.tsx                    // NEW: email+password → useAuth().signIn (cloud-wins reconcile). THE GAP FIX.
    SignUpForm.tsx                    // MODIFY: relabel CTA "Create & Play ▸"; used by MainMenu's New Game
    AccountButton.tsx                 // MODIFY: signed-in-only (email + Sign out); drop the guest/SignUpForm branch
  config/
    intro.ts                          // NEW: INTRO_VIDEO_SRC = '' placeholder seam
```

### Component responsibilities

- **`PlayerRoot`** — the only place that reads `{ loading, isAnonymous }` from `useAuth` for routing and owns `pendingIntro`. Passes `onSignedUp = () => setPendingIntro(true)` into `MainMenu`. Renders `Splash`/`MainMenu`/`IntroVideo`/`App`.
- **`MainMenu`** — a small view state machine: `view ∈ { 'title', 'choose', 'signup', 'signin' }`. `title` shows `TitleScene` + a full-surface tap target → `choose`. `choose` shows the slide-up sheet with **New Game** → `signup` and **Continue** → `signin`. `signup` renders `SignUpForm` (on success → `onSignedUp()`); `signin` renders `SignInForm`. A back control returns to `choose`. Rendered inside `AppShell` for the consistent mobile column.
- **`TitleScene`** — presentational hero art (pet sprite, floating POS word-tiles, "TAP TO START" pulse). No logic. Real art lands via `impeccable` + the partner's pipeline later.
- **`SignInForm`** — controlled email+password; submit → `useAuth().signIn(email, password)` (which already reconciles cloud-wins in `AuthProvider`). Shows an error message (`role="alert"`) on failure (e.g. wrong password / unknown email); disables submit while busy. Symmetric with `SignUpForm`.
- **`SignUpForm`** (modify) — unchanged behavior (`linkEmail` → upgrade anon→email), CTA relabelled "Create & Play ▸". Its success callback drives `pendingIntro`.
- **`IntroVideo`** — full-screen placeholder cutscene (poster/colour while `INTRO_VIDEO_SRC` is empty; a `<video>` when a src exists) with a **Skip** button; both "video ended" and "Skip" call `onDone`.
- **`AccountButton`** (modify) — now signed-in-only: renders the email + **Sign out** control for `!isAnonymous && user`, else `null`. The guest "Save your pets" branch and its `SignUpForm` import are removed (signup now lives in the menu). Stays mounted in the game so signed-in players can sign out; sign-out → `AuthProvider` re-bootstraps anon → `PlayerRoot` routes back to `MainMenu`.

### Data flow (the three journeys)

**New player:** signed-out → `MainMenu` title → tap → choose → **New Game** → `SignUpForm` (`linkEmail`, anon→email, same uid, progress preserved) → `onSignedUp()` sets `pendingIntro` → `IntroVideo` (Skip/end) → `App` (egg-hatch first run, since the new account is unhatched).

**Returning player, new device:** signed-out → `MainMenu` → **Continue** → `SignInForm` (`signIn`) → `AuthProvider` reconciles cloud-wins (overwrites local with cloud) → `App` (their cloud state; typically already hatched → pet room). No intro.

**Returning player, same device (already signed in):** `PlayerRoot` sees `!isAnonymous` on load → `App` directly. Menu/intro skipped.

**Sign out:** in-game `AccountButton` → `signOut` → anon re-bootstrap → `MainMenu`.

## State & persistence

- **No Zustand persist change, no version bump.** `pendingIntro` is transient React state in `PlayerRoot`; nothing new is persisted.
- **No new Firestore paths, no `firestore.rules` change.** Sign-in reuses the existing slice-3 `reconcileFromCloud` + `users/{uid}/*` repo. The rules-test matrix is unchanged.

## Testing strategy

- **`PlayerRoot`** — routing table: `loading`→Splash; `isAnonymous`→MainMenu; signed-in→App (game); signed-in + `pendingIntro`→IntroVideo. Mock `useAuth`; stub child components to assert which renders.
- **`MainMenu`** — view state machine: tap title → choose; New Game → SignUpForm visible; Continue → SignInForm visible; back → choose. Mock `useAuth`; mock `src/firebase/*`/`useAuth` per existing convention (mock `canvas-confetti` if transitively imported).
- **`SignInForm`** — submit calls `signIn(email, password)`; error message shown on rejection; busy disables submit. (Mirror `SignUpForm.test`.)
- **`IntroVideo`** — renders the placeholder; Skip calls `onDone`.
- **`AccountButton`** — signed-in shows email + Sign out (calls `signOut`); anonymous/none → renders nothing.
- **`App.test`** — the existing pure `screenKeyAndNode` test stays green (App's game content is unchanged).
- **Green bar:** `npx tsc -b`, `npm run build`, full `vitest`; rules suite still skips without Java / passes under the emulator (unchanged).
- **Browser E2E (re-run, the reason this slice exists):** with the auth+firestore emulators, drive the real app: New Game writes the account docs and lands in the game; **Continue on a fresh context loads the first account's cloud state (coins-distinctive) — the previously-failing C3 check must now PASS.** (Throwaway Playwright via installed Chrome, reverted after, per slice-3 QA conventions.)

## Non-goals (this slice)

- ❌ Real intro-video asset / production cutscene — placeholder + `INTRO_VIDEO_SRC` seam only.
- ❌ Final visual polish, real title art, sound/music — deferred to `impeccable` + the partner's art pipeline.
- ❌ Password reset / email verification / "forgot password".
- ❌ Settings screen, audio toggles (mockup hinted; out of scope now).
- ❌ Battle/friends (slice 4), any Firestore schema or rules change, persist version bump.
- ❌ Re-introducing guest play (account is required by decision).

## Success criteria

- A signed-out player sees the title screen; tap reveals New Game / Continue.
- New Game creates an account (anon→email link, uid + progress preserved), plays the placeholder intro (Skip works), then reaches the egg-hatch first run.
- Continue signs into an existing account and loads its cloud save into the game (cloud-wins); the egg/menu are not shown.
- A signed-in player on launch goes straight to the game; signing out returns to the title screen.
- **Browser E2E: the second-device "Continue" path overwrites local with cloud (the prior C3 failure now passes).**
- `npx tsc -b`, `npm run build`, full `vitest` green; rules suite unaffected. The game (slice 1–3 behavior) is otherwise unchanged.

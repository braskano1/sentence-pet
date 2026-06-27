# Guest play + global Settings page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player enter and play as a guest (no account) with intro-first, plus a global in-game Settings page (gear) that holds account controls (guest "save progress", real-user sign-out, replay intro) and the existing sound mixer.

**Architecture:** `PlayerRoot` gains a `guestPlay` flag so an anonymous user who chose "Play as guest" renders `<App>` (after the intro) instead of being trapped at the menu. The sound-only `SettingsSheet` grows an Account section and becomes the single Settings surface, opened by a global gear button moved into `App`; the always-on top-bar `AccountButton` is removed. Every sign-out/exit calls `onExitToMenu` to reset `guestPlay`.

**Tech Stack:** React + TypeScript, Zustand (`gameStore`), Firebase Auth (anon + email link), framer-motion, Vitest + Testing Library, Playwright e2e.

**Working dir:** `D:\ai_projects\AI_design_thinking\sentence-pet` (branch `journey-redesign`).
**Spec:** `docs/superpowers/specs/2026-06-27-guest-play-and-settings-page-design.md`

---

## File structure

- `src/PlayerRoot.tsx` — add `guestPlay` state + routing precedence; pass `onPlayGuest`/`onExitToMenu`. **(Task 1)**
- `src/components/menu/MainMenu.tsx` — add "Play as guest" action; new `onPlayGuest` prop. **(Task 2)**
- `src/components/SettingsSheet.tsx` — add Account section (guest save / real sign-out / replay / exit) above the sound mixer. **(Task 3)**
- `src/App.tsx` — global gear button + `SettingsSheet`; remove top-bar `AccountButton`; accept `onExitToMenu`. **(Task 4)**
- `src/components/PetRoom.tsx` — remove the local gear + `SettingsSheet` (now global). **(Task 5)**
- `src/components/account/AccountButton.tsx` + test — delete (absorbed into Settings). **(Task 6)**
- Verify + impeccable polish. **(Task 7)**

## Landmines (must respect)

- `isAnonymous` is **explicit state**, never derived from `user`. Account UI branches on `isAnonymous` only.
- No reconcile on the guest/link/sign-out path (cloud-wins stays in `signIn()`).
- Stage **explicit files only**, never `git add -A`. `firebase.json` is intentionally left modified — never stage it.

---

### Task 1: PlayerRoot guest routing

**Files:**
- Modify: `src/PlayerRoot.tsx`
- Test: `src/PlayerRoot.test.tsx`

- [ ] **Step 1: Update the test stubs + add guest-routing tests**

Replace the `MainMenu` stub and `App` stub at the top of `src/PlayerRoot.test.tsx` (lines 7-13) so the stubs expose the new props, then add three tests. Final stub + new tests:

```tsx
// Stub the heavy children so we only test routing.
vi.mock('./components/menu/MainMenu', () => ({
  MainMenu: ({ onSignedUp, onPlayGuest }: { onSignedUp: () => void; onPlayGuest: () => void }) => (
    <div>
      <button onClick={onSignedUp}>MENU</button>
      <button onClick={onPlayGuest}>PLAY_GUEST</button>
    </div>
  ),
}));
vi.mock('./components/menu/IntroVideo', () => ({
  IntroVideo: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>INTRO</button>,
}));
vi.mock('./App', () => ({
  default: ({ onExitToMenu }: { onExitToMenu?: () => void }) => (
    <div>GAME<button onClick={() => onExitToMenu?.()}>EXIT</button></div>
  ),
}));
```

Add these tests inside `describe('PlayerRoot routing', ...)`:

```tsx
it('Play as guest plays the intro first, then the game (still anonymous)', () => {
  authValue = { loading: false, isAnonymous: true };
  render(<PlayerRoot />);
  fireEvent.click(screen.getByText('PLAY_GUEST'));   // guestPlay = true + pendingIntro = true
  expect(screen.queryByText('MENU')).toBeNull();
  expect(screen.getByText('INTRO')).toBeInTheDocument();
  fireEvent.click(screen.getByText('INTRO'));         // onDone → intro ends
  expect(screen.getByText('GAME')).toBeInTheDocument(); // anon + guestPlay → GAME, not MENU
});

it('guest Exit to menu clears guestPlay and returns to the menu', () => {
  authValue = { loading: false, isAnonymous: true };
  render(<PlayerRoot />);
  fireEvent.click(screen.getByText('PLAY_GUEST'));
  fireEvent.click(screen.getByText('INTRO'));         // now in GAME as guest
  fireEvent.click(screen.getByText('EXIT'));          // onExitToMenu → guestPlay = false
  expect(screen.getByText('MENU')).toBeInTheDocument();
  expect(screen.queryByText('GAME')).toBeNull();
});

it('a fresh anonymous user who has not chosen still sees the menu', () => {
  authValue = { loading: false, isAnonymous: true };
  render(<PlayerRoot />);
  expect(screen.getByText('MENU')).toBeInTheDocument();
  expect(screen.queryByText('GAME')).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/PlayerRoot.test.tsx`
Expected: FAIL — `onPlayGuest`/`onExitToMenu` not wired; anon+guest still shows MENU.

- [ ] **Step 3: Rewrite `src/PlayerRoot.tsx`**

```tsx
import { useState } from 'react';
import { useAuth } from './auth/useAuth';
import { AppShell } from './components/AppShell';
import { MainMenu } from './components/menu/MainMenu';
import { IntroVideo } from './components/menu/IntroVideo';
import { DevPanel } from './components/DevPanel';
import App from './App';

/** Top-level player router: loading → splash, signed-out → menu, just-signed-up
 *  or guest → intro then game, signed-in → game. */
export function PlayerRoot() {
  const { loading, isAnonymous } = useAuth();
  const [pendingIntro, setPendingIntro] = useState(false); // first run, right after new-game / play-as-guest
  const [replayIntro, setReplayIntro] = useState(false);   // explicit rewatch (menu link / in-game button)
  const [guestPlay, setGuestPlay] = useState(false);       // an anon chose "Play as guest"

  // The intro takes precedence over both menu and game so a rewatch overlays
  // whichever surface the player came from; on done we return to it.
  const showIntro = pendingIntro || replayIntro;
  const endIntro = () => { setPendingIntro(false); setReplayIntro(false); };

  // Anyone non-anon is in the game; an anon who picked "Play as guest" is too.
  // A fresh anon who hasn't chosen sees the menu. Sign-out/exit resets guestPlay
  // (see onExitToMenu) so a stale flag can't trap a fresh anon in the game.
  const inGame = !isAnonymous || guestPlay;

  const view = loading ? (
    <AppShell>
      <div className="flex flex-1 items-center justify-center text-5xl">🥚</div>
    </AppShell>
  ) : showIntro ? (
    <IntroVideo onDone={endIntro} />
  ) : inGame ? (
    <App
      onReplayIntro={() => setReplayIntro(true)}
      onExitToMenu={() => setGuestPlay(false)}
    />
  ) : (
    <MainMenu
      onSignedUp={() => setPendingIntro(true)}
      onPlayGuest={() => { setGuestPlay(true); setPendingIntro(true); }}
      onReplayIntro={() => setReplayIntro(true)}
    />
  );

  // DEV-only cheat panel lives here (not inside App) so it is reachable on the
  // title/intro screens too — e.g. "VIEW AS" can sign you straight in.
  return (
    <>
      {view}
      {import.meta.env.DEV && <DevPanel />}
    </>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/PlayerRoot.test.tsx`
Expected: PASS (all routing tests including the original sign-up→intro→game test).

- [ ] **Step 5: Commit**

```bash
git add src/PlayerRoot.tsx src/PlayerRoot.test.tsx
git commit -m "feat(guest): route anon 'Play as guest' through intro into the game"
```

---

### Task 2: MainMenu "Play as guest" action

**Files:**
- Modify: `src/components/menu/MainMenu.tsx`
- Test: `src/components/menu/MainMenu.test.tsx`

- [ ] **Step 1: Add a failing test**

In `src/components/menu/MainMenu.test.tsx`, update `openChoose` to pass the new prop and add a test. Replace `openChoose` (lines 39-42) and add the test:

```tsx
const onPlayGuest = vi.fn();
function openChoose() {
  render(<MainMenu onSignedUp={() => {}} onPlayGuest={onPlayGuest} />);
  fireEvent.click(screen.getByRole('button', { name: /tap to start/i }));
}
```

```tsx
it('Play as guest fires onPlayGuest (enter the game without an account)', () => {
  onPlayGuest.mockClear();
  openChoose();
  fireEvent.click(screen.getByRole('button', { name: /play as guest/i }));
  expect(onPlayGuest).toHaveBeenCalled();
});
```

Also update the `arms the title music zone` test's render call (line 47) to include the prop:
`render(<MainMenu onSignedUp={() => {}} onPlayGuest={() => {}} />);`

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/menu/MainMenu.test.tsx`
Expected: FAIL — no "Play as guest" button; TS error on missing prop.

- [ ] **Step 3: Add the prop + button**

In `src/components/menu/MainMenu.tsx`, change the signature (line 21):

```tsx
export function MainMenu({ onSignedUp, onPlayGuest, onReplayIntro }: { onSignedUp: () => void; onPlayGuest: () => void; onReplayIntro?: () => void }) {
```

Then add the guest action inside the `view === 'choose'` block — insert it after the Continue button (after line 110, before the closing `</div>` of the button column at line 111):

```tsx
                          <motion.button
                            type="button"
                            onClick={onPlayGuest}
                            whileTap={{ scale: 0.97 }}
                            className="rounded-2xl px-5 py-3 text-base font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            Play as guest
                          </motion.button>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/menu/MainMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/menu/MainMenu.tsx src/components/menu/MainMenu.test.tsx
git commit -m "feat(menu): add 'Play as guest' action to the choose sheet"
```

---

### Task 3: Settings page — Account section + sound

**Files:**
- Modify: `src/components/SettingsSheet.tsx`
- Test: `src/components/SettingsSheet.test.tsx`

- [ ] **Step 1: Add the useAuth mock + Account-section tests**

In `src/components/SettingsSheet.test.tsx`, add a mutable `authValue` and mock `useAuth` (the sound tests keep working untouched). Add after the `useAudio` mock (line 9):

```tsx
let authValue: {
  isAnonymous: boolean;
  user: { email: string | null } | null;
  signOut: () => void;
  linkEmail: (e: string, p: string) => Promise<void>;
};
vi.mock('../auth/useAuth', () => ({ useAuth: () => authValue }));

beforeEach(() => {
  authValue = { isAnonymous: false, user: { email: 'k@s.th' }, signOut: vi.fn(), linkEmail: vi.fn().mockResolvedValue(undefined) };
});
```

(The existing `beforeEach` on line 11 that resets `audio` stays — two `beforeEach` calls both run.)

Add a new describe block at the end of the file:

```tsx
describe('SettingsSheet — Account section', () => {
  it('a real user sees their email and a sign-out that also exits to menu', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const onExitToMenu = vi.fn();
    authValue = { isAnonymous: false, user: { email: 'k@s.th' }, signOut, linkEmail: vi.fn() };
    render(<SettingsSheet onClose={() => {}} onExitToMenu={onExitToMenu} />);
    expect(screen.getByText(/k@s\.th/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
    expect(onExitToMenu).toHaveBeenCalled();
  });

  it('a guest sees Save your progress and Exit to menu (no email, no sign-out)', () => {
    authValue = { isAnonymous: true, user: null, signOut: vi.fn(), linkEmail: vi.fn() };
    render(<SettingsSheet onClose={() => {}} onExitToMenu={() => {}} />);
    expect(screen.getByRole('button', { name: /save your progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exit to menu/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
  });

  it('guest Save your progress opens the sign-up form', () => {
    authValue = { isAnonymous: true, user: null, signOut: vi.fn(), linkEmail: vi.fn() };
    render(<SettingsSheet onClose={() => {}} onExitToMenu={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /save your progress/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create & play/i })).toBeInTheDocument();
  });

  it('guest Exit to menu calls onExitToMenu', () => {
    const onExitToMenu = vi.fn();
    authValue = { isAnonymous: true, user: null, signOut: vi.fn(), linkEmail: vi.fn() };
    render(<SettingsSheet onClose={() => {}} onExitToMenu={onExitToMenu} />);
    fireEvent.click(screen.getByRole('button', { name: /exit to menu/i }));
    expect(onExitToMenu).toHaveBeenCalled();
  });

  it('Replay intro fires the callback', () => {
    const onReplayIntro = vi.fn();
    render(<SettingsSheet onClose={() => {}} onReplayIntro={onReplayIntro} onExitToMenu={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /replay intro/i }));
    expect(onReplayIntro).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/components/SettingsSheet.test.tsx`
Expected: FAIL — Account controls don't exist yet.

- [ ] **Step 3: Rewrite `src/components/SettingsSheet.tsx`**

```tsx
import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useAuth } from '../auth/useAuth';
import type { ChannelName } from '../audio/mixer';
import { PressButton } from './PressButton';
import { SignUpForm } from './account/SignUpForm';

const CHANNELS: { key: 'master' | ChannelName; label: string }[] = [
  { key: 'master', label: 'Master' },
  { key: 'sfx', label: 'SFX' },
  { key: 'music', label: 'Music' },
  { key: 'voice', label: 'Voice' },
];

/**
 * Settings page (bottom sheet): Account section + per-channel audio mixer.
 * Account branches on the explicit `isAnonymous` flag (never derived from
 * `user`): a guest gets "Save your progress" (links the anon account) and
 * "Exit to menu"; a real user gets their email + "Sign out". Every sign-out /
 * exit calls `onExitToMenu` so PlayerRoot's guestPlay flag is reset.
 */
export function SettingsSheet({ onClose, onReplayIntro, onExitToMenu }: {
  onClose: () => void;
  onReplayIntro?: () => void;
  onExitToMenu?: () => void;
}) {
  const { isAnonymous, user, signOut } = useAuth();
  const [saving, setSaving] = useState(false); // guest tapped "Save your progress"
  const audio = useGameStore((s) => s.audio);
  const setChannelLevel = useGameStore((s) => s.setChannelLevel);
  const toggleChannelMute = useGameStore((s) => s.toggleChannelMute);

  const replay = () => { onClose(); onReplayIntro?.(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Settings</h2>
        </div>

        {/* ── Account ── */}
        <section aria-label="Account" className="mb-5">
          {isAnonymous ? (
            saving ? (
              <SignUpForm onDone={onClose} />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-500">Playing as a guest. Create an account to keep your pets.</p>
                <PressButton
                  onClick={() => setSaving(true)}
                  className="rounded-xl bg-emerald-500 py-3 font-semibold text-white"
                >
                  Save your progress
                </PressButton>
                <button
                  type="button"
                  onClick={() => { onExitToMenu?.(); onClose(); }}
                  className="rounded-xl py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  Exit to menu
                </button>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-slate-700">{user?.email}</span>
              <button
                type="button"
                onClick={async () => { await signOut(); onExitToMenu?.(); }}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          )}

          {onReplayIntro && (
            <button
              type="button"
              onClick={replay}
              className="mt-3 text-sm font-semibold text-slate-400 hover:text-slate-700"
            >
              Replay intro
            </button>
          )}
        </section>

        {/* ── Sound ── */}
        <section aria-label="Sound">
          <h3 className="mb-2 text-sm font-bold text-slate-500">Sound</h3>
          <ul className="space-y-4">
            {CHANNELS.map(({ key, label }) => {
              const ch = audio[key];
              const id = `vol-${key}`;
              // A channel greys when its own mute is on, or — for non-master channels —
              // when Master (the global mute) is muted.
              const disabled = ch.muted || (key !== 'master' && audio.master.muted);
              return (
                <li key={key} className={`flex items-center gap-3 ${disabled ? 'opacity-40' : ''}`}>
                  <button
                    type="button"
                    aria-label={`${label} ${ch.muted ? 'unmute' : 'mute'}`}
                    onClick={() => toggleChannelMute(key)}
                    className="w-8 text-xl"
                  >
                    {ch.muted ? '🔇' : '🔊'}
                  </button>
                  <label htmlFor={id} className="w-16 text-sm font-medium">{label}</label>
                  <input
                    id={id}
                    aria-label={`${label} volume`}
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={ch.level}
                    aria-valuetext={`${Math.round(ch.level * 100)}%`}
                    disabled={disabled}
                    onChange={(e) => setChannelLevel(key, Number(e.target.value))}
                    className={`flex-1 ${disabled ? 'accent-slate-400' : 'accent-emerald-500'}`}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <PressButton onClick={onClose} className="mt-5 w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white">
          Done
        </PressButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/components/SettingsSheet.test.tsx`
Expected: PASS (sound tests + new account tests).

- [ ] **Step 5: Impeccable craft pass on the Account section**

Invoke the **impeccable** skill (register = product/app UI) to polish the Account section + sheet layout: the guest "Save your progress" CTA hierarchy vs the quieter "Exit to menu", the real-user email/sign-out row, section dividers, and copy. Keep all `aria-label`/role/button-name text the tests assert on unchanged. Re-run `npm test -- src/components/SettingsSheet.test.tsx` after — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsSheet.tsx src/components/SettingsSheet.test.tsx
git commit -m "feat(settings): add Account section (guest save / sign-out / replay) to the settings sheet"
```

---

### Task 4: App — global gear, remove top-bar AccountButton

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Add a failing test for the global gear**

In `src/App.test.tsx`, update the `useAuth` mock (lines 24-26) so the opened Settings sheet has what it needs, then add a test. Replace the mock:

```tsx
vi.mock('./auth/useAuth', () => ({
  useAuth: () => ({ user: null, isAnonymous: true, signOut: vi.fn(), linkEmail: vi.fn() }),
}));
```

Add this test inside the `describe('App — zone wiring ...')` block (it already has the music provider setup/teardown; the gear test doesn't need the music spy but the teardown is harmless):

```tsx
it('a global gear button opens the Settings dialog', async () => {
  const userEvent = (await import('@testing-library/user-event')).default;
  useGameStore.setState((s) => ({
    pets: s.pets.map((p) => ({ ...p, hatched: true })),
    screen: 'petRoom',
  }));
  const { getByLabelText, getByRole } = render(<App />);
  await userEvent.click(getByLabelText('Settings'));
  expect(getByRole('dialog')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL — no element labelled "Settings" in `App`.

- [ ] **Step 3: Edit `src/App.tsx`**

Change the imports (lines 1, 18) — replace the `AccountButton` import with `SettingsSheet`, and add `useState`:

```tsx
import { useEffect, useMemo, useState } from 'react';
```
```tsx
import { SettingsSheet } from './components/SettingsSheet';
```
(Delete the line `import { AccountButton } from './components/account/AccountButton';`.)

Replace the `App` default export (lines 110-119) with:

```tsx
export default function App({ onReplayIntro, onExitToMenu }: { onReplayIntro?: () => void; onExitToMenu?: () => void } = {}) {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        {/* Global settings entry — replaces the old per-screen gear + top-bar account row */}
        <button
          type="button"
          aria-label="Settings"
          onClick={() => setShowSettings(true)}
          className="absolute right-3 top-2 z-40 rounded-full bg-white/85 px-2 py-1 text-[15px] shadow"
        >
          ⚙️
        </button>
        <CurrentScreen />
        {showSettings && (
          <SettingsSheet
            onClose={() => setShowSettings(false)}
            onReplayIntro={onReplayIntro}
            onExitToMenu={onExitToMenu}
          />
        )}
      </AppShell>
    </MotionConfig>
  );
}
```

Note: `AppShell`'s `<main>` is the positioning context for `absolute`; the gear pins to the top-right of the centered column. Exact placement/collision with the PetRoom HUD is refined in Step 5.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Impeccable placement pass on the global gear**

Invoke the **impeccable** skill to place the global gear so it does not collide with screen chrome — notably the PetRoom HUD's coins / "My Pets" pill in the same top-right corner (`PetRoom.tsx:97-103`). Confirm it reads as a persistent affordance across petRoom / journey / shop / drill without overlapping each screen's own controls. Keep `aria-label="Settings"`. Re-run `npm test -- src/App.test.tsx` after — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(settings): global gear opens Settings; remove top-bar AccountButton"
```

---

### Task 5: PetRoom — remove the local gear

**Files:**
- Modify: `src/components/PetRoom.tsx`
- Test: `src/components/PetRoom.test.tsx`

- [ ] **Step 1: Remove the PetRoom gear test**

In `src/components/PetRoom.test.tsx`, delete the entire `describe('PetRoom sound settings gear', ...)` block (lines 131-139). The global gear lives in `App` now and is covered by `App.test.tsx`.

- [ ] **Step 2: Edit `src/components/PetRoom.tsx`**

1. Delete the import (line 2): `import { SettingsSheet } from './SettingsSheet';`
2. Delete the state (line 32): `const [showSettings, setShowSettings] = useState(false);`
3. Delete the gear button (line 101):
```tsx
              <PressButton onClick={() => setShowSettings(true)} aria-label="Sound settings" className="rounded-full bg-white/85 px-2 py-1 text-[13px] shadow">⚙️</PressButton>
```
The surrounding `<div className="flex items-center gap-1">` (lines 99-102) now wraps only the "My Pets" button — leave that div in place.
4. Delete the render line (188): `{showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}`

- [ ] **Step 3: Run the PetRoom tests**

Run: `npm test -- src/components/PetRoom.test.tsx`
Expected: PASS (gear test removed; tabs/feed tests unaffected). No unused-var/TS errors from the removed `showSettings`.

- [ ] **Step 4: Commit**

```bash
git add src/components/PetRoom.tsx src/components/PetRoom.test.tsx
git commit -m "refactor(petroom): drop local gear; settings is now global in App"
```

---

### Task 6: Delete the absorbed AccountButton

**Files:**
- Delete: `src/components/account/AccountButton.tsx`
- Delete: `src/components/account/AccountButton.test.tsx`

- [ ] **Step 1: Confirm there are no remaining importers**

Run: `git grep -n "AccountButton" -- src`
Expected: no matches (App's import was removed in Task 4). If any remain, remove them before deleting.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/account/AccountButton.tsx src/components/account/AccountButton.test.tsx
```

- [ ] **Step 3: Run the full unit suite**

Run: `npm test`
Expected: PASS — no broken imports.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(account): remove AccountButton (absorbed into Settings)"
```

---

### Task 7: Full verification + manual check

**Files:** none (verification only)

- [ ] **Step 1: Unit tests + typecheck/build**

Run: `npm test`
Expected: PASS (full suite, ~700+ tests).

Run: `npm run build`
Expected: succeeds, no TS errors.

- [ ] **Step 2: e2e**

Run: `npm run e2e`
Expected: PASS. Boss **test B self-skips** when the Firebase test account is unavailable (`e2e/boss.spec.ts:127`) — expected, not a regression.

- [ ] **Step 3: Manual smoke (dev)**

Run: `npm run dev` (reads the printed port; do not assume 5173).
Verify by hand:
1. Signed-out → MainMenu → tap to start → choose sheet shows **New Game / Continue / Play as guest**.
2. Tap **Play as guest** → intro plays → lands in the game (PetRoom).
3. Tap the global **⚙️** → Settings opens with **Save your progress** + **Exit to menu** (guest), and the **Sound** mixer below.
4. **Save your progress** → sign-up form → create account → returns to game; reopen ⚙️ → now shows **email + Sign out**.
5. **Sign out** → back to MainMenu; **Play as guest** again → progress preserved (same anon localStorage).
6. **Exit to menu** (as a guest) → MainMenu, progress preserved.

- [ ] **Step 4: Final whole-feature review + finish the branch**

Use `superpowers:requesting-code-review` for a whole-feature review, then `superpowers:finishing-a-development-branch` to decide merge/PR. Stage explicit files only; never `git add -A`; never stage `firebase.json`.

---

## Self-review notes

- **Spec coverage:** Part A guest path → Tasks 1-2; Part B Settings page (account + sound, global gear, AccountButton removal) → Tasks 3-6; tests/verify → Task 7. Sign-out "keep local, back to menu" → Task 1 routing + Task 3 sign-out calls `onExitToMenu`. Intro-first for guest → Task 1 (`onPlayGuest` sets `pendingIntro`).
- **Stale-guestPlay hazard:** a linked-then-signed-out user is handled because the real-user Sign out (Task 3) also calls `onExitToMenu`, resetting `guestPlay`.
- **Type consistency:** `onPlayGuest`/`onExitToMenu`/`onReplayIntro` names match across `PlayerRoot` → `MainMenu`/`App` → `SettingsSheet`. `SignUpForm` consumed via its existing `onDone` prop.

# Main Menu + Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a game title-screen main menu (shown when signed out) that houses New Game (sign up) and Continue (sign in), plus a placeholder intro cutscene — making the sign-in / cloud-wins path reachable and reframing onboarding so an account is required to play.

**Architecture:** A new top-level `PlayerRoot` routes by auth state — loading → splash, anonymous → `MainMenu`, signed-up-this-session → `IntroVideo`, signed-in → the existing `App` (game). `MainMenu` is a small view state machine (title → choose → sign up / sign in). The new `SignInForm` calls the already-wired `signIn` (cloud-wins reconcile). No persist/rules/schema changes.

**Tech Stack:** Vite + React 19 + TS ~6 + Tailwind v4 + Zustand + Firebase v12 + Vitest 4 + @testing-library/react.

---

## Background the implementer must know

- **Build dir (run ALL git/node here):** `D:\ai_projects\AI_design_thinking\sentence-pet`. The Bash tool runs **POSIX bash, NOT PowerShell**, and resets cwd between calls — prefix every command: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && <cmd>`.
- **Branch:** all work stays on `student-accounts-cloud-save` (already checked out; the spec is committed there). Verify with `git branch --show-current` before committing. Do NOT switch branches.
- **Typecheck = `npx tsc -b`** (plain `tsc --noEmit` is a no-op here). `npm run build` runs `tsc -b && vite build`. Tests: `npx vitest run <path>` or `npm test`.
- **jsdom limits:** mock `canvas-confetti` in any test that transitively imports `src/effects/celebrate.ts`. Firebase/auth in components → mock `src/auth/useAuth` (the established convention — see `src/components/account/SignUpForm.test.tsx`). `vi.mock` factories must NOT directly reference plain top-level `const`s (TDZ) — but the lazy `useAuth: () => authValue` / `() => ({ ... })` pattern below is safe.
- **Spec:** `docs/superpowers/specs/2026-06-26-main-menu-and-signin-design.md`.
- **Already built (slice 3):** `useAuth()` returns `{ user, isAdmin, isAnonymous, loading, signIn, linkEmail, signOut }`. `signIn(email,pw)` already reconciles cloud-wins inside `AuthProvider`. `linkEmail` upgrades the anon user to email. `AuthProvider player` wraps the player tree in `main.tsx`. `App.tsx` is the game (AppShell + CurrentScreen) and currently mounts `<AccountButton/>`.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/components/account/SignInForm.tsx` (create) | email+password → `useAuth().signIn` (the gap fix) | 1 |
| `src/components/account/SignUpForm.tsx` (modify) | relabel CTA "Create & Play ▸" (New Game framing) | 2 |
| `src/config/intro.ts` (create) | `INTRO_VIDEO_SRC` placeholder seam | 3 |
| `src/components/menu/IntroVideo.tsx` (create) | placeholder full-screen cutscene + Skip → onDone | 3 |
| `src/components/account/AccountButton.tsx` (modify) | signed-in-only (email + Sign out); drop guest/SignUpForm branch | 4 |
| `src/components/menu/TitleScene.tsx` (create) | presentational hero title art (pet + pulse) | 5 |
| `src/components/menu/MainMenu.tsx` (create) | title → choose → sign up / sign in state machine | 5 |
| `src/PlayerRoot.tsx` (create) | auth-state router (loading/menu/intro/game) | 6 |
| `src/main.tsx` (modify) | render `<PlayerRoot/>` instead of `<App/>` | 7 |

`src/App.tsx` is **unchanged**: it stays the game and keeps `<AccountButton/>` mounted (now the signed-in sign-out control). `PlayerRoot` only renders `<App/>` when signed in, so `AccountButton` there always shows the signed-in branch.

---

## Task 1: SignInForm (the gap fix)

**Files:**
- Create: `src/components/account/SignInForm.tsx`
- Test: `src/components/account/SignInForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/account/SignInForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const signIn = vi.fn().mockResolvedValue(undefined);
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ signIn }) }));

import { SignInForm } from './SignInForm';

beforeEach(() => signIn.mockClear());

describe('SignInForm', () => {
  it('submits email + password to signIn', async () => {
    render(<SignInForm onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'k@s.th' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw123456' } });
    fireEvent.click(screen.getByRole('button', { name: /continue|sign in/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('k@s.th', 'pw123456'));
  });

  it('shows an error message when sign-in fails', async () => {
    signIn.mockRejectedValueOnce(new Error('auth/wrong-password'));
    render(<SignInForm onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'k@s.th' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /continue|sign in/i }));
    expect(await screen.findByText(/wrong-password|couldn't|could not/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/account/SignInForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/account/SignInForm.tsx`**

```tsx
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';

/** Returning-player sign-in. signIn() reconciles cloud-wins in AuthProvider. Polish via impeccable later. */
export function SignInForm({ onDone }: { onDone: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign you in.");
      return;
    } finally {
      setBusy(false);
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 p-3">
      <p className="text-sm font-bold">Welcome back!</p>
      <label className="flex flex-col text-sm">
        Email
        <input
          type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col text-sm">
        Password
        <input
          type="password" required value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="rounded bg-amber-500 px-3 py-1 font-bold text-amber-950 disabled:opacity-50">
        {busy ? 'Loading…' : 'Continue ▸'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/account/SignInForm.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/components/account/SignInForm.tsx src/components/account/SignInForm.test.tsx && git commit -m "feat(account): SignInForm (Continue) — surfaces the cloud-wins sign-in path"
```

---

## Task 2: SignUpForm — New Game framing

**Files:**
- Modify: `src/components/account/SignUpForm.tsx` (lines 28–49 region: the intro `<p>` and the submit button text)

The existing `SignUpForm.test.tsx` matches the submit button with `/save|sign up|create/i`; "Create & Play ▸" still matches ("create"), so the test stays green.

- [ ] **Step 1: Change the copy + CTA**

In `src/components/account/SignUpForm.tsx`, change the intro paragraph (line ~29) from:
```tsx
      <p className="text-sm">Save your pets across devices.</p>
```
to:
```tsx
      <p className="text-sm font-bold">New Game</p>
```
and change the submit button (line ~47–49) from:
```tsx
      <button type="submit" disabled={busy} className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-50">
        {busy ? 'Saving…' : 'Save my pets'}
      </button>
```
to:
```tsx
      <button type="submit" disabled={busy} className="rounded bg-emerald-500 px-3 py-1 font-bold text-emerald-950 disabled:opacity-50">
        {busy ? 'Saving…' : 'Create & Play ▸'}
      </button>
```
Leave the rest of the component (the `linkEmail` logic, labels, error) unchanged.

- [ ] **Step 2: Run the SignUpForm test to confirm still green**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/account/SignUpForm.test.tsx`
Expected: PASS (2 tests) — the button matcher `/save|sign up|create/i` still matches "Create & Play".

- [ ] **Step 3: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/components/account/SignUpForm.tsx && git commit -m "feat(account): SignUpForm New Game framing (Create & Play CTA)"
```

---

## Task 3: IntroVideo placeholder + config seam

**Files:**
- Create: `src/config/intro.ts`
- Create: `src/components/menu/IntroVideo.tsx`
- Test: `src/components/menu/IntroVideo.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/menu/IntroVideo.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntroVideo } from './IntroVideo';

describe('IntroVideo', () => {
  it('renders the placeholder while there is no real asset', () => {
    render(<IntroVideo onDone={() => {}} />);
    expect(screen.getByTestId('intro-placeholder')).toBeInTheDocument();
  });

  it('Skip calls onDone', () => {
    const onDone = vi.fn();
    render(<IntroVideo onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onDone).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/menu/IntroVideo.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the config seam + component**

Create `src/config/intro.ts`:
```ts
/** Intro cutscene source. Empty = show the placeholder; the partner's art pipeline drops the real clip here later. */
export const INTRO_VIDEO_SRC = '';
```

Create `src/components/menu/IntroVideo.tsx`:
```tsx
import { INTRO_VIDEO_SRC } from '../../config/intro';

/** Full-screen intro cutscene. Placeholder until INTRO_VIDEO_SRC is set. Skip or end → onDone. */
export function IntroVideo({ onDone }: { onDone: () => void }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-slate-900 text-white">
      {INTRO_VIDEO_SRC ? (
        <video src={INTRO_VIDEO_SRC} autoPlay playsInline onEnded={onDone} className="max-h-full max-w-full" />
      ) : (
        <div className="flex flex-col items-center gap-3" data-testid="intro-placeholder">
          <span className="text-6xl">🎬</span>
          <p className="text-sm opacity-80">Your adventure begins…</p>
        </div>
      )}
      <button
        type="button"
        onClick={onDone}
        className="absolute bottom-6 right-6 rounded-full bg-white/15 px-4 py-2 text-sm"
      >
        Skip ▸
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/menu/IntroVideo.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/config/intro.ts src/components/menu/IntroVideo.tsx src/components/menu/IntroVideo.test.tsx && git commit -m "feat(menu): IntroVideo placeholder cutscene + Skip"
```

---

## Task 4: AccountButton → signed-in-only

**Files:**
- Modify: `src/components/account/AccountButton.tsx` (full rewrite)
- Modify: `src/components/account/AccountButton.test.tsx` (full rewrite)

The signup/link path now lives in the menu, so `AccountButton` becomes purely the in-game signed-in control (email + Sign out).

- [ ] **Step 1: Rewrite the test**

Replace the ENTIRE contents of `src/components/account/AccountButton.test.tsx` with:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let authValue: { isAnonymous: boolean; user: { email: string | null } | null; loading: boolean; signOut: () => void };
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authValue }));

import { AccountButton } from './AccountButton';

describe('AccountButton', () => {
  it('signed-in student sees their email and a sign-out button', () => {
    const signOut = vi.fn();
    authValue = { isAnonymous: false, user: { email: 'k@s.th' }, loading: false, signOut };
    render(<AccountButton />);
    expect(screen.getByText(/k@s\.th/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it('anonymous guest renders nothing (menu owns sign-up)', () => {
    authValue = { isAnonymous: true, user: null, loading: false, signOut: vi.fn() };
    const { container } = render(<AccountButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while auth is loading', () => {
    authValue = { isAnonymous: false, user: null, loading: true, signOut: vi.fn() };
    const { container } = render(<AccountButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/account/AccountButton.test.tsx`
Expected: FAIL — the "anonymous guest renders nothing" test fails because the current component renders the "Save your pets" button for anonymous users.

- [ ] **Step 3: Rewrite the component**

Replace the ENTIRE contents of `src/components/account/AccountButton.tsx` with:
```tsx
import { useAuth } from '../../auth/useAuth';

/** In-game signed-in control: shows the account email + Sign out. Hidden for guests (the menu owns sign-up). */
export function AccountButton() {
  const { isAnonymous, user, loading, signOut } = useAuth();
  if (loading || isAnonymous || !user) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{user.email}</span>
      <button type="button" onClick={() => void signOut()} className="rounded border px-2 py-1">
        Sign out
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/account/AccountButton.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/components/account/AccountButton.tsx src/components/account/AccountButton.test.tsx && git commit -m "refactor(account): AccountButton is signed-in-only (menu owns sign-up)"
```

---

## Task 5: MainMenu + TitleScene

**Files:**
- Create: `src/components/menu/TitleScene.tsx`
- Create: `src/components/menu/MainMenu.tsx`
- Test: `src/components/menu/MainMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/menu/MainMenu.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// SignUpForm/SignInForm call useAuth(); provide both methods. The forms resolve the
// same '../../auth/useAuth' module, so this mock covers them too.
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ linkEmail: vi.fn().mockResolvedValue(undefined), signIn: vi.fn().mockResolvedValue(undefined) }),
}));

import { MainMenu } from './MainMenu';

function openChoose() {
  render(<MainMenu onSignedUp={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /tap to start/i }));
}

describe('MainMenu', () => {
  it('tapping the title reveals New Game and Continue', () => {
    openChoose();
    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('New Game opens the sign-up form', () => {
    openChoose();
    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create & play/i })).toBeInTheDocument();
  });

  it('Continue opens the sign-in form', () => {
    openChoose();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('Back returns from a form to the choose screen', () => {
    openChoose();
    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/menu/MainMenu.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/menu/TitleScene.tsx`**

```tsx
/** Presentational hero title art. Real art lands via impeccable + the partner's pipeline. */
export function TitleScene() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-teal-600 to-emerald-200 text-center">
      <h1 className="mt-6 -rotate-3 text-3xl font-black text-emerald-950 drop-shadow">Sentence Pet</h1>
      <div className="my-8 text-7xl drop-shadow-lg">🐣</div>
      <p className="absolute bottom-10 animate-pulse font-bold tracking-widest text-emerald-950">▷ TAP TO START</p>
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/components/menu/MainMenu.tsx`**

```tsx
import { useState } from 'react';
import { AppShell } from '../AppShell';
import { TitleScene } from './TitleScene';
import { SignUpForm } from '../account/SignUpForm';
import { SignInForm } from '../account/SignInForm';

type View = 'title' | 'choose' | 'signup' | 'signin';

/** Signed-out title screen: tap to start, then New Game (sign up) or Continue (sign in). */
export function MainMenu({ onSignedUp }: { onSignedUp: () => void }) {
  const [view, setView] = useState<View>('title');

  return (
    <AppShell>
      <div className="flex min-h-[100dvh] flex-col">
        {view === 'title' && (
          <button type="button" onClick={() => setView('choose')} aria-label="Tap to start" className="flex flex-1 flex-col">
            <TitleScene />
          </button>
        )}

        {view === 'choose' && (
          <div className="flex flex-1 flex-col justify-end gap-3 p-5">
            <button type="button" onClick={() => setView('signup')} className="rounded-2xl bg-emerald-500 px-4 py-4 text-lg font-black text-emerald-950 shadow">
              ▶ New Game
            </button>
            <button type="button" onClick={() => setView('signin')} className="rounded-2xl bg-amber-400 px-4 py-4 text-lg font-black text-amber-950 shadow">
              ↪ Continue
            </button>
          </div>
        )}

        {(view === 'signup' || view === 'signin') && (
          <div className="flex flex-1 flex-col justify-end">
            <button type="button" onClick={() => setView('choose')} aria-label="Back" className="m-3 self-start rounded-full border px-3 py-1">
              ‹ Back
            </button>
            {view === 'signup'
              ? <SignUpForm onDone={onSignedUp} />
              : <SignInForm onDone={() => { /* routing flips on the auth change */ }} />}
          </div>
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/menu/MainMenu.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/components/menu/TitleScene.tsx src/components/menu/MainMenu.tsx src/components/menu/MainMenu.test.tsx && git commit -m "feat(menu): MainMenu title screen with New Game / Continue"
```

---

## Task 6: PlayerRoot auth-state router

**Files:**
- Create: `src/PlayerRoot.tsx`
- Test: `src/PlayerRoot.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/PlayerRoot.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let authValue: { loading: boolean; isAnonymous: boolean };
vi.mock('./auth/useAuth', () => ({ useAuth: () => authValue }));
// Stub the heavy children so we only test routing.
vi.mock('./components/menu/MainMenu', () => ({
  MainMenu: ({ onSignedUp }: { onSignedUp: () => void }) => <button onClick={onSignedUp}>MENU</button>,
}));
vi.mock('./components/menu/IntroVideo', () => ({
  IntroVideo: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>INTRO</button>,
}));
vi.mock('./App', () => ({ default: () => <div>GAME</div> }));

import { PlayerRoot } from './PlayerRoot';

describe('PlayerRoot routing', () => {
  it('loading shows neither menu nor game', () => {
    authValue = { loading: true, isAnonymous: false };
    render(<PlayerRoot />);
    expect(screen.queryByText('MENU')).toBeNull();
    expect(screen.queryByText('GAME')).toBeNull();
  });

  it('anonymous shows the MainMenu', () => {
    authValue = { loading: false, isAnonymous: true };
    render(<PlayerRoot />);
    expect(screen.getByText('MENU')).toBeInTheDocument();
  });

  it('signed-in shows the game', () => {
    authValue = { loading: false, isAnonymous: false };
    render(<PlayerRoot />);
    expect(screen.getByText('GAME')).toBeInTheDocument();
  });

  it('after sign-up the intro plays, then the game when done', () => {
    authValue = { loading: false, isAnonymous: true };
    const { rerender } = render(<PlayerRoot />);
    fireEvent.click(screen.getByText('MENU'));     // onSignedUp → pendingIntro = true
    authValue = { loading: false, isAnonymous: false }; // auth flips after the link
    rerender(<PlayerRoot />);
    expect(screen.getByText('INTRO')).toBeInTheDocument();
    fireEvent.click(screen.getByText('INTRO'));     // onDone → pendingIntro = false
    expect(screen.getByText('GAME')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/PlayerRoot.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/PlayerRoot.tsx`**

```tsx
import { useState } from 'react';
import { useAuth } from './auth/useAuth';
import { AppShell } from './components/AppShell';
import { MainMenu } from './components/menu/MainMenu';
import { IntroVideo } from './components/menu/IntroVideo';
import App from './App';

/** Top-level player router: loading → splash, signed-out → menu, just-signed-up → intro, signed-in → game. */
export function PlayerRoot() {
  const { loading, isAnonymous } = useAuth();
  const [pendingIntro, setPendingIntro] = useState(false);

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center text-5xl">🥚</div>
      </AppShell>
    );
  }
  if (isAnonymous) {
    return <MainMenu onSignedUp={() => setPendingIntro(true)} />;
  }
  if (pendingIntro) {
    return <IntroVideo onDone={() => setPendingIntro(false)} />;
  }
  return <App />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/PlayerRoot.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/PlayerRoot.tsx src/PlayerRoot.test.tsx && git commit -m "feat: PlayerRoot auth-state router (menu / intro / game)"
```

---

## Task 7: Wire main.tsx + green bar

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Swap App for PlayerRoot in `src/main.tsx`**

Change the App import line:
```tsx
import App from './App.tsx'
```
to:
```tsx
import { PlayerRoot } from './PlayerRoot.tsx'
```
Then change the player branch of `root` from:
```tsx
  : <AuthProvider player><App /></AuthProvider>
```
to:
```tsx
  : <AuthProvider player><PlayerRoot /></AuthProvider>
```
Leave the admin branch, `hydrateContent`, the `window.store` dev hook, and `StrictMode` untouched. (`App` is now imported by `PlayerRoot`, not `main.tsx`.)

- [ ] **Step 2: Typecheck + build**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm run build`
Expected: both clean.

- [ ] **Step 3: Full suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test`
Expected: green. `App.test.tsx` only exercises the pure `screenKeyAndNode` export (it never renders `<App/>`), so the routing change doesn't affect it.

- [ ] **Step 4: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/main.tsx && git commit -m "feat: route the player tree through PlayerRoot"
```

---

## Task 8: Full-branch verification + browser E2E re-run

**Files:** none (verification only). The browser/emulator steps need the main thread (subagent sandboxes block localhost + need JDK).

- [ ] **Step 1: Green-bar the whole branch**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm run build && npm test`
Expected: typecheck clean, build clean, full vitest green (rules suite skips without Java).

- [ ] **Step 2: Rules suite under the emulator** (confirm unaffected)

PowerShell:
```
Set-Location "D:\ai_projects\AI_design_thinking\sentence-pet"; $env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules
```
Expected: all rules tests PASS (unchanged from slice 3).

- [ ] **Step 3: Browser E2E — the C3 path must now PASS**

Re-run the slice-3 style Playwright E2E against the auth+firestore emulators (throwaway `playwright`, installed then `git checkout -- package.json package-lock.json`; temp `.env.local` pointing at the emulator, restored after). The flow now reachable via the menu:
1. Load app → title screen → tap → **New Game** → sign up → (intro Skip) → game; confirm `users/{uid}/meta/profile` + `pets/*` written and a distinctive state (e.g. coins) syncs.
2. Fresh browser context → title → tap → **Continue** → sign in with that email → confirm local state is overwritten by the cloud save (cloud-wins): the previously-failing C3 check passes.

- [ ] **Step 4: Final whole-branch review + finish**

Dispatch a final reviewer over `git diff main...HEAD` for the whole slice (3 + 3.5), then hand off to `superpowers:finishing-a-development-branch`.

---

## Notes / known limitations (in scope by decision)

- **Account required to play:** anonymous users never reach the game (menu gate); the anon account is an internal bootstrap linked at New Game. Guest play is intentionally removed.
- **Intro is a placeholder:** `INTRO_VIDEO_SRC` is empty; the real cutscene drops in later. A mid-intro reload skips to the game (transient `pendingIntro`), which is acceptable for a skippable placeholder.
- **Visual fidelity is functional, not final:** title art, sheets, and copy get a real pass via `impeccable` + the partner's art pipeline.

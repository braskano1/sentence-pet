# Firebase Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a thin, end-to-end Firebase base (init + email/password auth + admin custom claim + Firestore ping round-trip behind a gated `#admin` entry) proven by emulator-based security-rules tests.

**Architecture:** Approach A — a thin module layer (`src/firebase/*`) wrapping the Firebase Web SDK, a React auth context (`src/auth/*`) exposing `{user, isAdmin, loading, signIn, signOut}` with `isAdmin` read from the ID-token custom claim, and a minimal gated admin shell (`src/components/admin/*`). The player app is untouched except a single entry branch in `main.tsx`. Admin claim is granted by a one-shot local `firebase-admin` script; no Cloud Functions, so the project stays on the Spark plan.

**Tech Stack:** React 19 + Vite 8 + TypeScript ~6 + Vitest 4 (jsdom) · `firebase` (web SDK, modular v10+) · dev: `firebase-tools` (emulator), `@firebase/rules-unit-testing`, `firebase-admin`.

**Conventions (carry forward):**
- All git/node work in `D:\ai_projects\AI_design_thinking\sentence-pet`. The Bash tool resets cwd — prefix every command with `cd "D:\ai_projects\AI_design_thinking\sentence-pet" &&`.
- Typecheck is `npx tsc -b` (root `tsconfig.json` has `"files":[]` so `tsc --noEmit` is a no-op). Build is `npm run build`. Full test run is `npm test` (`vitest run`).
- Branch already created: `firebase-foundation` (off `main`). Spec: `docs/superpowers/specs/2026-06-26-firebase-foundation-design.md`.
- No persist version bump this slice (no Zustand schema change).

**Spec → task coverage:** Architecture/modules → Tasks 2–6. Tracer flow → Tasks 4–6. Data model + rules → Task 7. Custom-claim mechanism → Task 8. Emulator/testing → Tasks 3–7. Console steps/docs → Task 8.

---

### Task 1: Dependencies, env scaffolding, gitignore

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Install runtime + dev dependencies**

Run:
```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm install firebase && npm install -D firebase-tools @firebase/rules-unit-testing firebase-admin
```
Expected: installs succeed; `firebase` under `dependencies`, the other three under `devDependencies` in `package.json`.

- [ ] **Step 2: Add npm scripts**

In `package.json` `"scripts"`, add (keep existing scripts):
```json
"emulators": "firebase emulators:start --only auth,firestore",
"test:rules": "firebase emulators:exec --only firestore \"vitest run src/firebase/rules.test.ts\"",
"set-admin": "node scripts/set-admin-claim.mjs"
```

- [ ] **Step 3: Create `.env.example`**

```
# Firebase Web config (NOT secret — safe in client bundle). Copy to .env.local and fill.
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
# Set to 'true' to point dev/test at the local emulator instead of cloud.
VITE_USE_EMULATOR=false
```

- [ ] **Step 4: Append to `.gitignore`**

```
# Firebase
.env.local
*.serviceAccount.json
serviceAccountKey.json
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log
```

- [ ] **Step 5: Verify typecheck + tests still clean**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm test`
Expected: tsc clean; all existing tests pass (no new tests yet).

- [ ] **Step 6: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add package.json package-lock.json .env.example .gitignore && git commit -m "chore: add firebase deps, env template, gitignore"
```

---

### Task 2: Firebase init modules (app, db, auth)

**Files:**
- Create: `src/firebase/app.ts`
- Create: `src/firebase/db.ts`
- Create: `src/firebase/auth.ts`
- Test: `src/firebase/init.test.ts`

- [ ] **Step 1: Write the failing test**

`src/firebase/init.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { firebaseApp } from './app';
import { db } from './db';
import { auth, signIn, signOutUser, onAuthChange } from './auth';

describe('firebase init', () => {
  it('exports an initialized app, db, and auth', () => {
    expect(firebaseApp).toBeTruthy();
    expect(db).toBeTruthy();
    expect(auth).toBeTruthy();
  });

  it('exposes auth helpers', () => {
    expect(typeof signIn).toBe('function');
    expect(typeof signOutUser).toBe('function');
    expect(typeof onAuthChange).toBe('function');
  });
});
```
Note: `initializeApp`/`getFirestore`/`getAuth` are lazy and make no network call, so this runs in jsdom without an emulator or real project.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/firebase/init.test.ts`
Expected: FAIL — cannot resolve `./app` / `./db` / `./auth`.

- [ ] **Step 3: Implement `src/firebase/app.ts`**

```ts
// Firebase app singleton. Web config is NOT secret; env vars keep it per-environment.
import { initializeApp, type FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
```

- [ ] **Step 4: Implement `src/firebase/db.ts`**

```ts
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { firebaseApp } from './app';

export const db = getFirestore(firebaseApp);

// Point at the local Firestore emulator when explicitly enabled.
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
```

- [ ] **Step 5: Implement `src/firebase/auth.ts`**

```ts
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator,
  type User,
} from 'firebase/auth';
import { firebaseApp } from './app';

export const auth = getAuth(firebaseApp);

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

export function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/firebase/init.test.ts && npx tsc -b`
Expected: PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/firebase/app.ts src/firebase/db.ts src/firebase/auth.ts src/firebase/init.test.ts && git commit -m "feat: firebase init modules (app, db, auth) with emulator wiring"
```

---

### Task 3: Auth context (AuthProvider + useAuth)

**Files:**
- Create: `src/auth/AuthProvider.tsx`
- Create: `src/auth/useAuth.ts`
- Test: `src/auth/AuthProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/auth/AuthProvider.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';

// Controls what the mocked onAuthChange emits.
let emit: (u: User | null) => void = () => {};

vi.mock('../firebase/auth', () => ({
  onAuthChange: (cb: (u: User | null) => void) => {
    emit = cb;
    return () => {};
  },
  signIn: vi.fn(),
  signOutUser: vi.fn(),
}));

import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

function Probe() {
  const { user, isAdmin, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
    </div>
  );
}

function fakeUser(admin: boolean): User {
  return {
    uid: 'u1',
    email: 'a@b.com',
    getIdTokenResult: async () => ({ claims: { admin } }),
  } as unknown as User;
}

describe('AuthProvider', () => {
  beforeEach(() => { emit = () => {}; });

  it('starts loading then resolves to signed-out', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    emit(null);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('email')).toHaveTextContent('none');
    expect(screen.getByTestId('admin')).toHaveTextContent('false');
  });

  it('exposes isAdmin from the ID-token claim', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    emit(fakeUser(true));
    await waitFor(() => expect(screen.getByTestId('admin')).toHaveTextContent('true'));
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com');
  });

  it('useAuth throws outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/within AuthProvider/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/auth/AuthProvider.test.tsx`
Expected: FAIL — cannot resolve `./AuthProvider` / `./useAuth`.

- [ ] **Step 3: Implement `src/auth/AuthProvider.tsx`**

```tsx
import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthChange, signIn as fbSignIn, signOutUser } from '../firebase/auth';

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  const value: AuthState = {
    user,
    isAdmin,
    loading,
    signIn: async (email, password) => { await fbSignIn(email, password); },
    signOut: async () => { await signOutUser(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 4: Implement `src/auth/useAuth.ts`**

```ts
import { useContext } from 'react';
import { AuthContext, type AuthState } from './AuthProvider';

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/auth/AuthProvider.test.tsx && npx tsc -b`
Expected: PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/auth/AuthProvider.tsx src/auth/useAuth.ts src/auth/AuthProvider.test.tsx && git commit -m "feat: auth context with isAdmin from custom claim"
```

---

### Task 4: Admin gate (AdminRoute + LoginForm)

**Files:**
- Create: `src/components/admin/AdminRoute.tsx`
- Test: `src/components/admin/AdminRoute.test.tsx`

The gate has three branches: loading → spinner; no user → login form; user but not admin → denied; admin → children. Tests mock `useAuth` directly to isolate the gate from Firebase.

- [ ] **Step 1: Write the failing test**

`src/components/admin/AdminRoute.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthState } from '../../auth/AuthProvider';

const mockAuth = vi.fn<() => AuthState>();
vi.mock('../../auth/useAuth', () => ({ useAuth: () => mockAuth() }));

import { AdminRoute } from './AdminRoute';

function state(over: Partial<AuthState>): AuthState {
  return {
    user: null,
    isAdmin: false,
    loading: false,
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...over,
  } as AuthState;
}

describe('AdminRoute', () => {
  it('shows a spinner while loading', () => {
    mockAuth.mockReturnValue(state({ loading: true }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('shows the login form when signed out', () => {
    mockAuth.mockReturnValue(state({ user: null }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('calls signIn with entered credentials', async () => {
    const signIn = vi.fn(async () => {});
    mockAuth.mockReturnValue(state({ user: null, signIn }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'pw1234');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(signIn).toHaveBeenCalledWith('a@b.com', 'pw1234');
  });

  it('denies a signed-in non-admin', () => {
    mockAuth.mockReturnValue(state({ user: { uid: 'u1' } as never, isAdmin: false }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    expect(screen.getByRole('alert')).toHaveTextContent(/not authorized/i);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders children for an admin', () => {
    mockAuth.mockReturnValue(state({ user: { uid: 'u1' } as never, isAdmin: true }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/admin/AdminRoute.test.tsx`
Expected: FAIL — cannot resolve `./AdminRoute`.

- [ ] **Step 3: Implement `src/components/admin/AdminRoute.tsx`**

```tsx
import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../../auth/useAuth';

function LoginForm({ onSubmit }: { onSubmit: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handle(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await onSubmit(email, password);
    } catch {
      setError('Sign-in failed. Check your email and password.');
    }
  }

  return (
    <form onSubmit={handle} className="mx-auto mt-24 flex max-w-xs flex-col gap-3 p-4">
      <h1 className="text-lg font-bold">Admin sign in</h1>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-2 py-1"
          autoComplete="username"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-2 py-1"
          autoComplete="current-password"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="rounded bg-slate-800 px-3 py-1 text-white">Sign in</button>
    </form>
  );
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, signIn } = useAuth();
  if (loading) return <p className="mt-24 text-center">Loading…</p>;
  if (!user) return <LoginForm onSubmit={signIn} />;
  if (!isAdmin) return <p role="alert" className="mt-24 text-center">Not authorized.</p>;
  return <>{children}</>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/admin/AdminRoute.test.tsx && npx tsc -b`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/admin/AdminRoute.tsx src/components/admin/AdminRoute.test.tsx && git commit -m "feat: admin gate with email/password login form"
```

---

### Task 5: Ping repo + AdminShell

**Files:**
- Create: `src/firebase/ping.ts`
- Create: `src/components/admin/AdminShell.tsx`
- Test: `src/components/admin/AdminShell.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/admin/AdminShell.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthState } from '../../auth/AuthProvider';

const mockAuth = vi.fn<() => AuthState>();
vi.mock('../../auth/useAuth', () => ({ useAuth: () => mockAuth() }));

const writePing = vi.fn(async () => {});
const readPing = vi.fn(async () => ({ at: 123 }));
vi.mock('../../firebase/ping', () => ({
  writePing: (uid: string) => writePing(uid),
  readPing: (uid: string) => readPing(uid),
}));

import { AdminShell } from './AdminShell';

function adminState(): AuthState {
  return {
    user: { uid: 'u1', email: 'a@b.com' } as never,
    isAdmin: true,
    loading: false,
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  } as AuthState;
}

describe('AdminShell', () => {
  it('shows the signed-in admin email', () => {
    mockAuth.mockReturnValue(adminState());
    render(<AdminShell />);
    expect(screen.getByText(/a@b\.com/)).toBeInTheDocument();
    expect(screen.getByText(/admin/i)).toBeInTheDocument();
  });

  it('round-trips a ping on click', async () => {
    mockAuth.mockReturnValue(adminState());
    render(<AdminShell />);
    await userEvent.click(screen.getByRole('button', { name: /ping/i }));
    expect(writePing).toHaveBeenCalledWith('u1');
    expect(readPing).toHaveBeenCalledWith('u1');
    expect(await screen.findByText(/ping ok/i)).toBeInTheDocument();
  });

  it('calls signOut', async () => {
    const s = adminState();
    mockAuth.mockReturnValue(s);
    render(<AdminShell />);
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(s.signOut).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/admin/AdminShell.test.tsx`
Expected: FAIL — cannot resolve `./AdminShell` / `../../firebase/ping`.

- [ ] **Step 3: Implement `src/firebase/ping.ts`**

```ts
// Tracer-bullet repo: a single read+write round-trip on ping/{uid}. Removable later.
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './db';

export interface Ping {
  at: number;
}

export async function writePing(uid: string): Promise<void> {
  await setDoc(doc(db, 'ping', uid), { at: Date.now() } satisfies Ping);
}

export async function readPing(uid: string): Promise<Ping | null> {
  const snap = await getDoc(doc(db, 'ping', uid));
  return snap.exists() ? (snap.data() as Ping) : null;
}
```

- [ ] **Step 4: Implement `src/components/admin/AdminShell.tsx`**

```tsx
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { writePing, readPing } from '../../firebase/ping';

export function AdminShell() {
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState('');

  async function ping() {
    if (!user) return;
    setStatus('pinging…');
    try {
      await writePing(user.uid);
      const v = await readPing(user.uid);
      setStatus(v ? `ping ok @ ${v.at}` : 'ping failed: no doc');
    } catch (e) {
      setStatus(`ping failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="mx-auto mt-24 flex max-w-sm flex-col gap-4 p-4">
      <h1 className="text-lg font-bold">Sentence Pet — Admin</h1>
      <p>Signed in as {user?.email} · admin ✓</p>
      <button type="button" onClick={ping} className="rounded bg-slate-800 px-3 py-1 text-white">
        Ping Firestore
      </button>
      {status && <p className="font-mono text-sm">{status}</p>}
      <button type="button" onClick={() => signOut()} className="rounded border px-3 py-1">
        Sign out
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/admin/AdminShell.test.tsx && npx tsc -b`
Expected: PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/firebase/ping.ts src/components/admin/AdminShell.tsx src/components/admin/AdminShell.test.tsx && git commit -m "feat: ping repo + admin shell tracer round-trip"
```

---

### Task 6: Admin entry wiring in main.tsx

**Files:**
- Create: `src/auth/adminEntry.ts` (pure hash check — testable)
- Test: `src/auth/adminEntry.test.ts`
- Modify: `src/main.tsx`

There is no router; the player app navigates via the Zustand `screen` field. The admin entry is a hash check so it works on static hosting (Netlify) with no redirect rules.

- [ ] **Step 1: Write the failing test**

`src/auth/adminEntry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isAdminEntry } from './adminEntry';

describe('isAdminEntry', () => {
  it('is true for the #admin hash', () => {
    expect(isAdminEntry('#admin')).toBe(true);
  });
  it('is false for empty or other hashes', () => {
    expect(isAdminEntry('')).toBe(false);
    expect(isAdminEntry('#shop')).toBe(false);
    expect(isAdminEntry('#admins')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/auth/adminEntry.test.ts`
Expected: FAIL — cannot resolve `./adminEntry`.

- [ ] **Step 3: Implement `src/auth/adminEntry.ts`**

```ts
// The admin tool is reached at <app-url>/#admin. Hidden (not linked from the player UI)
// and hash-based so it needs no server rewrite on static hosting.
export function isAdminEntry(hash: string): boolean {
  return hash === '#admin';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/auth/adminEntry.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the entry branch in `src/main.tsx`**

Replace the file contents with:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './state/gameStore'
import { isAdminEntry } from './auth/adminEntry'
import { AuthProvider } from './auth/AuthProvider'
import { AdminRoute } from './components/admin/AdminRoute'
import { AdminShell } from './components/admin/AdminShell'

// Dev-only: expose the store for console debugging (store.getState().addXpForTest(3000)).
if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useGameStore }).store = useGameStore
}

const root = isAdminEntry(window.location.hash) ? (
  <AuthProvider>
    <AdminRoute>
      <AdminShell />
    </AdminRoute>
  </AuthProvider>
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {root}
  </StrictMode>,
)
```

- [ ] **Step 6: Verify typecheck, build, and full test suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm run build && npm test`
Expected: tsc clean; build succeeds; all tests pass (the new `rules.test.ts` does not exist yet).

- [ ] **Step 7: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/auth/adminEntry.ts src/auth/adminEntry.test.ts src/main.tsx && git commit -m "feat: hidden #admin entry mounts the admin tool"
```

---

### Task 7: Security rules + emulator config + rules tests

**Files:**
- Create: `firestore.rules`
- Create: `firebase.json`
- Create: `.firebaserc`
- Test: `src/firebase/rules.test.ts`

- [ ] **Step 1: Create `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.token.admin == true;
    }

    match /ping/{uid} {
      allow read, write: if isAdmin();
    }

    match /content/{doc=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /reviewQueue/{doc} {
      allow read, write: if isAdmin();
    }

    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 2: Create `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 3: Create `.firebaserc`**

```json
{
  "projects": {
    "default": "demo-sentence-pet"
  }
}
```
Note: `demo-` prefix means the emulator runs without real credentials. The operator updates this to the real project id before deploying rules to the cloud (Task 8 console steps).

- [ ] **Step 4: Write the rules test**

`src/firebase/rules.test.ts`:
```ts
// @vitest-environment node
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

// Only runs under the emulator (firebase emulators:exec sets FIRESTORE_EMULATOR_HOST).
// Skips cleanly during a plain `npm test` so the suite stays green without Java/emulator.
const run = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

let env: RulesTestEnvironment;

run('firestore security rules', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-sentence-pet',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    });
  });
  afterAll(async () => { await env.cleanup(); });
  beforeEach(async () => { await env.clearFirestore(); });

  it('admin can write and read ping', async () => {
    const fs = env.authenticatedContext('admin1', { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(fs, 'ping/admin1'), { at: 1 }));
    await assertSucceeds(getDoc(doc(fs, 'ping/admin1')));
  });

  it('a non-admin cannot write ping', async () => {
    const fs = env.authenticatedContext('user1', {}).firestore();
    await assertFails(setDoc(doc(fs, 'ping/user1'), { at: 1 }));
  });

  it('anyone can read content but not write', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'content/x')));
    await assertFails(setDoc(doc(anon, 'content/x'), { a: 1 }));
  });

  it('an admin can write content', async () => {
    const fs = env.authenticatedContext('admin1', { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(fs, 'content/x'), { a: 1 }));
  });

  it('owner can write own user doc; others are denied', async () => {
    const owner = env.authenticatedContext('u1', {}).firestore();
    await assertSucceeds(setDoc(doc(owner, 'users/u1/pets/p1'), { a: 1 }));
    const other = env.authenticatedContext('u2', {}).firestore();
    await assertFails(getDoc(doc(other, 'users/u1/pets/p1')));
  });

  it('default-denies an unmatched path', async () => {
    const fs = env.authenticatedContext('admin1', { admin: true }).firestore();
    await assertFails(getDoc(doc(fs, 'random/x')));
  });
});
```

- [ ] **Step 5: Verify the suite SKIPS during a normal run**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test`
Expected: all pass; `rules.test.ts` reports as skipped (no `FIRESTORE_EMULATOR_HOST`). tsc/build untouched.

- [ ] **Step 6: Verify the suite PASSES against the emulator**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm run test:rules`
Expected: emulator boots (requires Java + first-run `firebase` download), all 6 rules tests pass, emulator shuts down. If Java is absent, document that this step must run where Java is available (do NOT mark complete by skipping — the rules suite must actually pass once before merge).

- [ ] **Step 7: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add firestore.rules firebase.json .firebaserc src/firebase/rules.test.ts && git commit -m "feat: firestore security rules + emulator rules tests"
```

---

### Task 8: Admin-claim script + operator docs

**Files:**
- Create: `scripts/set-admin-claim.mjs`
- Create: `docs/firebase-setup.md`

- [ ] **Step 1: Implement `scripts/set-admin-claim.mjs`**

```js
// One-shot: grant the {admin:true} custom claim to a user.
// Requires a service account key via GOOGLE_APPLICATION_CREDENTIALS.
// Usage: node scripts/set-admin-claim.mjs <uid>
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/set-admin-claim.mjs <uid>');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });

await getAuth().setCustomUserClaims(uid, { admin: true });
console.log(`admin=true set on ${uid}. The user must sign out/in to refresh their ID token.`);
process.exit(0);
```

- [ ] **Step 2: Verify the script parses**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && node --check scripts/set-admin-claim.mjs`
Expected: no output, exit 0 (syntax OK). Do not run it for real here — it needs a service account key.

- [ ] **Step 3: Write `docs/firebase-setup.md`**

```markdown
# Firebase setup (one-time, operator)

The app stays on the **Spark (free) plan** — Auth + Firestore only, no Cloud Functions.

## Console steps
1. Create a Firebase project (Spark plan) at https://console.firebase.google.com.
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database → Production mode.**
4. **Project settings → General → Your apps → Web app (`</>`)** → register → copy the config.
5. Copy `.env.example` to `.env.local` and fill every `VITE_FIREBASE_*` value from that config. Leave `VITE_USE_EMULATOR=false` for cloud, `true` for the local emulator.
6. Create your admin user: **Authentication → Users → Add user** (or sign up once via the `#admin` login form), then copy that user's UID.
7. **Project settings → Service accounts → Generate new private key** → download the JSON. Keep it OUT of git (already gitignored).
8. Update `.firebaserc` `default` to your real project id.

## Grant yourself admin
```bash
# PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccountKey.json"
npm run set-admin -- <your-uid>
```
Then sign out/in at `#admin` so the new claim lands in your ID token.

## Deploy security rules
```bash
npx firebase deploy --only firestore:rules
```

## Local development against the emulator
```bash
# Terminal 1 — requires Java installed
npm run emulators
# Terminal 2 — set VITE_USE_EMULATOR=true in .env.local first
npm run dev
```

## Run the rules tests
```bash
npm run test:rules   # boots the Firestore emulator, runs the rules suite, shuts down
```

## Reaching the admin tool
Open the app at `<url>/#admin`. Non-admins and signed-out visitors are refused.
```

- [ ] **Step 4: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add scripts/set-admin-claim.mjs docs/firebase-setup.md && git commit -m "feat: set-admin-claim script + firebase setup docs"
```

---

### Task 9: Whole-branch verification gate

This is not new code — it is the final gate before the branch is offered for merge. (Under subagent-driven-development this maps to the final whole-branch review, ideally on opus.)

- [ ] **Step 1: Full verification run**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm run build && npm test && npm run test:rules`
Expected: tsc clean; build succeeds; full vitest suite green (rules suite skipped in `npm test`); `test:rules` green against the emulator.

- [ ] **Step 2: Confirm success criteria from the spec**

Verify each holds (manual or via the above):
- Signed-in admin reaches `#admin`, sees the shell, ping round-trips (manual, against a real or emulated project).
- Signed-in non-admin and unauthenticated visitor are both refused at `#admin` (covered by `AdminRoute.test.tsx`).
- Rules tests pass against the emulator (Task 7 / `test:rules`).
- `tsc -b`, `build`, and full `vitest` are green.
- Player app behavior unchanged (no edits outside `main.tsx`'s entry branch and additive files).

- [ ] **Step 3: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to open the PR / merge.

---

## Self-review notes

- **Spec coverage:** all spec sections map to tasks (see header table); no requirement left unimplemented.
- **Type consistency:** `AuthState` (Task 3) is the single source consumed by `useAuth`, `AdminRoute`, `AdminShell`. `Ping` interface (Task 5) shared by repo + tests. `isAdminEntry` (Task 6) name consistent across module, test, and `main.tsx`. `writePing`/`readPing` names consistent across `ping.ts`, `AdminShell`, and the mock.
- **No placeholders:** every code/command step is complete.
- **Emulator/Java caveat:** Task 7 Step 6 and Task 9 require Java for the emulator; flagged, not silently skipped — the rules suite must pass once before merge.

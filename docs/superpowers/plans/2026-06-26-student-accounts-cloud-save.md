# Student Accounts + Cloud Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every player is a Firebase user from first load (anonymous), their pets/coins/progress mirror to per-user Firestore docs via a debounced sync layer, and any student can upgrade to an email/password account that follows them across devices.

**Architecture:** Anonymous-first auth (player tree only) with `linkWithCredential` upgrade. Player state (the v9 Zustand persist blob) is split at a pure mapping boundary into a profile doc + one doc per pet, written by a debounced store subscriber, and overwritten from the cloud on sign-in (cloud-always-wins). No persist version bump, no `firestore.rules` change.

**Tech Stack:** Vite + React 19 + TS ~6 + Zustand (persist) + Firebase v12 (Auth + Firestore) + Vitest 4 + `@firebase/rules-unit-testing`.

---

## Background the implementer must know

- **Build dir (run ALL git/node here):** `D:\ai_projects\AI_design_thinking\sentence-pet`. Both the Bash and PowerShell tools reset cwd between calls — Bash: prefix `cd "D:\ai_projects\AI_design_thinking\sentence-pet" &&`; PowerShell: `Set-Location` first. **The Bash tool runs POSIX bash, NOT PowerShell.**
- **Branch:** all work on `student-accounts-cloud-save` (already created off `main`; the spec is committed there). Verify with `git branch --show-current` before committing.
- **Typecheck = `npx tsc -b`** (root `tsc --noEmit` is a no-op). `npm run build` runs `tsc -b && vite build`.
- **Test commands:** `npm test` (full vitest, jsdom; rules suite auto-skips). `npm run test:rules` (boots the Firestore emulator, runs `src/firebase/rules.test.ts`, needs **JDK 21+** — main thread only; prepend `$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"; $env:Path="$env:JAVA_HOME\bin;$env:Path"` in PowerShell).
- **Firestore doc-path rule:** a document path needs an EVEN number of segments. `users/{uid}/profile` (3 segments) is a *collection*, not a doc — so the profile doc lives at **`users/{uid}/meta/profile`** (4 segments). Pets live at **`users/{uid}/pets/{petId}`**. Both are strictly under `users/{uid}/…`, so the existing rule `match /users/{uid}/{document=**}` already authorizes them — no rules change.
- **jsdom limits:** mock `canvas-confetti` in any test that transitively imports `src/effects/celebrate.ts`. Firebase in components → mock `src/firebase/*` and/or `src/auth/useAuth` (see `src/auth/AuthProvider.test.tsx`, `src/components/admin/AdminShell.test.tsx`).
- **Persisted blob (the cloud-save payload):** `partialize` keeps everything except `lastLevelUp` + `currentLessonId`. Fields: `screen`, `pets[]`, `activePetId`, `coins`, `inventory`, `selectedDrill`, `selectedLevel`, `lastReward`, `lastPull`, `owned`, `activeBackground`, `journey`.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/state/gameStore.ts` (modify) | Export `PERSIST_VERSION`, `PersistedState` type, `selectPersisted()`; use `PERSIST_VERSION` in the persist `version` field | 2 |
| `src/sync/mapping.ts` (create) | **Pure.** `toCloud` / `fromCloud` + `ProfileDoc`/`PetDoc`/`CloudSave` types. The split-doc shape lives here | 3 |
| `src/firebase/users.ts` (create) | The only module that knows Firestore user paths. `saveProfile`, `savePet`, `loadCloudSave` | 4 |
| `src/sync/cloudSync.ts` (create) | Debounced store subscriber → diff → write changed docs via an injected repo | 5 |
| `src/sync/reconcile.ts` (create) | On sign-in: cloud-always-wins overwrite via injected loader + applyState | 6 |
| `src/firebase/auth.ts` (modify) | Add `signInAnon()`, `linkEmailPassword(email,pw)` | 7 |
| `src/auth/AuthProvider.tsx` (modify) | `player` prop: anon-bootstrap + sync wiring; expose `isAnonymous`, `linkEmail` | 8 |
| `src/components/account/SignUpForm.tsx` (create) | email+password form → `linkEmail` | 9 |
| `src/components/account/AccountButton.tsx` (create) | guest → SignUpForm; signed-in → email + Sign out | 9 |
| `src/App.tsx` (modify) | Mount `<AccountButton/>` | 9 |
| `src/main.tsx` (modify) | Wrap player tree in `<AuthProvider player>` | 10 |
| `src/firebase/rules.test.ts` (modify) | Extend matrix for `meta/profile` + `pets/*` | 1 |
| `docs/firebase-setup.md` (modify) | Add "enable Anonymous provider" step | 10 |

---

## Task 1: Security-rules test matrix for user docs

No `firestore.rules` change — only extend the test matrix to prove the existing owner rule covers the concrete paths.

**Files:**
- Modify: `src/firebase/rules.test.ts` (add two `it` blocks before the `default-denies` test at line ~91)

- [ ] **Step 1: Add the failing tests**

Insert after the existing `'owner can write own user doc; others are denied'` test (line ~89):

```ts
  it('owner can read+write own profile doc; others and unauth are denied', async () => {
    const owner = env.authenticatedContext('u1', {}).firestore();
    await assertSucceeds(setDoc(doc(owner, 'users/u1/meta/profile'), { coins: 5 }));
    await assertSucceeds(getDoc(doc(owner, 'users/u1/meta/profile')));
    const other = env.authenticatedContext('u2', {}).firestore();
    await assertFails(setDoc(doc(other, 'users/u1/meta/profile'), { coins: 9 }));
    await assertFails(getDoc(doc(other, 'users/u1/meta/profile')));
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users/u1/meta/profile')));
  });

  it('owner can read+write own pet docs; others and unauth are denied', async () => {
    const owner = env.authenticatedContext('u1', {}).firestore();
    await assertSucceeds(setDoc(doc(owner, 'users/u1/pets/p1'), { id: 'p1' }));
    await assertSucceeds(getDoc(doc(owner, 'users/u1/pets/p1')));
    const other = env.authenticatedContext('u2', {}).firestore();
    await assertFails(setDoc(doc(other, 'users/u1/pets/p1'), { id: 'x' }));
    await assertFails(getDoc(doc(other, 'users/u1/pets/p1')));
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users/u1/pets/p1')));
  });
```

- [ ] **Step 2: Run under the emulator to verify they pass** (main thread; needs JDK)

PowerShell:
```
Set-Location "D:\ai_projects\AI_design_thinking\sentence-pet"; $env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules
```
Expected: all rules tests PASS (the two new ones included). Confirms the existing `users/{uid}/{document=**}` rule authorizes `meta/profile` and `pets/*`, and denies non-owners/unauth.

> If `meta/profile` unexpectedly fails for the owner, the recursive-wildcard does not cover that depth in this config — STOP and report; do not change the rule without confirmation.

- [ ] **Step 3: Confirm the plain suite still skips the rules tests**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test`
Expected: full suite PASS; the `firestore security rules` describe is skipped (no `FIRESTORE_EMULATOR_HOST`).

- [ ] **Step 4: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/firebase/rules.test.ts && git commit -m "test(rules): cover users/{uid}/meta/profile and pets/* owner matrix"
```

---

## Task 2: Persisted-state projection in the game store

Expose the persisted shape so the sync layer reads a clean, action-free snapshot, and make the persist version a single named constant.

**Files:**
- Modify: `src/state/gameStore.ts` (add exports near the `GameState` interface ~line 76; change `version: 9` ~line 252)
- Test: `src/state/gameStore.persisted.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/state/gameStore.persisted.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { useGameStore, selectPersisted, PERSIST_VERSION } from './gameStore';

describe('selectPersisted', () => {
  it('keeps the persisted data fields and drops transient + action fields', () => {
    const snap = selectPersisted(useGameStore.getState());
    const keys = Object.keys(snap).sort();
    expect(keys).toEqual(
      [
        'activeBackground', 'activePetId', 'coins', 'inventory', 'journey',
        'lastPull', 'lastReward', 'owned', 'pets', 'screen', 'selectedDrill', 'selectedLevel',
      ].sort(),
    );
    // transient excluded
    expect(snap).not.toHaveProperty('lastLevelUp');
    expect(snap).not.toHaveProperty('currentLessonId');
    // no action functions leaked
    for (const v of Object.values(snap)) expect(typeof v).not.toBe('function');
  });

  it('PERSIST_VERSION matches the persisted store version', () => {
    expect(PERSIST_VERSION).toBe(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/state/gameStore.persisted.test.ts`
Expected: FAIL — `selectPersisted`/`PERSIST_VERSION` not exported.

- [ ] **Step 3: Add the exports**

In `src/state/gameStore.ts`, add after the `GameState` interface (after line ~76):
```ts
/** Single source of truth for the persist schema version. */
export const PERSIST_VERSION = 9;

/** The persisted data fields (the cloud-save payload) — excludes transient + actions. */
export type PersistedState = Pick<
  GameState,
  | 'screen' | 'pets' | 'activePetId' | 'coins' | 'inventory' | 'selectedDrill'
  | 'selectedLevel' | 'lastReward' | 'lastPull' | 'owned' | 'activeBackground' | 'journey'
>;

/** Project a full store snapshot down to the persisted payload. */
export function selectPersisted(s: GameState): PersistedState {
  return {
    screen: s.screen,
    pets: s.pets,
    activePetId: s.activePetId,
    coins: s.coins,
    inventory: s.inventory,
    selectedDrill: s.selectedDrill,
    selectedLevel: s.selectedLevel,
    lastReward: s.lastReward,
    lastPull: s.lastPull,
    owned: s.owned,
    activeBackground: s.activeBackground,
    journey: s.journey,
  };
}
```

Then change the persist `version` field (line ~252) from:
```ts
      version: 9,
```
to:
```ts
      version: PERSIST_VERSION,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/state/gameStore.persisted.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/state/gameStore.ts src/state/gameStore.persisted.test.ts && git commit -m "feat(store): export PERSIST_VERSION, PersistedState, selectPersisted"
```
Expected: `tsc -b` clean.

---

## Task 3: Pure blob ↔ split-doc mapping

**Files:**
- Create: `src/sync/mapping.ts`
- Test: `src/sync/mapping.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/sync/mapping.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toCloud, fromCloud, PERSIST_VERSION } from './mapping';
import type { PersistedState } from '../state/gameStore';
import type { PetInstance } from '../data/types';

function pet(id: string): PetInstance {
  return {
    id, species: 'leaf', hatched: true, xp: 0, happiness: 50,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: 'common', name: '',
  };
}

const sample: PersistedState = {
  screen: 'petRoom', pets: [pet('a'), pet('b')], activePetId: 'a', coins: 7,
  inventory: { protein: 1, veggie: 0, vitamin: 0, treat: 0 },
  selectedDrill: 'pattern', selectedLevel: 2, lastReward: null, lastPull: null,
  owned: ['bg1'], activeBackground: 'bg1', journey: { lessonStars: { 'u1-pattern': 3 } },
};

describe('mapping', () => {
  it('toCloud splits pets out of the profile and stamps the version', () => {
    const { profile, pets } = toCloud(sample);
    expect(pets).toHaveLength(2);
    expect(profile).not.toHaveProperty('pets');
    expect(profile.persistVersion).toBe(PERSIST_VERSION);
    expect(profile.coins).toBe(7);
  });

  it('fromCloud recombines into the persisted shape and drops persistVersion', () => {
    const restored = fromCloud(toCloud(sample));
    expect(restored).toEqual(sample);
    expect(restored).not.toHaveProperty('persistVersion');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/sync/mapping.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mapping**

Create `src/sync/mapping.ts`:
```ts
import { PERSIST_VERSION, type PersistedState } from '../state/gameStore';
import type { PetInstance } from '../data/types';

export { PERSIST_VERSION };

/** One pet document (1:1 with PetInstance). */
export type PetDoc = PetInstance;

/** The profile document: everything persisted except the pets array. */
export type ProfileDoc = Omit<PersistedState, 'pets'> & { persistVersion: number };

/** The full cloud save: one profile doc + N pet docs. */
export interface CloudSave {
  profile: ProfileDoc;
  pets: PetDoc[];
}

/** Split a persisted snapshot into the profile doc + pet docs. Pure. */
export function toCloud(s: PersistedState): CloudSave {
  const { pets, ...rest } = s;
  return { profile: { ...rest, persistVersion: PERSIST_VERSION }, pets };
}

/** Recombine cloud docs back into the persisted shape. Pure. Drops persistVersion. */
export function fromCloud(c: CloudSave): PersistedState {
  const { persistVersion: _persistVersion, ...profile } = c.profile;
  void _persistVersion;
  return { ...profile, pets: c.pets };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/sync/mapping.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/sync/mapping.ts src/sync/mapping.test.ts && git commit -m "feat(sync): pure blob<->split-doc mapping"
```

---

## Task 4: Firestore user repo

**Files:**
- Create: `src/firebase/users.ts`
- Test: `src/firebase/users.test.ts`

- [ ] **Step 1: Write the failing test** (mocks `firebase/firestore` + `./db`)

Create `src/firebase/users.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const setDoc = vi.fn().mockResolvedValue(undefined);
const getDoc = vi.fn();
const getDocs = vi.fn();
// doc()/collection() just record the path segments so we can assert on them.
const doc = vi.fn((_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }));
const collection = vi.fn((_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }));

vi.mock('firebase/firestore', () => ({
  doc, collection, setDoc, getDoc, getDocs,
  serverTimestamp: () => '<<ts>>',
}));
vi.mock('./db', () => ({ db: {} }));

import { saveProfile, savePet, loadCloudSave } from './users';

beforeEach(() => { setDoc.mockClear(); getDoc.mockReset(); getDocs.mockReset(); });

describe('users repo', () => {
  it('saveProfile writes users/{uid}/meta/profile with a server timestamp', async () => {
    await saveProfile('u1', { coins: 3, persistVersion: 9 } as never);
    expect(doc).toHaveBeenCalledWith({}, 'users', 'u1', 'meta', 'profile');
    const [, payload] = setDoc.mock.calls[0];
    expect(payload).toMatchObject({ coins: 3, persistVersion: 9, updatedAt: '<<ts>>' });
  });

  it('savePet writes users/{uid}/pets/{petId} with a server timestamp', async () => {
    await savePet('u1', { id: 'p1' } as never);
    expect(doc).toHaveBeenCalledWith({}, 'users', 'u1', 'pets', 'p1');
    const [, payload] = setDoc.mock.calls[0];
    expect(payload).toMatchObject({ id: 'p1', updatedAt: '<<ts>>' });
  });

  it('loadCloudSave returns null when the profile doc is missing', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    expect(await loadCloudSave('u1')).toBeNull();
  });

  it('loadCloudSave assembles profile + pets and strips updatedAt', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ coins: 5, persistVersion: 9, updatedAt: '<<ts>>' }) });
    getDocs.mockResolvedValue({ docs: [{ data: () => ({ id: 'p1', updatedAt: '<<ts>>' }) }] });
    const save = await loadCloudSave('u1');
    expect(save).toEqual({ profile: { coins: 5, persistVersion: 9 }, pets: [{ id: 'p1' }] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/firebase/users.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the repo**

Create `src/firebase/users.ts`:
```ts
import { doc, collection, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './db';
import type { CloudSave, ProfileDoc, PetDoc } from '../sync/mapping';

const PROFILE = ['meta', 'profile'] as const;

export async function saveProfile(uid: string, profile: ProfileDoc): Promise<void> {
  await setDoc(doc(db, 'users', uid, ...PROFILE), { ...profile, updatedAt: serverTimestamp() });
}

export async function savePet(uid: string, pet: PetDoc): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'pets', pet.id), { ...pet, updatedAt: serverTimestamp() });
}

export async function loadCloudSave(uid: string): Promise<CloudSave | null> {
  const profileSnap = await getDoc(doc(db, 'users', uid, ...PROFILE));
  if (!profileSnap.exists()) return null;
  const { updatedAt: _p, ...profile } = profileSnap.data() as ProfileDoc & { updatedAt?: unknown };
  void _p;
  const petsSnap = await getDocs(collection(db, 'users', uid, 'pets'));
  const pets = petsSnap.docs.map((d) => {
    const { updatedAt: _q, ...rest } = d.data() as PetDoc & { updatedAt?: unknown };
    void _q;
    return rest as PetDoc;
  });
  return { profile: profile as ProfileDoc, pets };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/firebase/users.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/firebase/users.ts src/firebase/users.test.ts && git commit -m "feat(firebase): user cloud-save repo (profile + pets)"
```

---

## Task 5: Debounced cloud-sync engine

A store subscriber that, on change, debounces then writes only the docs that changed since the last sync. Repo + scheduler are injected so tests are deterministic and Firestore-free.

**Files:**
- Create: `src/sync/cloudSync.ts`
- Test: `src/sync/cloudSync.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/sync/cloudSync.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { startCloudSync, type SyncRepo } from './cloudSync';
import type { PersistedState } from '../state/gameStore';
import type { PetInstance } from '../data/types';

function pet(id: string, xp = 0): PetInstance {
  return {
    id, species: 'leaf', hatched: true, xp, happiness: 50,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: 'common', name: '',
  };
}
function state(coins: number, pets: PetInstance[]): PersistedState {
  return {
    screen: 'petRoom', pets, activePetId: pets[0].id, coins,
    inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    selectedDrill: 'pattern', selectedLevel: 1, lastReward: null, lastPull: null,
    owned: [], activeBackground: null, journey: { lessonStars: {} },
  };
}

/** A manual scheduler: captures the pending flush so the test fires it on demand. */
function manualScheduler() {
  let pending: (() => void) | null = null;
  return {
    schedule: (fn: () => void) => { pending = fn; return 1 as const; },
    cancel: () => { pending = null; },
    flush: () => { const p = pending; pending = null; p?.(); },
    hasPending: () => pending !== null,
  };
}

function fakeRepo() {
  const profile = vi.fn().mockResolvedValue(undefined);
  const petFn = vi.fn().mockResolvedValue(undefined);
  const repo: SyncRepo = { saveProfile: (_u, p) => profile(p), savePet: (_u, p) => petFn(p) };
  return { repo, profile, petFn };
}

describe('startCloudSync', () => {
  it('does an initial flush of profile + every pet on start', async () => {
    let cur = state(0, [pet('a'), pet('b')]);
    const sch = manualScheduler();
    const { repo, profile, petFn } = fakeRepo();
    startCloudSync({ uid: 'u1', getState: () => cur, subscribe: () => () => {}, repo, schedule: sch.schedule, cancel: sch.cancel });
    sch.flush();
    await Promise.resolve();
    expect(profile).toHaveBeenCalledTimes(1);
    expect(petFn).toHaveBeenCalledTimes(2);
  });

  it('coalesces rapid changes into a single flush and writes only changed docs', async () => {
    let cur = state(0, [pet('a'), pet('b')]);
    let listener = () => {};
    const sch = manualScheduler();
    const { repo, profile, petFn } = fakeRepo();
    startCloudSync({ uid: 'u1', getState: () => cur, subscribe: (l) => { listener = l; return () => {}; }, repo, schedule: sch.schedule, cancel: sch.cancel });
    sch.flush(); // initial
    await Promise.resolve();
    profile.mockClear(); petFn.mockClear();

    // two rapid changes: coins, then pet 'a' xp — both before a flush
    cur = state(5, [pet('a'), pet('b')]);
    listener();
    cur = state(5, [pet('a', 99), pet('b')]);
    listener();
    expect(sch.hasPending()).toBe(true);
    sch.flush();
    await Promise.resolve();
    expect(profile).toHaveBeenCalledTimes(1);        // coins changed → 1 profile write
    expect(petFn).toHaveBeenCalledTimes(1);          // only pet 'a' changed
    expect(petFn.mock.calls[0][0].id).toBe('a');
  });

  it('stop() cancels a pending flush', () => {
    let cur = state(0, [pet('a')]);
    let listener = () => {};
    const sch = manualScheduler();
    const { repo } = fakeRepo();
    const stop = startCloudSync({ uid: 'u1', getState: () => cur, subscribe: (l) => { listener = l; return () => {}; }, repo, schedule: sch.schedule, cancel: sch.cancel });
    sch.flush();
    cur = state(1, [pet('a')]);
    listener();
    expect(sch.hasPending()).toBe(true);
    stop();
    expect(sch.hasPending()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/sync/cloudSync.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the engine**

Create `src/sync/cloudSync.ts`:
```ts
import { toCloud, type ProfileDoc, type PetDoc } from './mapping';
import type { PersistedState } from '../state/gameStore';

export interface SyncRepo {
  saveProfile(uid: string, profile: ProfileDoc): Promise<void>;
  savePet(uid: string, pet: PetDoc): Promise<void>;
}

export interface CloudSyncDeps {
  uid: string;
  getState: () => PersistedState;
  subscribe: (listener: () => void) => () => void;
  repo: SyncRepo;
  debounceMs?: number;
  /** Injected for tests; defaults to setTimeout. */
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

/** Start mirroring the store to Firestore. Returns a stop() that unsubscribes + cancels. */
export function startCloudSync(deps: CloudSyncDeps): () => void {
  const debounceMs = deps.debounceMs ?? 1500;
  const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = deps.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let lastProfileJson = '';
  const lastPetJson = new Map<string, string>();
  let handle: unknown = null;

  async function flush() {
    handle = null;
    const { profile, pets } = toCloud(deps.getState());
    const writes: Promise<void>[] = [];

    const profileJson = JSON.stringify(profile);
    if (profileJson !== lastProfileJson) {
      lastProfileJson = profileJson;
      writes.push(deps.repo.saveProfile(deps.uid, profile));
    }
    for (const pet of pets) {
      const json = JSON.stringify(pet);
      if (lastPetJson.get(pet.id) !== json) {
        lastPetJson.set(pet.id, json);
        writes.push(deps.repo.savePet(deps.uid, pet));
      }
    }
    await Promise.all(writes);
  }

  function scheduleFlush() {
    if (handle !== null) cancel(handle);
    handle = schedule(() => { void flush(); }, debounceMs);
  }

  // Initial backup, then mirror every change.
  scheduleFlush();
  const unsub = deps.subscribe(scheduleFlush);

  return () => {
    unsub();
    if (handle !== null) { cancel(handle); handle = null; }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/sync/cloudSync.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/sync/cloudSync.ts src/sync/cloudSync.test.ts && git commit -m "feat(sync): debounced cloud-sync engine with per-doc diff"
```

---

## Task 6: Sign-in reconcile (cloud-always-wins)

**Files:**
- Create: `src/sync/reconcile.ts`
- Test: `src/sync/reconcile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/sync/reconcile.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { reconcileFromCloud } from './reconcile';
import { toCloud } from './mapping';
import type { PersistedState } from '../state/gameStore';
import type { PetInstance } from '../data/types';

function pet(id: string): PetInstance {
  return {
    id, species: 'leaf', hatched: true, xp: 0, happiness: 50,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: 'common', name: '',
  };
}
const cloudState: PersistedState = {
  screen: 'petRoom', pets: [pet('cloud')], activePetId: 'cloud', coins: 42,
  inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
  selectedDrill: 'pattern', selectedLevel: 1, lastReward: null, lastPull: null,
  owned: [], activeBackground: null, journey: { lessonStars: {} },
};

describe('reconcileFromCloud', () => {
  it('overwrites local state when a cloud save exists (cloud wins)', async () => {
    const applyState = vi.fn();
    const applied = await reconcileFromCloud({
      uid: 'u1', loadCloudSave: async () => toCloud(cloudState), applyState,
    });
    expect(applied).toBe(true);
    expect(applyState).toHaveBeenCalledWith(cloudState);
  });

  it('leaves local untouched when there is no cloud save', async () => {
    const applyState = vi.fn();
    const applied = await reconcileFromCloud({
      uid: 'u1', loadCloudSave: async () => null, applyState,
    });
    expect(applied).toBe(false);
    expect(applyState).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/sync/reconcile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement reconcile**

Create `src/sync/reconcile.ts`:
```ts
import { fromCloud, type CloudSave } from './mapping';
import type { PersistedState } from '../state/gameStore';

export interface ReconcileDeps {
  uid: string;
  loadCloudSave: (uid: string) => Promise<CloudSave | null>;
  applyState: (s: PersistedState) => void;
}

/** Cloud-always-wins: if a cloud save exists, overwrite local with it. Returns whether it applied. */
export async function reconcileFromCloud(deps: ReconcileDeps): Promise<boolean> {
  const cloud = await deps.loadCloudSave(deps.uid);
  if (!cloud) return false;
  deps.applyState(fromCloud(cloud));
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/sync/reconcile.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/sync/reconcile.ts src/sync/reconcile.test.ts && git commit -m "feat(sync): cloud-always-wins reconcile on sign-in"
```

---

## Task 7: Auth SDK wrappers — anonymous + link

**Files:**
- Modify: `src/firebase/auth.ts`
- Test: `src/firebase/auth.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/firebase/auth.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInAnonymously = vi.fn().mockResolvedValue({});
const linkWithCredential = vi.fn().mockResolvedValue({});
const credential = vi.fn((email: string, pw: string) => ({ email, pw }));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'anon1' } }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  connectAuthEmulator: vi.fn(),
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider: { credential },
}));
vi.mock('./app', () => ({ firebaseApp: {} }));

import { signInAnon, linkEmailPassword } from './auth';

beforeEach(() => { signInAnonymously.mockClear(); linkWithCredential.mockClear(); credential.mockClear(); });

describe('auth wrappers', () => {
  it('signInAnon delegates to signInAnonymously', async () => {
    await signInAnon();
    expect(signInAnonymously).toHaveBeenCalledOnce();
  });

  it('linkEmailPassword links an email credential onto the current user', async () => {
    await linkEmailPassword('k@s.th', 'pw123456');
    expect(credential).toHaveBeenCalledWith('k@s.th', 'pw123456');
    expect(linkWithCredential).toHaveBeenCalledWith({ uid: 'anon1' }, { email: 'k@s.th', pw: 'pw123456' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/firebase/auth.test.ts`
Expected: FAIL — `signInAnon`/`linkEmailPassword` not exported.

- [ ] **Step 3: Extend `src/firebase/auth.ts`**

Change the import block and add two functions. The full file becomes:
```ts
import {
  getAuth,
  signInWithEmailAndPassword,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
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

export function signInAnon() {
  return signInAnonymously(auth);
}

/** Upgrade the current (anonymous) user to an email/password account, preserving the uid. */
export function linkEmailPassword(email: string, password: string) {
  const cred = EmailAuthProvider.credential(email, password);
  return linkWithCredential(auth.currentUser!, cred);
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/firebase/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/firebase/auth.ts src/firebase/auth.test.ts && git commit -m "feat(firebase): signInAnon + linkEmailPassword wrappers"
```

---

## Task 8: AuthProvider — anon bootstrap, sync wiring, link

`AuthProvider` is shared by the admin tree (must stay sign-in-only) and the player tree (needs anon-bootstrap + sync). Gate the new behavior behind a `player` prop, default `false`.

**Files:**
- Modify: `src/auth/AuthProvider.tsx`
- Modify: `src/auth/AuthProvider.test.tsx` (add player-mode tests; existing tests stay valid)

- [ ] **Step 1: Write the failing tests**

Replace the mock block at the top of `src/auth/AuthProvider.test.tsx` (lines 8–15) with one that also stubs the new wrappers + sync modules, and add a `Probe` field for `isAnonymous`:

```ts
const signInAnon = vi.fn().mockResolvedValue({});
const linkEmailPassword = vi.fn().mockResolvedValue({});

vi.mock('../firebase/auth', () => ({
  onAuthChange: (cb: (u: User | null) => void) => { emit = cb; return () => {}; },
  signIn: vi.fn(),
  signInAnon,
  linkEmailPassword,
  signOutUser: vi.fn(),
}));
// Keep the player-mode wiring inert in jsdom (no real Firestore).
vi.mock('../sync/cloudSync', () => ({ startCloudSync: vi.fn(() => () => {}) }));
vi.mock('../sync/reconcile', () => ({ reconcileFromCloud: vi.fn().mockResolvedValue(false) }));
vi.mock('../firebase/users', () => ({ loadCloudSave: vi.fn(), saveProfile: vi.fn(), savePet: vi.fn() }));
```

The full replacement mock block (replaces lines 8–15), with a mutable `auth` whose `signIn` sets `currentUser` so the reconcile-on-sign-in path can read the new uid:
```ts
const signInAnon = vi.fn().mockResolvedValue({});
const linkEmailPassword = vi.fn().mockResolvedValue({});
const authObj: { currentUser: { uid: string } | null } = { currentUser: null };
const signIn = vi.fn(async () => { authObj.currentUser = { uid: 'acct1' }; });

vi.mock('../firebase/auth', () => ({
  auth: authObj,
  onAuthChange: (cb: (u: User | null) => void) => { emit = cb; return () => {}; },
  signIn,
  signInAnon,
  linkEmailPassword,
  signOutUser: vi.fn(),
}));
const reconcileFromCloud = vi.fn().mockResolvedValue(true);
vi.mock('../sync/reconcile', () => ({ reconcileFromCloud }));
vi.mock('../sync/cloudSync', () => ({ startCloudSync: vi.fn(() => () => {}) }));
vi.mock('../firebase/users', () => ({ loadCloudSave: vi.fn(), saveProfile: vi.fn(), savePet: vi.fn() }));
```

Add `fireEvent` to the testing-library import (line 2): `import { render, screen, fireEvent, waitFor } from '@testing-library/react';`

Extend `fakeUser` and `Probe` to surface `isAnonymous`:
```ts
function fakeUser(admin: boolean, anonymous = false): User {
  return {
    uid: 'u1', email: anonymous ? null : 'a@b.com', isAnonymous: anonymous,
    getIdTokenResult: async () => ({ claims: { admin } }),
  } as unknown as User;
}
```
Add to `Probe`'s JSX: `<span data-testid="anon">{String(useAuth().isAnonymous)}</span>` (read it from the same `useAuth()` call — destructure `isAnonymous` alongside the others).

Add these tests inside `describe('AuthProvider', …)`:
```ts
  it('player mode bootstraps an anonymous session when signed out', async () => {
    render(<AuthProvider player><Probe /></AuthProvider>);
    emit(null);
    await waitFor(() => expect(signInAnon).toHaveBeenCalledOnce());
  });

  it('non-player mode does NOT bootstrap anon (admin tree stays sign-in-only)', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    emit(null);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(signInAnon).not.toHaveBeenCalled();
  });

  it('exposes isAnonymous from the user', async () => {
    render(<AuthProvider player><Probe /></AuthProvider>);
    emit(fakeUser(false, true));
    await waitFor(() => expect(screen.getByTestId('anon')).toHaveTextContent('true'));
  });

  it('signing in reconciles from cloud for the signed-in uid (cloud wins)', async () => {
    function SignInProbe() {
      const { signIn } = useAuth();
      return <button onClick={() => void signIn('k@s.th', 'pw123456')}>go</button>;
    }
    render(<AuthProvider player><SignInProbe /></AuthProvider>);
    emit(fakeUser(false, true)); // begin as an anon guest
    await waitFor(() => expect(screen.getByText('go')).toBeInTheDocument());
    fireEvent.click(screen.getByText('go'));
    await waitFor(() =>
      expect(reconcileFromCloud).toHaveBeenCalledWith(expect.objectContaining({ uid: 'acct1' })),
    );
  });
```
(Add `beforeEach(() => { signInAnon.mockClear(); signIn.mockClear(); reconcileFromCloud.mockClear(); });` to the existing `beforeEach`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/auth/AuthProvider.test.tsx`
Expected: FAIL — `player` prop / `isAnonymous` / `signInAnon` bootstrap not implemented.

- [ ] **Step 3: Rewrite `src/auth/AuthProvider.tsx`**

```tsx
import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  auth, onAuthChange, signIn as fbSignIn, signInAnon, linkEmailPassword, signOutUser,
} from '../firebase/auth';
import { useGameStore, selectPersisted } from '../state/gameStore';
import { startCloudSync } from '../sync/cloudSync';
import { reconcileFromCloud } from '../sync/reconcile';
import { loadCloudSave, saveProfile, savePet } from '../firebase/users';

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isAnonymous: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  linkEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, player = false }: { children: ReactNode; player?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Track auth state; in player mode, auto-create an anonymous guest when signed out.
  useEffect(() => {
    return onAuthChange(async (u) => {
      if (!u && player) {
        // Bootstrap a guest; onAuthChange will fire again with the anon user.
        await signInAnon();
        return;
      }
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, [player]);

  // Player-only: mirror local -> cloud for the active uid.
  // NOTE: no reconcile here. Reconcile (cloud-wins) happens ONLY inside signIn()
  // — the explicit cross-device sign-in event. Reloads and anon->email link keep
  // the current uid and must NOT pull cloud, so local (localStorage) stays the
  // instant source of truth and offline progress is never clobbered.
  const uid = user?.uid;
  useEffect(() => {
    if (!player || !uid) return;
    const stop = startCloudSync({
      uid,
      getState: () => selectPersisted(useGameStore.getState()),
      subscribe: (listener) => useGameStore.subscribe(listener),
      repo: { saveProfile, savePet },
    });
    return () => stop();
  }, [player, uid]);

  const value: AuthState = {
    user,
    isAdmin,
    isAnonymous: user?.isAnonymous ?? false,
    loading,
    signIn: async (email, password) => {
      await fbSignIn(email, password);
      // Signing in on this device with an existing account: cloud always wins.
      const signedInUid = auth.currentUser?.uid;
      if (signedInUid) {
        await reconcileFromCloud({
          uid: signedInUid,
          loadCloudSave,
          applyState: (s) => useGameStore.setState(s),
        });
      }
      // The sync effect (re)starts for the new uid and re-pushes the reconciled state.
    },
    linkEmail: async (email, password) => { await linkEmailPassword(email, password); },
    signOut: async () => { await signOutUser(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 4: Run the AuthProvider tests**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/auth/AuthProvider.test.tsx`
Expected: PASS (old + new tests).

- [ ] **Step 5: Run the full suite to catch consumer breakage**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test`
Expected: PASS. `AdminRoute`/`AdminShell` consume `useAuth()` and only read fields that still exist (`user`, `isAdmin`, `loading`, `signOut`) — adding fields is non-breaking.

- [ ] **Step 6: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/auth/AuthProvider.tsx src/auth/AuthProvider.test.tsx && git commit -m "feat(auth): player-mode anon bootstrap + cloud-sync wiring + linkEmail"
```

---

## Task 9: Account UI — SignUpForm + AccountButton

**Files:**
- Create: `src/components/account/SignUpForm.tsx`
- Create: `src/components/account/AccountButton.tsx`
- Modify: `src/App.tsx` (mount `<AccountButton/>`)
- Test: `src/components/account/SignUpForm.test.tsx`, `src/components/account/AccountButton.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/account/SignUpForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const linkEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ linkEmail }) }));

import { SignUpForm } from './SignUpForm';

beforeEach(() => linkEmail.mockClear());

describe('SignUpForm', () => {
  it('submits email + password to linkEmail', async () => {
    render(<SignUpForm onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'k@s.th' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw123456' } });
    fireEvent.click(screen.getByRole('button', { name: /save|sign up|create/i }));
    await waitFor(() => expect(linkEmail).toHaveBeenCalledWith('k@s.th', 'pw123456'));
  });

  it('shows an error message when linking fails', async () => {
    linkEmail.mockRejectedValueOnce(new Error('email-already-in-use'));
    render(<SignUpForm onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'k@s.th' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw123456' } });
    fireEvent.click(screen.getByRole('button', { name: /save|sign up|create/i }));
    expect(await screen.findByText(/email-already-in-use|couldn't|could not/i)).toBeInTheDocument();
  });
});
```

Create `src/components/account/AccountButton.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let authValue: { isAnonymous: boolean; user: { email: string | null } | null; signOut: () => void; linkEmail: () => Promise<void> };
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authValue }));

import { AccountButton } from './AccountButton';

describe('AccountButton', () => {
  it('guest sees a Save-your-pets entry that opens the signup form', () => {
    authValue = { isAnonymous: true, user: { email: null }, signOut: vi.fn(), linkEmail: vi.fn() };
    render(<AccountButton />);
    const open = screen.getByRole('button', { name: /save your pets/i });
    fireEvent.click(open);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('signed-in student sees their email and a sign-out button', () => {
    const signOut = vi.fn();
    authValue = { isAnonymous: false, user: { email: 'k@s.th' }, signOut, linkEmail: vi.fn() };
    render(<AccountButton />);
    expect(screen.getByText(/k@s\.th/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/account`
Expected: FAIL — components not found.

- [ ] **Step 3: Implement `SignUpForm.tsx`**

Create `src/components/account/SignUpForm.tsx`:
```tsx
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';

/** Functional email/password upgrade form. Visual polish deferred to impeccable. */
export function SignUpForm({ onDone }: { onDone: () => void }) {
  const { linkEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await linkEmail(email, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 p-3">
      <p className="text-sm">Save your pets across devices.</p>
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
          type="password" required minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-50">
        {busy ? 'Saving…' : 'Save my pets'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Implement `AccountButton.tsx`**

Create `src/components/account/AccountButton.tsx`:
```tsx
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { SignUpForm } from './SignUpForm';

/** Entry point for cloud save: guests sign up, signed-in students see their account. */
export function AccountButton() {
  const { isAnonymous, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isAnonymous && user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span>{user.email}</span>
        <button type="button" onClick={() => void signOut()} className="rounded border px-2 py-1">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="text-sm">
      {open ? (
        <SignUpForm onDone={() => setOpen(false)} />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="rounded border px-2 py-1">
          Save your pets across devices
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Mount in `src/App.tsx`**

Add the import after line 13 (`import { DevPanel } …`):
```tsx
import { AccountButton } from './components/account/AccountButton';
```
Change the `App` component body to render the button inside the shell, above the screen:
```tsx
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        <div className="px-3 pt-2"><AccountButton /></div>
        <CurrentScreen />
      </AppShell>
      {import.meta.env.DEV && <DevPanel />}
    </MotionConfig>
  );
}
```

- [ ] **Step 6: Run account tests + full suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/account && npm test`
Expected: account tests PASS; full suite PASS. (`App.test.tsx` only exercises `screenKeyAndNode` and already mocks `./auth/useAuth`, so mounting `AccountButton` in `App` doesn't affect it.)

- [ ] **Step 7: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && git add src/components/account src/App.tsx && git commit -m "feat(account): SignUpForm + AccountButton, mounted in App"
```

---

## Task 10: Wire the player tree to auth + document the operator step

**Files:**
- Modify: `src/main.tsx`
- Modify: `docs/firebase-setup.md`

- [ ] **Step 1: Wrap the player tree in `<AuthProvider player>`**

In `src/main.tsx`, add the import after line 7 (`import { hydrateContent } …`):
```tsx
import { AuthProvider } from './auth/AuthProvider'
```
Change the player branch of `root` (line ~20–22) from:
```tsx
const root = isAdmin
  ? <Suspense fallback={<p style={{ padding: 16 }}>Loading…</p>}><AdminApp /></Suspense>
  : <App />
```
to:
```tsx
const root = isAdmin
  ? <Suspense fallback={<p style={{ padding: 16 }}>Loading…</p>}><AdminApp /></Suspense>
  : <AuthProvider player><App /></AuthProvider>
```

- [ ] **Step 2: Typecheck + build**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm run build`
Expected: both clean.

- [ ] **Step 3: Document the Anonymous-provider step**

In `docs/firebase-setup.md`, under the slice-1 console steps (after the "Enable Authentication → Email/Password" step), add:
```markdown
### Slice 3 — student accounts
- **Authentication → Sign-in method → enable Anonymous.** Players sign in anonymously on first load; signing up links the anon account to email/password (`linkWithCredential`), preserving progress.
- The owner-only rule `users/{uid}/{document=**}` from slice 1 already authorizes the cloud-save docs (`users/{uid}/meta/profile`, `users/{uid}/pets/{petId}`) — no rules redeploy needed unless rules changed.
```

- [ ] **Step 4: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/main.tsx docs/firebase-setup.md && git commit -m "feat(player): wrap player tree in AuthProvider(player); doc Anonymous provider"
```

---

## Task 11: Full-branch verification + emulator E2E

**Files:** none (verification only)

- [ ] **Step 1: Green-bar the whole branch**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm run build && npm test`
Expected: typecheck clean, build clean, full vitest green (rules suite skips).

- [ ] **Step 2: Rules suite under the emulator** (main thread; JDK)

PowerShell:
```
Set-Location "D:\ai_projects\AI_design_thinking\sentence-pet"; $env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules
```
Expected: all rules tests PASS (including the new profile/pets matrix).

- [ ] **Step 3: Manual auth+firestore E2E** (operator, optional but recommended)

With `VITE_USE_EMULATOR=true` and `npm run emulators` running (auth+firestore), in a second shell `npm run dev`, then in the browser:
1. Load the app as a fresh guest → confirm an anonymous user exists (Auth emulator UI) and a `users/{uid}/meta/profile` doc appears after a state change (Firestore emulator UI).
2. Use "Save your pets across devices" → sign up with email/password → confirm the same uid now shows an email and progress is intact.
3. In a fresh browser profile (or after `signOut`), sign in with that email → confirm cloud state loads (cloud-wins).

> Driving the egg-hatch drag is the known manual-only gap (jsdom can't test `@dnd-kit`/`framer-motion`). In-drill drags are Playwright-automatable via the `data-testid` tiles/slots if a scripted check is wanted.

- [ ] **Step 4: Finish the branch**

Hand off to `superpowers:finishing-a-development-branch` (PR → merge → `git checkout main && git pull --prune`).

---

## Notes / known limitations (in scope by decision)

- **Offline durability:** Firestore's default in-memory write queue flushes on reconnect within a session. Cross-reload offline durability (IndexedDB `persistentLocalCache`) is **not** enabled this slice — a follow-up if needed.
- **Per-load initial flush:** `startCloudSync` writes the current profile + pets once on start (the diff snapshot is in-memory, not persisted across loads), costing a few doc writes per session. Acceptable at classroom scale.
- **No consent UI:** school-internal game; guardian consent handled offline (see spec).
- **No pet deletion sync:** the game has no pet-delete; the sync layer only creates/updates pet docs.
```

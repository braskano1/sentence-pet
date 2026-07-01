# Leaderboard P1 — Name-Entry Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a post-hatch onboarding scene where a new player types a display name, sanitized for safety, persisted in the game store — the identity the later global leaderboard will publish.

**Architecture:** A pure `sanitizeName` domain function (letters+spaces, length 2–16, blocklist) guards all name input. A new persisted `displayName` field (PERSIST_VERSION 18→19) holds it. A new `nameEntry` screen renders after the **intro egg hatch only** (discriminated by `lastStageChange.from === 'egg'`), gated by a pure `needsNameEntry` helper wired into `EvolutionScreen`'s cinematic-done handler. No Firebase — this phase is entirely local and TDD-able on the existing suite.

**Tech Stack:** React + Vite, Zustand (`persist`), TypeScript, vitest + @testing-library/react.

**Base:** branch `leaderboard` off `origin/main` (`b9114c5`, PERSIST_VERSION 18). Spec: `docs/superpowers/specs/2026-07-01-global-leaderboard-design.md`.

**Conventions:** Never `git add -A` (concurrent sessions share `.git`) — stage explicit paths. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Run the suite with `npx vitest run` (from `D:\ai_projects\AI_design_thinking\sentence-pet`, via the Bash tool with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet`). Baseline before starting: **1353 green**, `npx tsc --noEmit` clean.

---

## File Structure

- Create `src/domain/playerName.ts` — pure name sanitizer (`sanitizeName`, `needsNameEntry`, constants). One responsibility: validate/normalize a display name.
- Create `src/domain/playerName.test.ts` — unit tests for the above.
- Modify `src/state/gameStore.ts` — add `displayName` state + `setDisplayName` action + PERSIST_VERSION bump + migrate + `PersistedState`/`selectPersisted`/`freshState`.
- Modify `src/state/gameStore.test.ts` — cover the new field, action, and migration.
- Modify `src/data/types.ts:91` — add `'nameEntry'` to the `Screen` union.
- Create `src/components/NameEntry.tsx` — the onboarding scene component.
- Create `src/components/NameEntry.test.tsx` — component tests.
- Modify `src/App.tsx` — add the `nameEntry` case to `screenKeyAndNode`.
- Modify `src/components/EvolutionScreen.tsx` — route the intro-hatch cinematic to `nameEntry`.

---

## Task 1: `sanitizeName` pure sanitizer

**Files:**
- Create: `src/domain/playerName.ts`
- Test: `src/domain/playerName.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/playerName.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeName, NAME_MIN, NAME_MAX } from './playerName';

describe('sanitizeName', () => {
  it('accepts a normal name and trims/collapses whitespace', () => {
    const r = sanitizeName('  Ava   Lee  ');
    expect(r).toEqual({ ok: true, name: 'Ava Lee' });
  });

  it('rejects too short', () => {
    expect(sanitizeName('A').ok).toBe(false);
    expect(sanitizeName('A').reason).toBe('length');
  });

  it('rejects too long (>NAME_MAX)', () => {
    const long = 'a'.repeat(NAME_MAX + 1);
    expect(sanitizeName(long).ok).toBe(false);
    expect(sanitizeName(long).reason).toBe('length');
  });

  it('rejects digits (blocks phone numbers / number-runs)', () => {
    expect(sanitizeName('Ava123').ok).toBe(false);
    expect(sanitizeName('Ava123').reason).toBe('charset');
  });

  it('rejects emails and urls via charset (@ . / :)', () => {
    expect(sanitizeName('me@x.com').ok).toBe(false);
    expect(sanitizeName('http://x').ok).toBe(false);
  });

  it('rejects blocklisted words case-insensitively', () => {
    // 'darn' stands in for the production blocklist token set.
    expect(sanitizeName('SuperDarn', { blocklist: ['darn'] }).ok).toBe(false);
    expect(sanitizeName('SuperDarn', { blocklist: ['darn'] }).reason).toBe('blocked');
  });

  it('allows accented letters (NFKC-normalized)', () => {
    expect(sanitizeName('Zoé').ok).toBe(true);
  });

  it('NAME_MIN/NAME_MAX are 2 and 16', () => {
    expect([NAME_MIN, NAME_MAX]).toEqual([2, 16]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/playerName.test.ts`
Expected: FAIL — cannot find module `./playerName`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/playerName.ts
/** Bounds for a player display name (inclusive). */
export const NAME_MIN = 2;
export const NAME_MAX = 16;

export interface NameResult {
  ok: boolean;
  /** The normalized name (present whether or not ok — callers show it back). */
  name: string;
  /** Why it failed, when !ok. */
  reason?: 'length' | 'charset' | 'blocked';
}

/** Letters (any script), combining marks, and single internal spaces only.
 *  This alone rejects digits, @, ., /, :, emoji — so emails, urls, and phone
 *  numbers are all rejected without separate regexes. */
const ALLOWED = /^[\p{L}\p{M}]+( [\p{L}\p{M}]+)*$/u;

/** Normalize, then validate a raw display name. Pure. The production blocklist is
 *  injected (default empty) so this module carries no profanity data itself. */
export function sanitizeName(raw: string, opts: { blocklist?: string[] } = {}): NameResult {
  const name = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, name, reason: 'length' };
  if (!ALLOWED.test(name)) return { ok: false, name, reason: 'charset' };
  const lower = name.toLowerCase();
  if ((opts.blocklist ?? []).some((w) => lower.includes(w.toLowerCase()))) return { ok: false, name, reason: 'blocked' };
  return { ok: true, name };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/playerName.test.ts`
Expected: PASS (all 7).

- [ ] **Step 5: Commit**

```bash
git add src/domain/playerName.ts src/domain/playerName.test.ts
git commit -m "feat(leaderboard): sanitizeName player-name validator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `needsNameEntry` intro-hatch gate helper

**Files:**
- Modify: `src/domain/playerName.ts`
- Test: `src/domain/playerName.test.ts`

- [ ] **Step 1: Write the failing test** (append to the existing describe file)

```ts
// append to src/domain/playerName.test.ts
import { needsNameEntry } from './playerName';

describe('needsNameEntry', () => {
  it('true only for the intro egg hatch with no name yet', () => {
    expect(needsNameEntry('egg', '')).toBe(true);
    expect(needsNameEntry('egg', '   ')).toBe(true);
  });
  it('false when a name already exists', () => {
    expect(needsNameEntry('egg', 'Ava')).toBe(false);
  });
  it('false for real evolutions (not the egg hatch)', () => {
    expect(needsNameEntry('baby', '')).toBe(false);
    expect(needsNameEntry('young', '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/playerName.test.ts`
Expected: FAIL — `needsNameEntry` is not exported.

- [ ] **Step 3: Write minimal implementation** (append to `src/domain/playerName.ts`)

```ts
import type { PetStage } from '../data/types';

/** The intro egg-hatch is the one place we capture a name: the cinematic that just
 *  finished came from the egg (from === 'egg') and no name is set yet. Real
 *  evolutions (baby/young start) and already-named players are never gated. */
export function needsNameEntry(fromStage: PetStage, displayName: string): boolean {
  return fromStage === 'egg' && displayName.trim() === '';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/playerName.test.ts`
Expected: PASS (all 10).

- [ ] **Step 5: Commit**

```bash
git add src/domain/playerName.ts src/domain/playerName.test.ts
git commit -m "feat(leaderboard): needsNameEntry intro-hatch gate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `displayName` store field + action + migration (v18→v19)

**Files:**
- Modify: `src/state/gameStore.ts` (multiple sites — see below)
- Test: `src/state/gameStore.test.ts`

Sites in `gameStore.ts` to touch:
- The `GameState` interface (actions region near `setScreen`) — add `displayName: string;` and `setDisplayName: (name: string) => void;`.
- `PERSIST_VERSION` (line ~118) — bump `18` → `19`.
- `PersistedState` Pick union (line ~122) — add `| 'displayName'`.
- `selectPersisted` (line ~130) — add `displayName: s.displayName,`.
- `freshState()` (line ~231) — add `displayName: '' as string,`.
- `setScreen` action neighborhood (line ~235) — add the `setDisplayName` action.
- `migrate` (the `base` object, near the `courseComplete` backfill line ~571) — add the v18→v19 backfill.

- [ ] **Step 1: Write the failing test** (append to `src/state/gameStore.test.ts`)

```ts
// append to src/state/gameStore.test.ts
describe('displayName', () => {
  it('defaults to empty and setDisplayName updates + persists it', () => {
    useGameStore.getState().resetForTest();
    expect(useGameStore.getState().displayName).toBe('');
    useGameStore.getState().setDisplayName('Ava');
    expect(useGameStore.getState().displayName).toBe('Ava');
    expect(selectPersisted(useGameStore.getState()).displayName).toBe('Ava');
  });

  it('PERSIST_VERSION is 19', () => {
    expect(PERSIST_VERSION).toBe(19);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/gameStore.test.ts -t displayName`
Expected: FAIL — `displayName` undefined / `setDisplayName` not a function / version 18.

- [ ] **Step 3: Write minimal implementation**

In the `GameState` interface, next to `setScreen: (s: Screen) => void;`:
```ts
  displayName: string;
  setDisplayName: (name: string) => void;
```

Bump the version:
```ts
export const PERSIST_VERSION = 19;
```

Add to the `PersistedState` Pick union (append to the last line of the union):
```ts
  | 'caughtDefIds' | 'displayName'
```

Add to `selectPersisted`'s returned object (after `caughtDefIds: s.caughtDefIds,`):
```ts
    displayName: s.displayName,
```

Add to `freshState()`'s returned object (near `courseComplete: {} ...`):
```ts
    displayName: '' as string,
```

Add the action next to `setScreen`:
```ts
      setDisplayName: (name) => set({ displayName: name }),
```

Add the v18→v19 backfill inside `migrate`, in the `base` object literal (alongside the `courseComplete` backfill):
```ts
          // v18->v19: backfill the player display name (default '' — the name-entry
          // scene captures it on the next intro hatch / self-heals via the gate).
          displayName: (st as { displayName?: string }).displayName ?? '',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/gameStore.test.ts -t displayName`
Expected: PASS (both).

- [ ] **Step 5: Verify no regressions in the store suite**

Run: `npx vitest run src/state/gameStore.test.ts`
Expected: all PASS (existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat(leaderboard): persist displayName (PERSIST_VERSION 18->19)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `nameEntry` screen in the `Screen` union + router

**Files:**
- Modify: `src/data/types.ts:91`
- Modify: `src/App.tsx` (`screenKeyAndNode` switch + import)

- [ ] **Step 1: Add `'nameEntry'` to the `Screen` union**

In `src/data/types.ts:91`, add `'nameEntry'`:
```ts
export type Screen = 'egg' | 'nameEntry' | 'petRoom' | 'pickCourse' | 'pickDrill' | 'drill' | 'reward' | 'shop' | 'gacha' | 'collection' | 'evolution' | 'rewardHatch' | 'bossPrep' | 'battle';
```

- [ ] **Step 2: Write the failing router test** (append to `src/App.test.tsx`)

```ts
// append to src/App.test.tsx — import screenKeyAndNode is already available there if used;
// otherwise: import { screenKeyAndNode } from './App';
import { screenKeyAndNode } from './App';

describe('screenKeyAndNode nameEntry', () => {
  it('routes nameEntry to the NameEntry screen when hatched', () => {
    const { key } = screenKeyAndNode('nameEntry', true, 'pattern', 1, [], 'dragdrop');
    expect(key).toBe('nameEntry');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx -t "nameEntry"`
Expected: FAIL — key falls through to `'petRoom'` (default).

- [ ] **Step 4: Wire the router**

In `src/App.tsx`, add the import near the other screen imports:
```ts
import { NameEntry } from './components/NameEntry';
```
Add the case in `screenKeyAndNode`, just after the `!hatched` guard's first case (before `pickCourse`):
```ts
    case 'nameEntry': return { key: 'nameEntry', node: <NameEntry /> };
```

*(NameEntry is created in Task 5; add a temporary stub so this compiles now:)*
Create `src/components/NameEntry.tsx` with a placeholder that Task 5 fills:
```tsx
export function NameEntry() {
  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx -t "nameEntry"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/App.tsx src/components/NameEntry.tsx src/App.test.tsx
git commit -m "feat(leaderboard): add nameEntry screen to router

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `NameEntry` scene component

**Files:**
- Modify: `src/components/NameEntry.tsx`
- Test: `src/components/NameEntry.test.tsx`

Behavior: a single text input + a confirm button. The confirm button is disabled until `sanitizeName(input).ok`. On confirm: `setDisplayName(sanitized.name)` then `setScreen('petRoom')`. Show the failure reason as friendly helper text while invalid.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/NameEntry.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGameStore } from '../state/gameStore';
import { NameEntry } from './NameEntry';

beforeEach(() => useGameStore.getState().resetForTest());

describe('NameEntry', () => {
  it('disables confirm until the name is valid', () => {
    render(<NameEntry />);
    const btn = screen.getByRole('button', { name: /that's me|confirm|start/i });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A' } });
    expect(btn).toBeDisabled(); // too short
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ava' } });
    expect(btn).not.toBeDisabled();
  });

  it('confirming stores the sanitized name and goes to petRoom', () => {
    render(<NameEntry />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Ava Lee  ' } });
    fireEvent.click(screen.getByRole('button', { name: /that's me|confirm|start/i }));
    expect(useGameStore.getState().displayName).toBe('Ava Lee');
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('shows a friendly hint when the name has disallowed characters', () => {
    render(<NameEntry />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ava123' } });
    expect(screen.getByText(/letters/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/NameEntry.test.tsx`
Expected: FAIL — NameEntry renders `null`, no textbox/button.

- [ ] **Step 3: Write the component**

```tsx
// src/components/NameEntry.tsx
import { useMemo, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { sanitizeName, NAME_MAX } from '../domain/playerName';

const HINT: Record<string, string> = {
  length: `Use ${2}–${NAME_MAX} letters.`,
  charset: 'Use letters only — no numbers or symbols.',
  blocked: 'Please pick a different name.',
};

/** Post-hatch onboarding scene: capture the player's display name. */
export function NameEntry() {
  const setDisplayName = useGameStore((s) => s.setDisplayName);
  const setScreen = useGameStore((s) => s.setScreen);
  const [raw, setRaw] = useState('');
  const result = useMemo(() => sanitizeName(raw), [raw]);
  const showHint = raw.trim().length > 0 && !result.ok;

  const confirm = () => {
    if (!result.ok) return;
    setDisplayName(result.name);
    setScreen('petRoom');
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-amber-50 to-amber-100 p-6 text-amber-900">
      <h1 className="text-2xl font-extrabold">What should we call you?</h1>
      <input
        type="text"
        aria-label="Your name"
        value={raw}
        maxLength={NAME_MAX}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
        className="w-64 rounded-2xl border-2 border-amber-300 bg-white px-4 py-3 text-center text-lg font-bold outline-none focus:border-amber-500"
        placeholder="Type your name"
      />
      <p className="h-5 text-sm text-amber-700">{showHint ? HINT[result.reason ?? 'charset'] : ''}</p>
      <button
        type="button"
        disabled={!result.ok}
        onClick={confirm}
        className="rounded-full bg-amber-500 px-8 py-3 text-lg font-extrabold text-white shadow disabled:opacity-40"
      >
        That's me!
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/NameEntry.test.tsx`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/components/NameEntry.tsx src/components/NameEntry.test.tsx
git commit -m "feat(leaderboard): NameEntry onboarding scene

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Route the intro hatch through `nameEntry`

**Files:**
- Modify: `src/components/EvolutionScreen.tsx`
- Test: `src/components/EvolutionScreen.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/EvolutionScreen.test.tsx (create if missing)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useGameStore } from '../state/gameStore';
import { EvolutionScreen } from './EvolutionScreen';

// Drive the cinematic's onDone synchronously via a mock.
vi.mock('./EvolutionCinematic', () => ({
  EvolutionCinematic: ({ onDone }: { onDone: () => void }) => (
    <button onClick={onDone}>done</button>
  ),
}));

beforeEach(() => useGameStore.getState().resetForTest());

describe('EvolutionScreen intro-hatch name gate', () => {
  it('intro egg hatch with no name routes to nameEntry', () => {
    useGameStore.setState({ screen: 'evolution', lastStageChange: { from: 'egg', to: 'baby' }, displayName: '' });
    render(<EvolutionScreen />);
    screen.getByText('done').click();
    expect(useGameStore.getState().screen).toBe('nameEntry');
  });

  it('egg hatch when a name already exists goes to petRoom (no re-prompt)', () => {
    useGameStore.setState({ screen: 'evolution', lastStageChange: { from: 'egg', to: 'baby' }, displayName: 'Ava', currentCourseId: null });
    render(<EvolutionScreen />);
    screen.getByText('done').click();
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('a real evolution (baby->young) never routes to nameEntry', () => {
    useGameStore.setState({ screen: 'evolution', lastStageChange: { from: 'baby', to: 'young' }, displayName: '', currentCourseId: null });
    render(<EvolutionScreen />);
    screen.getByText('done').click();
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/EvolutionScreen.test.tsx`
Expected: FAIL — first case lands on `petRoom` (gate not wired).

- [ ] **Step 3: Wire the gate**

In `src/components/EvolutionScreen.tsx`:
- Add import: `import { needsNameEntry } from '../domain/playerName';`
- Add a selector near the others: `const displayName = useGameStore((s) => s.displayName);`
- Replace the `onDone` body:
```tsx
      onDone={() => {
        clearStageChange();
        setScreen(
          needsNameEntry(change.from, displayName)
            ? 'nameEntry'
            : postCinematicScreen(currentCourseId),
        );
      }}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/EvolutionScreen.test.tsx`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/components/EvolutionScreen.tsx src/components/EvolutionScreen.test.tsx
git commit -m "feat(leaderboard): route intro hatch through nameEntry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Whole-suite + type verification

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all green (baseline 1353 + the new tests, ~1367+). If any prior test asserted the exact `Screen` union or PERSIST_VERSION 18, update it to match (search: `PERSIST_VERSION` assertions, `Screen` snapshot).

- [ ] **Step 2: Types**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual smoke (optional, no browser tool this session)**

`npm run dev` → clear local storage → load: egg → tap to hatch → cinematic → **name scene** → type a name → land in petRoom greeted by name. (Deferred if no browser available; note it in the handoff.)

- [ ] **Step 4: No extra commit needed** unless Step 1 required a fixup — if so:

```bash
git add <changed test files>
git commit -m "test(leaderboard): update Screen/version assertions for nameEntry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (author checklist — done)

- **Spec coverage:** P1 slice of the spec = name-entry scene + `sanitizeName` + gameStore field/migration. All covered (Tasks 1–6). Board write/read, opt-in toggle, rules, go-live are explicitly **out of this plan** (see Roadmap).
- **Placeholder scan:** none — the NameEntry stub in Task 4 is intentional and replaced in Task 5; blocklist data is injected (mechanism fully specified), not a TODO.
- **Type consistency:** `sanitizeName`/`needsNameEntry`/`NameResult`/`displayName`/`setDisplayName`/`'nameEntry'` used identically across tasks. `PetStage` imported from `../data/types` (already the source of `Screen`).

---

## Roadmap (subsequent plans — NOT this plan)

Each gets its own spec-derived plan + session (phase-handoff workflow):

- **P0 — Firebase go-live (Spark).** Ops, user-collaborative (real project creation, Auth/Firestore/Storage enable, deploy rules, seed content, prod config). Prerequisite for P2/P3 to be *live*, but not for building/testing them on the emulator.
- **P2 — Leaderboard write path + rules.** `leaderboardOptIn` field (v19→v20) + Settings toggle; `leaderboards/{metric}/entries/{uid}` writes on catch / course-complete; `firestore.rules` score-match validation (+ `coursesCount` derived int); rules tests via `test:rules`.
- **P3 — Leaderboard read screen.** `Leaderboard` component, tabs Courses|Dex, top-50 + your-rank count-aggregation, empty state; `impeccable` UI pass; petRoom entry button.

# Generational Pet Dex P4c — Reward Pets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a boss clear grant a specific authored pet (`rewardPetDefId`) — data-driven, dex-tracked, revealed via a hatch cinematic — with a P4b obtainable-pool fallback when no reward is set.

**Architecture:** Author `rewardPetDefId` on a `BossNode`; the journey synth copies it onto the synthetic boss `Lesson`; `finishBoss` reads it, resolves the def (or pool-picks), makes a band-rolled pet, records it caught, and stages a transient `lastHatch` that a new `rewardHatch` screen plays before the (rare) active-pet evolution.

**Tech Stack:** TypeScript, React, Zustand (persist), Vitest + Testing Library, Playwright (hermetic e2e).

**Branch:** `journey-redesign` (integration branch — commit here, do NOT merge to `main`).

**Spec:** `docs/superpowers/specs/2026-06-28-generational-pet-dex-p4c-reward-pets-design.md`

**Conventions (every task):**
- Verify gate: `npm test`, `npx tsc -b` (NOT `--noEmit`), `npm run build`. Windows worker-fork flake ("Worker exited unexpectedly") → re-run, not a real failure.
- Stage explicit files — **never `git add -A`**.
- Never hand-edit generated `src/content/seed.ts`.
- For "create" steps, confirm the target file does not already exist; APPEND to existing test files, never overwrite.

---

### Task 1: Data model + journey synth propagation

**Files:**
- Modify: `src/content/course.ts` (`BossNode`)
- Modify: `src/content/model.ts` (`Lesson`)
- Modify: `src/content/journey.ts` (`bossUnit`)
- Test: `src/content/journey.test.ts`

- [ ] **Step 1: Add the failing test** — APPEND to `src/content/journey.test.ts`. It builds a course whose final boss carries `rewardPetDefId` and asserts the synthetic boss lesson carries it; a gate without one omits it.

```ts
import { resolveCourseBundle } from './journey';
// (reuse the file's existing course-building helpers / fixtures)

it('propagates rewardPetDefId from a boss node onto its synth lesson', () => {
  const course = makeTestCourse({
    gates: [{ id: 'g1', title: 'G1', scope: 'gated', afterUnitId: 'u1', reviewsUnitIds: ['u1'], reviewCount: 1, boss: testBoss() }],
    finalBoss: { id: 'fb', title: 'FB', scope: 'final', reviewsUnitIds: ['u1'], reviewCount: 1, boss: testBoss(), onClear: 'completeCourse', rewardPetDefId: 'leaf-1' },
  });
  const bundle = resolveCourseBundle(course, () => 0.5);
  const lessons = bundle.units.flatMap((u) => u.lessons);
  const finalLesson = lessons.find((l) => l.id === 'fb');
  const gateLesson = lessons.find((l) => l.id === 'g1');
  expect(finalLesson?.rewardPetDefId).toBe('leaf-1');
  expect(gateLesson?.rewardPetDefId).toBeUndefined();
});
```
> If `makeTestCourse`/`testBoss` helpers don't exist in the file, build the `Course` inline using the shapes already imported there (mirror an existing test in the same file).

- [ ] **Step 2: Run test — expect FAIL** (`rewardPetDefId` not on the types / not copied).

Run: `npx vitest run src/content/journey.test.ts`
Expected: FAIL (type error on `rewardPetDefId` and/or `undefined` returned).

- [ ] **Step 3: Add the field to `BossNode`** — `src/content/course.ts`, inside `interface BossNode` (after `onClear?`):

```ts
  rewardPetDefId?: string;     // P4c: grant this specific PetDef on first clear (else pool-pick fallback)
```

- [ ] **Step 4: Add the field to `Lesson`** — `src/content/model.ts`, inside `interface Lesson` (after `onClear?`):

```ts
  rewardPetDefId?: string;     // set only on a synthetic boss lesson (see content/journey.ts) — P4c reward grant
```

- [ ] **Step 5: Propagate in the synth** — `src/content/journey.ts` `bossUnit`, in the `lesson` object literal (after the `onClear` spread line):

```ts
    ...(node.rewardPetDefId ? { rewardPetDefId: node.rewardPetDefId } : {}),
```

- [ ] **Step 6: Run test — expect PASS.**

Run: `npx vitest run src/content/journey.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/content/course.ts src/content/model.ts src/content/journey.ts src/content/journey.test.ts
git commit -m "feat(content): add rewardPetDefId to BossNode + Lesson, propagate in journey synth"
```

---

### Task 2: `obtainablePool` helper (DRY pullEgg) + fold-in #2 unit test

**Files:**
- Modify: `src/domain/petDef.ts` (add `obtainablePool`)
- Modify: `src/state/gameStore.ts` (`pullEgg` uses the helper)
- Test: `src/domain/petDef.test.ts`

- [ ] **Step 1: Add the failing test** — APPEND to `src/domain/petDef.test.ts`:

```ts
import { obtainablePool } from './petDef';

describe('obtainablePool', () => {
  it('keeps enabled defs and drops gachaObtainable===false', () => {
    const a = { ...BUILTIN_PET_DEFS[0], id: 'a', enabled: true, gachaObtainable: true };
    const b = { ...BUILTIN_PET_DEFS[0], id: 'b', enabled: true, gachaObtainable: false };
    const c = { ...BUILTIN_PET_DEFS[0], id: 'c', enabled: false };
    expect(obtainablePool([a, b, c]).map((d) => d.id)).toEqual(['a']);
  });
  it('falls back to a never-empty pool when nothing is obtainable', () => {
    const none = [{ ...BUILTIN_PET_DEFS[0], id: 'x', enabled: false }];
    expect(obtainablePool(none).length).toBe(1); // starterDef fallback — never blank
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (`obtainablePool` not exported).

Run: `npx vitest run src/domain/petDef.test.ts`
Expected: FAIL ("obtainablePool is not a function" / import error).

- [ ] **Step 3: Add the helper** — `src/domain/petDef.ts` (near `getActivePetDefs`/`starterDef`):

```ts
/** The never-empty gacha/reward pool: enabled + obtainable defs, or [starterDef()] as a floor. */
export function obtainablePool(defs: readonly PetDef[] = active): readonly PetDef[] {
  const pool = defs.filter((d) => d.enabled && d.gachaObtainable !== false);
  return pool.length ? pool : [starterDef(defs)];
}
```
> Confirm `starterDef` and `active` are in scope in this module (they are — `resolvePetDef` uses both).

- [ ] **Step 4: Refactor `pullEgg`** — `src/state/gameStore.ts` (~398–399), replace the inline filter + fallback with the helper. Add `obtainablePool` to the existing `'../domain/petDef'` import.

```ts
          const defs = obtainablePool();
          const res = pullEggDomain(
            { coins: s.coins },
            { price: GAME_CONFIG.gacha.eggPrice, id: crypto.randomUUID(), rng, table: GAME_CONFIG.gacha.rarities, defs },
          );
```
> Delete the now-unused two lines (`const pool = ...` / `const defs = pool.length ? ...`). Leave the rest of `pullEgg` untouched so the gacha RNG call order is unchanged.

- [ ] **Step 5: Run tests — expect PASS** (helper test + existing gacha/store suites unchanged).

Run: `npx vitest run src/domain/petDef.test.ts src/state/gameStore.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/domain/petDef.ts src/domain/petDef.test.ts src/state/gameStore.ts
git commit -m "refactor(petDef): extract obtainablePool helper + unit test, use in pullEgg"
```

---

### Task 3: Data-driven boss-clear grant + `lastHatch` transient

**Files:**
- Modify: `src/data/types.ts` (`Screen` union)
- Modify: `src/state/gameStore.ts` (`finishBoss` grant, `lastHatch`, `clearHatch`, `partialize`)
- Test: `src/state/gameStore.test.ts`

- [ ] **Step 1: Add failing tests** — APPEND to `src/state/gameStore.test.ts`. Cover: (a) reward id → exact def granted; (b) no reward id → pool-pick obtainable def; (c) dangling id → starter fallback, never blank; plus `lastHatch` set and `caughtDefIds` union. Drive the store with a controlled catalog via `setActivePetDefs` and a controlled boss lesson via the content store (mirror the existing finishBoss test setup in this file).

```ts
// Pseudocode shape — adapt to this file's existing finishBoss harness (content-store seeding + rng control).
it('grants the exact reward def on first boss clear', () => {
  setActivePetDefs([{ ...BUILTIN_PET_DEFS[0], id: 'reward-1', element: 'fire', enabled: true }, ...BUILTIN_PET_DEFS]);
  seedBossLesson({ id: 'b1', rewardPetDefId: 'reward-1' }); // sets currentBossLessonId + bundle
  useGameStore.getState().finishBoss(true);
  const s = useGameStore.getState();
  const granted = s.pets[s.pets.length - 1];
  expect(granted.defId).toBe('reward-1');
  expect(granted.species).toBe('fire');           // = def.element
  expect(s.lastHatch?.id).toBe(granted.id);
  expect(s.caughtDefIds.has('reward-1')).toBe(true);
  setActivePetDefs(BUILTIN_PET_DEFS); // restore
});

it('pool-picks an obtainable def when the boss has no rewardPetDefId', () => {
  seedBossLesson({ id: 'b2' }); // no rewardPetDefId
  useGameStore.getState().finishBoss(true);
  const s = useGameStore.getState();
  const granted = s.pets[s.pets.length - 1];
  expect(obtainablePool().some((d) => d.id === granted.defId)).toBe(true);
  expect(s.lastHatch?.id).toBe(granted.id);
});

it('falls back to the starter def for a dangling rewardPetDefId (never blank)', () => {
  seedBossLesson({ id: 'b3', rewardPetDefId: 'does-not-exist' });
  useGameStore.getState().finishBoss(true);
  const s = useGameStore.getState();
  const granted = s.pets[s.pets.length - 1];
  expect(granted.defId).toBe(starterDef().id);
  expect(s.lastHatch).not.toBeNull();
});
```
> Imports to add: `obtainablePool`, `starterDef`, `setActivePetDefs`, `BUILTIN_PET_DEFS` from `../domain/petDef`. `seedBossLesson` = whatever helper/pattern the existing finishBoss tests use to set `currentBossLessonId` + a bundle lesson; reuse it (add `rewardPetDefId` to the lesson it builds).

- [ ] **Step 2: Run tests — expect FAIL** (`lastHatch` undefined; grant still random element).

Run: `npx vitest run src/state/gameStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add `'rewardHatch'` to the `Screen` union** — `src/data/types.ts:86`:

```ts
export type Screen = 'egg' | 'petRoom' | 'pickCourse' | 'pickDrill' | 'drill' | 'reward' | 'shop' | 'gacha' | 'collection' | 'evolution' | 'rewardHatch' | 'bossPrep' | 'battle';
```

- [ ] **Step 4: Add `lastHatch` state + `clearHatch` action** — `src/state/gameStore.ts`.
  - In the `GameState` interface, after `lastPull: PetInstance | null;`:
    ```ts
      lastHatch: PetInstance | null;   // P4c: transient — the freshly-granted reward pet awaiting its hatch cinematic
    ```
  - In the action type block, near `clearStageChange`:
    ```ts
      clearHatch: () => void;
    ```
  - In the initial-state literal, after `lastPull: null as PetInstance | null,`:
    ```ts
      lastHatch: null as PetInstance | null,
    ```
  - Add the action near `clearStageChange`:
    ```ts
      clearHatch: () => set({ lastHatch: null }),
    ```

- [ ] **Step 5: Rewrite the grant** — `src/state/gameStore.ts` `finishBoss` firstClear block (~290–298). Replace the `makePet({... random element, rollStats ...})` egg with the data-driven grant, and add `lastHatch`:

```ts
            const rewardId = cleared?.rewardPetDefId;
            const def = rewardId
              ? resolvePetDef(rewardId)                                  // starter-fallback if dangling — never blank
              : (() => { const pool = obtainablePool(); return pool[Math.floor(rng() * pool.length)]; })();
            const egg = makePet({
              id: crypto.randomUUID(),
              species: def.element,
              defId: def.id,
              stats: rollStatsFromBands(def.statBands.common, rng),
              rarity: 'common',
            });
            pets = [...pets, egg];
            lastPull = egg;
            lastHatch = egg;
            caughtDefIds = addCaught(caughtDefIds, egg.defId);
```
  - Declare `let lastHatch: PetInstance | null = s.lastHatch;` alongside the other `let lastPull = ...` declarations (~279).
  - Add `resolvePetDef`, `obtainablePool`, `rollStatsFromBands` to imports (`resolvePetDef`+`obtainablePool` from `../domain/petDef`; `rollStatsFromBands` from `../domain/pets`). Remove the now-unused `rollStats` import **only if** nothing else in the file uses it — verify first (`finishRound` etc.).
  - Add `lastHatch,` to the returned object (next to `lastPull,`).

- [ ] **Step 6: Exclude `lastHatch` from persist** — `src/state/gameStore.ts` `partialize` (~466–474): add `lastHatch` to the destructure, the `void`, and the `Omit<...>` cast.

```ts
      partialize: (s) => {
        const { lastLevelUp, lastStageChange, lastHatch, currentLessonId, currentCourseId, currentBossLessonId, pendingStinger, ...rest } = s;
        void lastLevelUp; // transient — not persisted
        void lastStageChange; // transient — not persisted
        void lastHatch; // transient — not persisted
        // ... existing voids ...
        return rest as Omit<GameState, 'lastLevelUp' | 'lastStageChange' | 'lastHatch' | 'currentLessonId' | 'currentCourseId' | 'currentBossLessonId' | 'pendingStinger'>;
      },
```

- [ ] **Step 7: Run tests — expect PASS.**

Run: `npx vitest run src/state/gameStore.test.ts src/state/gameStore.persisted.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add src/data/types.ts src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat(gameStore): data-driven boss reward grant + lastHatch transient"
```

---

### Task 4: `RewardHatchScreen` + routing

**Files:**
- Create: `src/components/RewardHatchScreen.tsx`
- Modify: `src/App.tsx` (route + `zoneForScreen`)
- Modify: `src/components/RewardScreen.tsx` (Continue routing)
- Test: `src/components/RewardHatchScreen.test.tsx` (create)

- [ ] **Step 1: Confirm the file is new** — verify `src/components/RewardHatchScreen.tsx` does not already exist (`ls src/components/RewardHatchScreen.tsx` → not found).

- [ ] **Step 2: Add a failing test** — Create `src/components/RewardHatchScreen.test.tsx`. Mock `EvolutionCinematic` to a button that invokes `onDone`, set `lastHatch`, and assert that after done it clears the hatch and routes (to `petRoom` with no stage change; to `evolution` with one).

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { RewardHatchScreen } from './RewardHatchScreen';
import { useGameStore } from '../state/gameStore';
import { makePet } from '../domain/pets';

vi.mock('./EvolutionCinematic', () => ({
  EvolutionCinematic: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>done</button>,
}));

const pet = () => makePet({ id: 'p1', species: 'leaf', defId: 'leaf-1', stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 }, rarity: 'common' });

it('plays the hatch then routes to petRoom and clears lastHatch', () => {
  useGameStore.setState({ lastHatch: pet(), lastStageChange: null });
  render(<RewardHatchScreen />);
  fireEvent.click(screen.getByText('done'));
  expect(useGameStore.getState().lastHatch).toBeNull();
  expect(useGameStore.getState().screen).toBe('petRoom');
});

it('routes to evolution when an active-pet stage change is pending', () => {
  useGameStore.setState({ lastHatch: pet(), lastStageChange: { from: 'baby', to: 'young' } });
  render(<RewardHatchScreen />);
  fireEvent.click(screen.getByText('done'));
  expect(useGameStore.getState().screen).toBe('evolution');
});
```

- [ ] **Step 3: Run test — expect FAIL** (module not found).

Run: `npx vitest run src/components/RewardHatchScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Create the component** — `src/components/RewardHatchScreen.tsx` (mirror `EvolutionScreen.tsx`):

```tsx
import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { resolvePetDef } from '../domain/petDef';
import { usePetDefs } from '../state/usePetDefs';
import { EvolutionCinematic } from './EvolutionCinematic';

/** Plays the egg→baby hatch for a freshly-granted boss-reward pet (lastHatch),
 *  then hands off to the active-pet evolution (if any) or the pet room. */
export function RewardHatchScreen() {
  const pet = useGameStore((s) => s.lastHatch);
  const lastStageChange = useGameStore((s) => s.lastStageChange);
  const clearHatch = useGameStore((s) => s.clearHatch);
  const setScreen = useGameStore((s) => s.setScreen);
  const defs = usePetDefs();

  useEffect(() => {
    if (!pet) setScreen('petRoom'); // reload guard — nothing to hatch
  }, [pet, setScreen]);

  if (!pet) return null;

  return (
    <EvolutionCinematic
      from="egg"
      to="baby"
      species={pet.species}
      def={resolvePetDef(pet.defId, defs)}
      onDone={() => {
        clearHatch();
        setScreen(lastStageChange ? 'evolution' : 'petRoom');
      }}
    />
  );
}
```

- [ ] **Step 5: Route it in `App.tsx`** — add the import and a case (after `case 'evolution'`):

```tsx
import { RewardHatchScreen } from './components/RewardHatchScreen';
// ...
    case 'rewardHatch': return { key: 'rewardHatch', node: <RewardHatchScreen /> };
```
  And in `zoneForScreen`, add `case 'rewardHatch':` to the same group as `case 'evolution':` (cinematic → `null` music).

- [ ] **Step 6: Update `RewardScreen` Continue routing** — `src/components/RewardScreen.tsx`. Add `const lastHatch = useGameStore((s) => s.lastHatch);` near the other selectors and change the Continue `onClick`:

```tsx
        onClick={() => setScreen(lastHatch ? 'rewardHatch' : lastStageChange ? 'evolution' : 'petRoom')}
```

- [ ] **Step 7: Run tests — expect PASS** (new screen + RewardScreen suite).

Run: `npx vitest run src/components/RewardHatchScreen.test.tsx src/components/RewardScreen.test.tsx src/App.test.tsx`
Expected: PASS. (If `RewardScreen.test.tsx` doesn't exist, omit it.)

- [ ] **Step 8: Commit.**

```bash
git add src/components/RewardHatchScreen.tsx src/components/RewardHatchScreen.test.tsx src/App.tsx src/components/RewardScreen.tsx
git commit -m "feat(reward): rewardHatch screen plays the granted pet's hatch before evolution"
```

---

### Task 5: `validateCourse` reward cross-ref + admin/import wiring

**Files:**
- Modify: `src/content/validate.ts` (`validateCourse` signature + check)
- Modify: `src/components/admin/AdminShell.tsx` (pass id set)
- Modify: `src/components/admin/ImportTab.tsx` (pass id set)
- Test: `src/content/validate.test.ts`

- [ ] **Step 1: Add failing tests** — APPEND to `src/content/validate.test.ts`:

```ts
it('flags a boss rewardPetDefId with no matching PetDef', () => {
  const course = makeValidCourse(); // reuse the file's valid-course fixture
  course.finalBoss!.rewardPetDefId = 'ghost';
  const res = validateCourse(course, { petDefIds: new Set(['leaf-1', 'fire-1']) });
  expect(res.ok).toBe(false);
  expect(res.errors.some((e) => e.includes('rewardPetDefId') && e.includes('ghost'))).toBe(true);
});

it('accepts a known rewardPetDefId', () => {
  const course = makeValidCourse();
  course.finalBoss!.rewardPetDefId = 'leaf-1';
  expect(validateCourse(course, { petDefIds: new Set(['leaf-1']) }).ok).toBe(true);
});

it('skips the reward cross-ref when no petDefIds are provided', () => {
  const course = makeValidCourse();
  course.finalBoss!.rewardPetDefId = 'ghost';
  expect(validateCourse(course).ok).toBe(true); // no-arg = unchanged behavior
});
```
> If there's no `makeValidCourse` fixture, build a minimal valid course inline (the file already constructs valid courses for its existing `validateCourse` tests — reuse that).

- [ ] **Step 2: Run tests — expect FAIL** (extra arg ignored / no error pushed).

Run: `npx vitest run src/content/validate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend `validateCourse`** — `src/content/validate.ts:82`:

```ts
export function validateCourse(
  course: Course,
  opts?: { petDefIds?: ReadonlySet<string> },
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const push = (m: string) => errors.push(m);

  validateBundleShape({ pool: course.pool, units: course.units }, push);
  // ... existing checks unchanged ...
```
  Near the end of the function (before the `return`), add the cross-ref:

```ts
  if (opts?.petDefIds) {
    const bosses = [...course.gates, ...(course.finalBoss ? [course.finalBoss] : [])];
    for (const b of bosses) {
      if (b.rewardPetDefId && !opts.petDefIds.has(b.rewardPetDefId)) {
        push(`boss ${b.id}: unknown rewardPetDefId "${b.rewardPetDefId}"`);
      }
    }
  }
```

- [ ] **Step 4: Wire `AdminShell`** — `src/components/admin/AdminShell.tsx:25`. Import `getActivePetDefs` from `../../domain/petDef`, and pass the id set:

```ts
  const validation = validateCourse(currentDraft, { petDefIds: new Set(getActivePetDefs().map((d) => d.id)) });
```

- [ ] **Step 5: Wire `ImportTab`** — `src/components/admin/ImportTab.tsx:24`. Import `getActivePetDefs` and pass the same opts:

```ts
      const validation = parsed
        ? validateCourse(parsed, { petDefIds: new Set(getActivePetDefs().map((d) => d.id)) })
        : { ok: false, errors: [] };
```

- [ ] **Step 6: Run tests — expect PASS.**

Run: `npx vitest run src/content/validate.test.ts src/components/admin/AdminShell.test.tsx src/components/admin/ImportTab.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/content/validate.ts src/content/validate.test.ts src/components/admin/AdminShell.tsx src/components/admin/ImportTab.tsx
git commit -m "feat(validate): reject dangling boss rewardPetDefId; wire admin + import"
```

---

### Task 6: `BossesTab` reward dropdown

**Files:**
- Modify: `src/components/admin/BossesTab.tsx` (`BossFields`)
- Test: `src/components/admin/BossesTab.test.tsx` (append, or create if absent)

- [ ] **Step 1: Add a failing test** — APPEND to `src/components/admin/BossesTab.test.tsx` (create if it doesn't exist; if creating, mirror an existing admin-tab test's render/setup). Render `BossesTab`, change the reward select on the final boss, assert `onChange` fires with `finalBoss.rewardPetDefId` set; selecting "— none —" clears it.

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { BossesTab } from './BossesTab';
import { setActivePetDefs, BUILTIN_PET_DEFS } from '../../domain/petDef';

it('sets rewardPetDefId on the final boss via the dropdown', () => {
  setActivePetDefs(BUILTIN_PET_DEFS);
  const course = makeCourseWithFinalBoss(); // minimal Course with a finalBoss + 1 unit + pool
  const onChange = vi.fn();
  render(<BossesTab course={course} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText(/final boss reward/i), { target: { value: BUILTIN_PET_DEFS[0].id } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    finalBoss: expect.objectContaining({ rewardPetDefId: BUILTIN_PET_DEFS[0].id }),
  }));
});
```

- [ ] **Step 2: Run test — expect FAIL** (no such label / control).

Run: `npx vitest run src/components/admin/BossesTab.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Add the control** — `src/components/admin/BossesTab.tsx`, inside `BossFields`, after the sprite-stage `<label>` (before the `reviewCount` label). Import `usePetDefs` from `../../state/usePetDefs` at the top.

```tsx
      <label>{`${labelPrefix} reward`}
        <select className="border px-1" value={node.rewardPetDefId ?? ''}
          onChange={(e) => onPatch({ rewardPetDefId: e.target.value || undefined })}>
          <option value="">— none (random) —</option>
          {petDefs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
```
  At the top of `BossFields`, add `const petDefs = usePetDefs();`. The `aria-label` resolves from the `<label>` text `"{labelPrefix} reward"` (e.g. "final boss reward", "gate g1 reward") — matches the test's `/final boss reward/i`.
  > `onPatch` already accepts `Partial<BossNode>` and `patchGate`/`patchFinal` spread it at node level — no signature change needed. `e.target.value || undefined` clears the field when "— none —" is picked.

- [ ] **Step 4: Run test — expect PASS.**

Run: `npx vitest run src/components/admin/BossesTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/admin/BossesTab.tsx src/components/admin/BossesTab.test.tsx
git commit -m "feat(admin): rewardPetDefId dropdown on gated + final boss editors"
```

---

### Task 7: xlsx import — `rewardPetDefId` Bosses column

**Files:**
- Modify: `src/content/excelImport.ts` (Bosses row → `common`)
- Test: `src/content/excelImport.test.ts`

- [ ] **Step 1: Add a failing test** — APPEND to `src/content/excelImport.test.ts`. Add a `rewardPetDefId` cell to a Bosses row in the test workbook and assert the parsed boss carries it; a blank cell omits it. Mirror the file's existing workbook-building helper.

```ts
it('parses rewardPetDefId from a Bosses row (blank omits it)', async () => {
  const book = makeWorkbook({
    Bosses: [
      { id: 'fb', scope: 'final', reviewsUnits: 'u1', reviewCount: 1, rewardPetDefId: 'leaf-1' },
      { id: 'g1', scope: 'gated', afterUnit: 'u1', reviewsUnits: 'u1', reviewCount: 1 },
    ],
  });
  const { course } = await parseWorkbookToCourse(book);
  expect(course!.finalBoss!.rewardPetDefId).toBe('leaf-1');
  expect(course!.gates[0].rewardPetDefId).toBeUndefined();
});
```
> Use the file's actual parse entrypoint + workbook fixture helper (names may differ — match what the other tests in the file call).

- [ ] **Step 2: Run test — expect FAIL** (`rewardPetDefId` undefined on the parsed boss).

Run: `npx vitest run src/content/excelImport.test.ts`
Expected: FAIL.

- [ ] **Step 3: Read the column** — `src/content/excelImport.ts`, in the `common` object inside the Bosses `forEach` (~200–208), add:

```ts
      ...(str(r.rewardPetDefId) ? { rewardPetDefId: str(r.rewardPetDefId) } : {}),
```

- [ ] **Step 4: Run test — expect PASS.**

Run: `npx vitest run src/content/excelImport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/content/excelImport.ts src/content/excelImport.test.ts
git commit -m "feat(import): read optional rewardPetDefId column from the Bosses sheet"
```

---

### Task 8: Fold-in — `EvolutionScreen` custom sprite on real evolution

**Files:**
- Modify: `src/components/EvolutionScreen.tsx`
- Test: `src/components/EvolutionScreen.test.tsx`

- [ ] **Step 1: Add a failing test** — APPEND to `src/components/EvolutionScreen.test.tsx`: mock `EvolutionCinematic` to expose the `def` prop and assert `EvolutionScreen` passes the active pet's resolved def (not `undefined`).

```tsx
vi.mock('./EvolutionCinematic', () => ({
  EvolutionCinematic: ({ def }: { def?: { id: string } }) => <div data-testid="def">{def?.id ?? 'none'}</div>,
}));

it('passes the active pet resolved def to the cinematic', () => {
  // seed an active pet with a known defId + a lastStageChange, then:
  render(<EvolutionScreen />);
  expect(screen.getByTestId('def').textContent).not.toBe('none');
});
```
> Reuse the file's existing setup for seeding the active pet + `lastStageChange`.

- [ ] **Step 2: Run test — expect FAIL** (`def` is `none`).

Run: `npx vitest run src/components/EvolutionScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Thread the def** — `src/components/EvolutionScreen.tsx`. Import `resolvePetDef` + `usePetDefs`, resolve, pass it:

```tsx
import { resolvePetDef } from '../domain/petDef';
import { usePetDefs } from '../state/usePetDefs';
// inside the component:
  const defs = usePetDefs();
// in the JSX:
    <EvolutionCinematic
      from={change.from}
      to={change.to}
      species={pet.species}
      def={resolvePetDef(pet.defId, defs)}
      onDone={/* unchanged */}
    />
```

- [ ] **Step 4: Run test — expect PASS.**

Run: `npx vitest run src/components/EvolutionScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/EvolutionScreen.tsx src/components/EvolutionScreen.test.tsx
git commit -m "fix(evolution): show owned pet's custom sprite on real evolution"
```

---

### Task 9: Fold-in — `PetsTab` functional `setDraft`

**Files:**
- Modify: `src/components/admin/PetsTab.tsx` (`patch`)

- [ ] **Step 1: Fix the stale-closure update** — `src/components/admin/PetsTab.tsx`, in `patch` (~92), change the non-functional update to a functional one:

```tsx
    setDraft((prev) => prev.map((d) => (d.id === id ? { ...d, ...p } : d)));
```
> Verify the current body reads `setDraft(draft.map(...))`; replace with the `prev =>` form. If other `setDraft(draft...)` call sites in the file have the same issue, fix them the same way.

- [ ] **Step 2: Run the PetsTab suite — expect PASS** (behavior-preserving; existing tests stay green).

Run: `npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/components/admin/PetsTab.tsx
git commit -m "fix(admin): functional setDraft in PetsTab.patch to avoid dropped writes"
```

---

### Task 10: Hermetic e2e — author reward, clear boss, assert grant + caught

**Files:**
- Create: `e2e/p4c-reward-pets.spec.ts`

- [ ] **Step 1: Confirm the file is new** and read `e2e/p4b-gacha.spec.ts` for the inject pattern (`window.petDefs` + `window.store`).

- [ ] **Step 2: Write the spec** — Create `e2e/p4c-reward-pets.spec.ts`. Inject a catalog with a distinctive reward def via `window.petDefs.set`, inject a course whose boss carries that `rewardPetDefId` via `window.store` (or the content store handle the e2e harness exposes), drive `finishBoss(true)`, then assert: the granted pet's `defId` equals the reward id, the hatch screen renders, and the def shows caught in Collection → Dex.

```ts
import { test, expect } from '@playwright/test';

test('boss clear grants the authored reward pet and marks it caught', async ({ page }) => {
  await page.goto('/');
  // 1. Inject a catalog containing a distinctive reward def (follow p4b-gacha.spec.ts).
  // 2. Inject/patch the active course so a boss node has rewardPetDefId = that def.
  // 3. Set currentBossLessonId for that boss and call store.finishBoss(true).
  // 4. Assert lastHatch/lastPull.defId === reward id; hatch cinematic visible.
  // 5. Continue → navigate to Collection → Dex; assert the reward def shows caught (not silhouette).
});
```
> Fill the body using the concrete handles `p4b-gacha.spec.ts` uses (it already injects catalog + drives the store with no auth/emulators). Keep it hermetic — no Firebase.

- [ ] **Step 3: Run the e2e spec — expect PASS.**

Run: `npx playwright test e2e/p4c-reward-pets.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add e2e/p4c-reward-pets.spec.ts
git commit -m "test(e2e): hermetic P4c reward-pet grant + dex caught"
```

---

### Final: whole-feature verification + handoff

- [ ] **Full verify gate:** `npm test` (unit), `npx tsc -b`, `npm run build`, `npx playwright test e2e/p4c-reward-pets.spec.ts`. All green (re-run on the Windows worker-fork flake).
- [ ] **Manual smoke** (admin/live touched): emulators (`npm run emulators`, storage :9199), `npm run dev:admin` seed, `/#admin` 🔑 Dev admin → author a boss `rewardPetDefId` → clear the boss → confirm exact pet granted, hatch plays, marked caught in Collection → Dex.
- [ ] **Whole-feature review** (requesting-code-review), then update the memory note `[[sentence-pet-generational-dex-p4b-gacha]]` line / add a P4c memory and write a P4d handoff if continuing.

## Self-review notes
- **Spec coverage:** data model (T1), grant + fallback + band stats + grant-once via firstClear (T3), DRY pool helper (T2), hatch reveal + sequencing (T4), validation cross-ref + wiring (T5), admin dropdown (T6), xlsx column — confirmed in-scope, Bosses sheet IS parsed (T7), all 3 fold-ins (T2 #2, T8, T9), tests + e2e (each task + T10). Out-of-scope items untouched.
- **Type consistency:** `lastHatch: PetInstance | null`, `clearHatch`, `obtainablePool(defs?)`, `validateCourse(course, opts?)`, `rewardPetDefId?: string`, `Screen` adds `'rewardHatch'` — names used identically across tasks.
- **Grant-once:** unchanged `firstClear` gate; no PERSIST_VERSION bump (no persisted granted-set).

# Pet Rarity Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin force a fixed rarity per `PetDef` so every spawn (gacha, boss-reward, starter) of that creature uses it, while rarity stays an instance trait preserved through evolution.

**Architecture:** Add one optional `rarity?: Rarity` field to `PetDef`. At each spawn site, resolve `def.rarity ?? <current default>` and roll stats from that rarity's band. `evolvePetDef` is untouched (already preserves instance rarity). Admin gets one `Select` in the PetForm Identity card.

**Tech Stack:** TypeScript, Zustand, Vitest + Testing Library, React + Tailwind (admin Neutral-SaaS UI kit).

**Spec:** `docs/superpowers/specs/2026-06-29-pet-rarity-override-design.md`

**Tooling / hazards (carry-forward):**
- Use the **Bash** tool with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` for every git/test/build command — the PowerShell tool's cwd resolves to the wrong project.
- Verify gate: `npx vitest run`, `npx tsc -b` (NOT `--noEmit`), `npx vite build`. Windows "Worker exited unexpectedly" vitest flake → re-run.
- Stage **explicit files**; never `git add -A`. **Append** to `*.test.*` files; never overwrite existing tests.

**Base branch:** create `pet-rarity-override`. Default base is `main` (the feature is independent of the in-flight `dex-stage-display` branch). If the dev server should keep showing the dex work alongside this during live testing, branch off `dex-stage-display` instead and merge dex first. The controller confirms the base at execution.

---

### Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the working branch**

Run (default base `main`; substitute `dex-stage-display` if the controller chose to stack):
```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git checkout main && git checkout -b pet-rarity-override
```
Expected: `Switched to a new branch 'pet-rarity-override'`.

- [ ] **Step 2: Confirm a clean baseline**

Run:
```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/domain/gacha.test.ts src/state/gameStore.test.ts
```
Expected: all PASS (baseline green before changes).

---

### Task 1: `PetDef.rarity` field + gacha override

Add the optional field and make the gacha honor it.

**Files:**
- Modify: `src/data/types.ts` (PetDef interface)
- Modify: `src/domain/gacha.ts`
- Test: `src/domain/gacha.test.ts` (append)

- [ ] **Step 1: Add the field to `PetDef`**

In `src/data/types.ts`, inside the `PetDef` interface (after the `gachaObtainable?` field, before the `sprite?` block), add:
```ts
  /** Admin rarity override. Absent → roll (gacha) / common (reward + starter).
   *  When set, every spawn of this def is forced to this rarity and stats roll
   *  from `statBands[rarity]`. Rarity remains an instance trait (preserved on evolve). */
  rarity?: Rarity;
```
`Rarity` is already declared in this file — no new import.

- [ ] **Step 2: Write the failing test (append to `src/domain/gacha.test.ts`)**

Append inside the existing `describe('pullEgg', ...)` block (before its closing `});`), or as a new `describe` at end of file — either is append-only:
```ts
  it('forces rarity from def.rarity, ignoring the rolled rarity, and rolls stats from that band', () => {
    const forced: PetDef = {
      id: 'forced-leg', name: 'Forced', gen: 1, dexNo: 5, types: ['fire'], element: 'fire',
      statBands: { common: mkBands([10, 20]), rare: mkBands([55, 75]), epic: mkBands([72, 88]), legendary: mkBands([85, 90]) },
      enabled: true, rarity: 'legendary',
    };
    // rng[0]=0 would roll COMMON; [1]=0 picks index 0; [2..6] mid-band stats.
    const res = pullEgg({ coins: 200 }, args(seq([0, 0, 0.5, 0.5, 0.5, 0.5, 0.5]), [forced]));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.pet.rarity).toBe('legendary'); // forced override wins over the rolled common
    for (const v of Object.values(res.pet.stats)) {
      expect(v).toBeGreaterThanOrEqual(85); // legendary band, NOT common 10-20
      expect(v).toBeLessThanOrEqual(90);
    }
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/domain/gacha.test.ts -t "forces rarity"`
Expected: FAIL — current code uses the rolled common rarity, so `pet.rarity` is `'common'` and stats are 10-20.

- [ ] **Step 4: Implement the override in `src/domain/gacha.ts`**

Replace the body of `pullEgg` after the coins check (the four lines computing rarity/def/stats/pet) with:
```ts
  const rolledRarity = rollRarity(args.rng, args.table);
  const def = args.defs[Math.floor(args.rng() * args.defs.length)];
  const rarity = def.rarity ?? rolledRarity; // forced def wins; rolled value discarded
  const stats = rollStatsFromBands(def.statBands[rarity], args.rng);
  const pet = makePet({ id: args.id, defId: def.id, species: def.element, stats, rarity, hatched: true });
  return { ok: true, coins: state.coins - args.price, pet };
```
RNG consumption order is unchanged (`[0] rarity, [1] pool-pick, [2..6] stats`), so the existing tests stay green; only the rarity *value* is overridden for forced defs.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/domain/gacha.test.ts`
Expected: PASS — the new test plus all 6 pre-existing `pullEgg` tests.

- [ ] **Step 6: Typecheck**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/data/types.ts src/domain/gacha.ts src/domain/gacha.test.ts && git commit -m "feat(pets): add PetDef.rarity override, honored by gacha"
```

---

### Task 2: Starter spawn honors the override

**Files:**
- Modify: `src/state/gameStore.ts` (`freshPet`, ~line 187)
- Test: `src/state/gameStore.test.ts` (append)

- [ ] **Step 1: Write the failing test (append to `src/state/gameStore.test.ts`)**

Append a new describe at the end of the file (the imports `setActivePetDefs`, `BUILTIN_PET_DEFS`, `STARTER_ID` already exist at the top):
```ts
describe('starter rarity override', () => {
  afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS)); // restore registry

  it('starter pet adopts the starter def rarity override', () => {
    // Override the leaf starter (BUILTIN_PET_DEFS[0]) to epic.
    setActivePetDefs([{ ...BUILTIN_PET_DEFS[0], rarity: 'epic' }, ...BUILTIN_PET_DEFS.slice(1)]);
    useGameStore.getState().resetForTest(); // rebuilds the starter via freshPet()
    const starter = useGameStore.getState().pets.find((p) => p.id === STARTER_ID)!;
    expect(starter.rarity).toBe('epic');
  });

  it('starter stays common when the starter def has no override', () => {
    setActivePetDefs(BUILTIN_PET_DEFS);
    useGameStore.getState().resetForTest();
    const starter = useGameStore.getState().pets.find((p) => p.id === STARTER_ID)!;
    expect(starter.rarity).toBe('common');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/state/gameStore.test.ts -t "starter rarity override"`
Expected: FAIL on the first test — `freshPet` hardcodes `rarity: 'common'`, so the override is ignored.

- [ ] **Step 3: Implement in `src/state/gameStore.ts`**

Replace the `freshPet` function (currently a one-line `makePet({ id: STARTER_ID, defId: starterDef().id, species: 'leaf', stats: rollStats(rng), rarity: 'common', hatched: false })`) with:
```ts
function freshPet(): PetInstance {
  const sdef = starterDef();
  const rarity = sdef.rarity ?? 'common';
  const stats = sdef.rarity ? rollStatsFromBands(sdef.statBands[rarity], rng) : rollStats(rng);
  return makePet({ id: STARTER_ID, defId: sdef.id, species: 'leaf', stats, rarity, hatched: false });
}
```
`rollStatsFromBands` is already imported in this file (used by the gacha/reward paths). When the starter def has no override, behavior is byte-for-byte today's (`rollStats` + `'common'`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/state/gameStore.test.ts -t "starter rarity override"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/state/gameStore.ts src/state/gameStore.test.ts && git commit -m "feat(pets): starter spawn honors def rarity override"
```

---

### Task 3: Boss-reward spawn honors the override

**Files:**
- Modify: `src/state/gameStore.ts` (`finishBoss` reward grant, ~line 309)
- Test: `src/state/gameStore.test.ts` (append)

- [ ] **Step 1: Write the failing test (append to `src/state/gameStore.test.ts`)**

Append a new describe at the end of the file. It includes its own self-contained `seedBossLesson` (do not rely on the helper scoped inside the P4c describe):
```ts
describe('finishBoss reward rarity override', () => {
  function seedBossLesson(rewardPetDefId?: string) {
    const bundle: ContentBundle = {
      pool: { ...SEED.pool },
      units: [{
        id: 'rar-unit', title: 'Rarity Unit', emoji: '⚔️', order: 1,
        lessons: [{
          id: 'rar-boss', title: 'Boss', emoji: '⚔️', level: 1, isCheckpoint: true,
          itemIds: ['mx-l1-1', 'mx-l1-2'],
          boss: { tierId: 'tier-1', element: 'fire', name: 'Rival', rivalSprite: { species: 'fire', stage: 'young' } },
          ...(rewardPetDefId ? { rewardPetDefId } : {}),
        }],
      }],
    };
    useContentStore.getState().setBundle(bundle, 'fallback');
    useGameStore.setState({ currentBossLessonId: 'rar-boss' });
  }

  beforeEach(() => useGameStore.getState().resetForTest());
  afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS));

  it('forces the reward pet rarity from the def override', () => {
    setActivePetDefs([{ ...BUILTIN_PET_DEFS[0], id: 'reward-leg', element: 'fire', enabled: true, rarity: 'legendary' }, ...BUILTIN_PET_DEFS]);
    seedBossLesson('reward-leg');
    useGameStore.getState().finishBoss(true);
    const granted = useGameStore.getState().pets.at(-1)!;
    expect(granted.defId).toBe('reward-leg');
    expect(granted.rarity).toBe('legendary'); // was hardcoded 'common'
  });

  it('reward pet stays common when the def has no override', () => {
    setActivePetDefs([{ ...BUILTIN_PET_DEFS[0], id: 'reward-plain', element: 'fire', enabled: true }, ...BUILTIN_PET_DEFS]);
    seedBossLesson('reward-plain');
    useGameStore.getState().finishBoss(true);
    const granted = useGameStore.getState().pets.at(-1)!;
    expect(granted.rarity).toBe('common');
  });
});
```
(`SEED`, `ContentBundle`, `useContentStore`, `setActivePetDefs`, `BUILTIN_PET_DEFS` are all already imported at the top of the test file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/state/gameStore.test.ts -t "finishBoss reward rarity override"`
Expected: FAIL on the first test — the reward grant hardcodes `rarity: 'common'`.

- [ ] **Step 3: Implement in `src/state/gameStore.ts`**

In `finishBoss`, the reward-grant `makePet` block (currently `stats: rollStatsFromBands(def.statBands.common, rng)` and `rarity: 'common'`) becomes — insert the `rarity` line just before `const egg = makePet({` and use it in both places:
```ts
            const rarity = def.rarity ?? 'common';
            const egg = makePet({
              id: crypto.randomUUID(),
              species: def.element,
              defId: def.id,
              stats: rollStatsFromBands(def.statBands[rarity], rng),
              rarity,
            });
```
`def` is already resolved above this block (`resolvePetDef(rewardId)` or the pool pick).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/state/gameStore.test.ts`
Expected: PASS — the two new reward tests plus all pre-existing gameStore tests (the existing P4c reward tests don't set `rarity`, so they still get `'common'`).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/state/gameStore.ts src/state/gameStore.test.ts && git commit -m "feat(pets): boss-reward spawn honors def rarity override"
```

---

### Task 4: Admin PetForm rarity dropdown

**Files:**
- Modify: `src/components/admin/petsTab/PetForm.tsx`
- Test: `src/components/admin/petsTab/PetForm.test.tsx` (create)

- [ ] **Step 1: Write the failing test (create `src/components/admin/petsTab/PetForm.test.tsx`)**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PetForm } from './PetForm';
import { BUILTIN_PET_DEFS } from '../../../domain/petDef';

const baseProps = () => ({
  allDefs: [...BUILTIN_PET_DEFS],
  onPatch: vi.fn(),
  onRename: vi.fn(),
  onSetStarter: vi.fn(),
});

describe('PetForm rarity override', () => {
  it('patches def.rarity when an override is chosen', () => {
    const props = baseProps();
    render(<PetForm def={BUILTIN_PET_DEFS[0]} {...props} />);
    fireEvent.change(screen.getByLabelText('rarity override'), { target: { value: 'epic' } });
    expect(props.onPatch).toHaveBeenCalledWith({ rarity: 'epic' });
  });

  it('clears the override to undefined when Default is chosen', () => {
    const props = baseProps();
    render(<PetForm def={{ ...BUILTIN_PET_DEFS[0], rarity: 'epic' }} {...props} />);
    fireEvent.change(screen.getByLabelText('rarity override'), { target: { value: '' } });
    expect(props.onPatch).toHaveBeenCalledWith({ rarity: undefined });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/petsTab/PetForm.test.tsx`
Expected: FAIL — no control labeled "rarity override" exists yet (`getByLabelText` throws).

- [ ] **Step 3: Implement in `src/components/admin/petsTab/PetForm.tsx`**

3a. Add `Rarity` to the type import on line 1:
```tsx
import type { PetDef, Species, Rarity } from '../../../data/types';
```

3b. In the **Identity** `Card`, insert this `Field` immediately after the `types` `Field` (after its closing `</Field>` on line 36, before the `enabled` `Checkbox`):
```tsx
          <Field label="rarity override">
            <Select
              value={def.rarity ?? ''}
              onChange={(e) => onPatch({ rarity: (e.target.value || undefined) as Rarity | undefined })}
            >
              <option value="">Default (roll)</option>
              {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
```
`RARITIES` and `Select` are already imported in this file (`RARITIES` from `./helpers`, `Select` from `../ui`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/petsTab/PetForm.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the PetsTab suite to confirm no regression**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS (the new Field is additive; existing PetsTab tests don't assert field counts that would break).

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/petsTab/PetForm.tsx src/components/admin/petsTab/PetForm.test.tsx && git commit -m "feat(admin): rarity override dropdown in PetForm"
```

---

### Task 5: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run`
Expected: all suites PASS. (Windows "Worker exited unexpectedly" flake → re-run.)

- [ ] **Step 2: Typecheck**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b`
Expected: exit 0.

- [ ] **Step 3: Production build**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vite build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke note (no commit)**

In the running dev app (emulator mode), sign in to admin (`/#admin` → Dev admin sign-in), open PetsTab, set a creature's **rarity override** to Legendary, save. Then pull that creature from gacha (or grant it as a boss reward) and confirm the pet shows the Legendary ring/badge and high stats. Record the result in the PR description.

---

## Notes for the reviewer

- **No `PERSIST_VERSION` bump** — `rarity` is global content (`content/petDefs`), not persisted save state.
- **Backward compatibility** — the field is optional; unset reproduces today's behavior exactly (gacha rolls by weight; reward + starter = common). The gacha keeps its RNG consumption order, so unforced pulls are unchanged.
- **Evolution unchanged** — `evolvePetDef` already preserves the instance `rarity`; a forced-rarity pet keeps it up the whole chain (the locked decision). No task touches `src/domain/evolution.ts`.
- **Display** — existing `RARITY_BADGE` / `RARITY_RING` (keyed on the instance rarity) already render any forced value; no UI changes beyond the admin dropdown.

# Level-select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players free-pick any authored level for a drill via level chips on each DrillPicker card, replacing the hardcoded `level={1}`.

**Architecture:** A pure `levelsFor(drill)` helper derives available levels from `WORD_BANK`. The store gains a transient `selectedLevel` field and a 2-arg `startDrill(drill, level)`. `DrillPicker` renders one chip per available level; `App` threads `selectedLevel` into `DrillScreen`. No persist version bump — zustand's default shallow-merge defaults `selectedLevel` to `1` for existing saves.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist v2) + Vitest. Use `npx tsc -b` for typecheck (NOT `tsc --noEmit` — it's a no-op here).

---

## File Structure

- `src/data/wordBank.ts` — add `levelsFor(drill)` (pure, sibling to `itemsFor`).
- `src/data/wordBank.test.ts` — add `levelsFor` unit tests.
- `src/state/gameStore.ts` — add `selectedLevel` field; change `startDrill` to 2-arg.
- `src/state/gameStore.test.ts` — update `startDrill` caller; add `selectedLevel` assertions.
- `src/components/DrillPicker.tsx` — card becomes container with a chip row.
- `src/components/DrillPicker.test.tsx` — click a chip (not the title) to start; assert chip labels.
- `src/App.tsx` — read `selectedLevel`, drop `level={1}`.
- `GAME_DESIGN.md` (repo root + H: copy) — §12 "Level-select (shipped)" note.

**Pre-flight:** Confirm on branch `level-select` (`git branch --show-current`). All work commits here; PR → merge to `main` at the end.

---

### Task 1: `levelsFor` helper

**Files:**
- Modify: `src/data/wordBank.ts` (add export after `itemsFor`, ~line 49)
- Test: `src/data/wordBank.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the `describe('WORD_BANK', ...)` block in `src/data/wordBank.test.ts`. Update the import on line 2 to include `levelsFor`:

```ts
import { WORD_BANK, itemsFor, trayWords, levelsFor } from './wordBank';
```

```ts
  it('levelsFor returns sorted unique authored levels per drill', () => {
    expect(levelsFor('pattern')).toEqual([1, 2]);
    expect(levelsFor('grammar')).toEqual([1, 2]);
    expect(levelsFor('wordChoice')).toEqual([1]);
    expect(levelsFor('mixed')).toEqual([1]);
  });

  it('levelsFor returns [] for a drill with no items', () => {
    expect(levelsFor('nonexistent' as never)).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/data/wordBank.test.ts`
Expected: FAIL — `levelsFor is not a function` (or import error).

- [ ] **Step 3: Write minimal implementation**

In `src/data/wordBank.ts`, add after the `itemsFor` function (after line 49):

```ts
/** Sorted, unique, ascending list of authored levels for a drill (empty if none). */
export function levelsFor(drill: DrillType): number[] {
  return [...new Set(WORD_BANK.filter((i) => i.drill === drill).map((i) => i.level))]
    .sort((a, b) => a - b);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/data/wordBank.test.ts`
Expected: PASS (all wordBank tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/wordBank.ts src/data/wordBank.test.ts
git commit -m "feat: add levelsFor(drill) deriving authored levels from WORD_BANK"
```

---

### Task 2: Store — `selectedLevel` + 2-arg `startDrill`

**Files:**
- Modify: `src/state/gameStore.ts` (interface ~line 36-41, initial state ~line 75, `startDrill` line 83, `resetForTest` ~line 115-122)
- Test: `src/state/gameStore.test.ts` (existing `startDrill` test line 25-31)

- [ ] **Step 1: Update the failing test**

Replace the existing `startDrill` test in `src/state/gameStore.test.ts` (lines 25-31) with:

```ts
  it('startDrill selects the drill, sets the level, and opens the drill screen', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().startDrill('grammar', 2);
    const s = useGameStore.getState();
    expect(s.selectedDrill).toBe('grammar');
    expect(s.selectedLevel).toBe(2);
    expect(s.screen).toBe('drill');
  });

  it('resetForTest restores selectedLevel to 1', () => {
    useGameStore.getState().startDrill('grammar', 2);
    useGameStore.getState().resetForTest();
    expect(useGameStore.getState().selectedLevel).toBe(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: FAIL — `startDrill` expects 1 arg / `selectedLevel` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `src/state/gameStore.ts`:

a) Add to the `GameState` interface (after `selectedDrill: DrillType;`, line ~36):

```ts
  selectedLevel: number;
```

b) Change the `startDrill` signature in the interface (line ~41):

```ts
  startDrill: (drill: DrillType, level: number) => void;
```

c) Add to the initial state object (after `selectedDrill: 'pattern',`, line ~75):

```ts
      selectedLevel: 1,
```

d) Replace the `startDrill` action (line 83):

```ts
      startDrill: (drill, level) => set({ selectedDrill: drill, selectedLevel: level, screen: 'drill' }),
```

e) Add `selectedLevel: 1,` to the `resetForTest` set object (after `selectedDrill: 'pattern',`, line ~120).

Do NOT touch `version` (stays `2`) or `migrate`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat: add selectedLevel to store and 2-arg startDrill(drill, level)"
```

---

### Task 3: DrillPicker — level chips

**Files:**
- Modify: `src/components/DrillPicker.tsx`
- Test: `src/components/DrillPicker.test.tsx`

- [ ] **Step 1: Update the failing test**

Replace the body of `src/components/DrillPicker.test.tsx` `describe` block with these tests (keeps the existing first test, updates the start test, adds a chip-label test, keeps Back):

```tsx
  it('shows a card for each drill', () => {
    render(<DrillPicker />);
    expect(screen.getByText('Pattern')).toBeInTheDocument();
    expect(screen.getByText('Word Choice')).toBeInTheDocument();
    expect(screen.getByText('Grammar')).toBeInTheDocument();
    expect(screen.getByText('Mixed')).toBeInTheDocument();
  });

  it('shows a level chip per authored level (pattern has L1 and L2)', () => {
    render(<DrillPicker />);
    expect(screen.getAllByRole('button', { name: 'L1' }).length).toBe(4); // all 4 drills have L1
    expect(screen.getAllByRole('button', { name: 'L2' }).length).toBe(2); // pattern + grammar
  });

  it('tapping a level chip starts that drill at that level', async () => {
    render(<DrillPicker />);
    // The Grammar card's L2 chip — find within the Grammar card.
    const grammarCard = screen.getByText('Grammar').closest('div')!;
    const { getByRole } = within(grammarCard);
    await userEvent.click(getByRole('button', { name: 'L2' }));
    const s = useGameStore.getState();
    expect(s.selectedDrill).toBe('grammar');
    expect(s.selectedLevel).toBe(2);
    expect(s.screen).toBe('drill');
  });

  it('Back returns to the pet room', async () => {
    useGameStore.getState().hatch();
    useGameStore.getState().setScreen('pickDrill');
    render(<DrillPicker />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
```

Update the import on line 1 to add `within`:

```tsx
import { render, screen, within } from '@testing-library/react';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/DrillPicker.test.tsx`
Expected: FAIL — no `L1`/`L2` buttons; chips not rendered yet.

- [ ] **Step 3: Write minimal implementation**

Replace `src/components/DrillPicker.tsx` with:

```tsx
import { useGameStore } from '../state/gameStore';
import { DRILL_FOOD, FOOD_META } from '../data/food';
import { levelsFor } from '../data/wordBank';
import type { DrillType } from '../data/types';

const DRILLS: { drill: DrillType; title: string }[] = [
  { drill: 'pattern', title: 'Pattern' },
  { drill: 'wordChoice', title: 'Word Choice' },
  { drill: 'grammar', title: 'Grammar' },
  { drill: 'mixed', title: 'Mixed' },
];

export function DrillPicker() {
  const startDrill = useGameStore((s) => s.startDrill);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="flex h-full flex-col bg-indigo-50 p-6">
      <div className="flex items-center justify-between pb-4">
        <button
          onClick={() => setScreen('petRoom')}
          className="min-h-12 rounded-xl px-4 py-2 font-semibold text-indigo-700"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-indigo-800">Pick a drill</h1>
        <span className="w-16" />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-4">
        {DRILLS.map(({ drill, title }) => {
          const meta = FOOD_META[DRILL_FOOD[drill]];
          const levels = levelsFor(drill);
          return (
            <div
              key={drill}
              className="flex items-center gap-4 rounded-2xl bg-white p-6 text-left shadow"
            >
              <span className="text-4xl">{meta.emoji}</span>
              <span className="flex-1">
                <span className="block text-lg font-semibold text-slate-800">{title}</span>
                <span className="text-sm text-slate-500">Earns {meta.label}</span>
              </span>
              <span className="flex flex-wrap justify-end gap-2">
                {levels.map((level) => (
                  <button
                    key={level}
                    onClick={() => startDrill(drill, level)}
                    className="min-h-11 min-w-11 rounded-xl bg-indigo-100 px-3 font-semibold text-indigo-700"
                  >
                    L{level}
                  </button>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/DrillPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DrillPicker.tsx src/components/DrillPicker.test.tsx
git commit -m "feat: render level chips per drill card, start at chosen level"
```

---

### Task 4: App — thread `selectedLevel`

**Files:**
- Modify: `src/App.tsx` (line 11 signature, line 15 node, line 22-26 `CurrentScreen`)

- [ ] **Step 1: Implement (covered by full-suite regression in Task 5; App has no isolated unit test)**

In `src/App.tsx`:

a) Change `screenKeyAndNode` signature (line 11) to accept a level:

```tsx
function screenKeyAndNode(screen: string, hatched: boolean, drill: DrillType, level: number) {
```

b) Change the `'drill'` case (line 15):

```tsx
    case 'drill': return { key: 'drill', node: <DrillScreen drill={drill} level={level} /> };
```

c) In `CurrentScreen` (lines 22-26), read `selectedLevel` and pass it:

```tsx
function CurrentScreen() {
  const screen = useGameStore((s) => s.screen);
  const hatched = useGameStore((s) => s.pet.hatched);
  const drill = useGameStore((s) => s.selectedDrill);
  const level = useGameStore((s) => s.selectedLevel);
  const { key, node } = screenKeyAndNode(screen, hatched, drill, level);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: thread selectedLevel into DrillScreen, drop hardcoded level={1}"
```

---

### Task 5: Full verify + docs

**Files:**
- Modify: `GAME_DESIGN.md` (repo root) and `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md` — §12 level matrix.

- [ ] **Step 1: Full green gate**

Run: `npm test -- --run`
Expected: ALL pass (116 prior + new levelsFor/store/picker tests).

Run: `npx tsc -b`
Expected: clean.

Run: `npm run build`
Expected: clean, bundle builds.

If any fail, STOP and fix before docs.

- [ ] **Step 2: Update GAME_DESIGN §12 (both copies, keep in sync)**

Find the §12 level-matrix section (it has "Grammar dial (shipped)" and "Mixed (shipped)" notes). Add a sibling note, identical text in both files:

```
- **Level-select (shipped):** free-pick level chips on each drill card; available levels derived from authored content via `levelsFor(drill)`. No gated unlock yet (deferred — needs persisted per-drill progress + persist bump). App no longer hardcodes level 1.
```

- [ ] **Step 3: Commit docs**

```bash
git add GAME_DESIGN.md
git commit -m "docs: note level-select shipped in §12 level matrix"
```

(Repeat the edit in the H: copy; it's outside the repo, so it is not part of this commit — save it directly.)

- [ ] **Step 4: Finish the branch**

Use superpowers:finishing-a-development-branch — branch → PR → merge-commit to `main` (PR #2/#3 pattern). Confirm `git branch --show-current` is `level-select` before pushing.

---

## Manual verification (post-merge, optional phone-e2e)

- `npm run dev -- --host`, open on phone.
- Pattern card → tap **L2** → S+V+O round (3 slots) loads.
- Grammar card → tap **L2** → enforce round (rejects trap to retry) loads.
- wordChoice / mixed → single **L1** chip → L1 round loads.
- Reward bar fills for the right food group per drill.

## Notes

- `npx tsc -b` is the real typecheck; `tsc --noEmit` is a no-op (root tsconfig `files: []`).
- No persist bump: `version` stays `2`, `migrate` untouched. Old saves lack `selectedLevel`; zustand shallow-merge keeps the initial-state default `1`.
- jsdom can't drive @dnd-kit drag / framer-motion — component tests stay render-only + static text + click handlers (chips are plain buttons, safe to click).

# Grammar Drill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Grammar drill (💊 vitamin food) — S+V subject–verb agreement with a flag→enforce strictness dial — reusing the Word-Choice drag-tile substrate.

**Architecture:** One new pure grader `gradePlacement(placed, item) → {status, passes, flags}` becomes the correctness engine at the live call site (`resolveRound`) for all drills; `isPlacementCorrect` stays untouched as the trap-less special case. Strictness and near-miss "traps" travel as data on each `DrillItem`. Flag-mode levels accept a near-miss (round passes, food drops) while showing a gentle Thai tip and docking one star; enforce-mode levels reject it like any wrong tile.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist) + Vitest. @dnd-kit, framer-motion, canvas-confetti.

**Spec:** `docs/superpowers/specs/2026-06-25-grammar-drill-design.md`

**Working dir:** `D:\ai_projects\AI_design_thinking\sentence-pet` (local disk). Branch `grammar-drill` (already created off `main`). All commands run from the repo root.

**Conventions (carry forward):**
- Pure logic exhaustively unit-tested; component tests are render-only (jsdom can't drive @dnd-kit drags or framer-motion). Never assert animated style values.
- Mock `canvas-confetti` (`vi.mock('canvas-confetti', () => ({ default: vi.fn() }))`) in any test transitively importing `src/effects/celebrate.ts`.
- Windows LF→CRLF git warnings are cosmetic — ignore.
- After any subagent runs `git checkout`/`git show`, verify `git branch --show-current` is `grammar-drill` before committing (detached-HEAD trap).

**Green bar (run before the final commit):**
- `npm test -- --run`
- `npm run build`
- `npx tsc -b`

---

### Task 1: Types + food mapping (union widening, green together)

Widening `DrillType` to include `'grammar'` makes `DRILL_FOOD: Record<DrillType, FoodGroup>` non-exhaustive, so the type change and the food mapping must land in the same commit to keep `tsc` green.

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/food.ts:4-7`
- Test: `src/data/food.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/data/food.test.ts`, extend the first `it` block to assert the grammar mapping:

```ts
  it('maps each drill to its food group', () => {
    expect(DRILL_FOOD.pattern).toBe('protein');
    expect(DRILL_FOOD.wordChoice).toBe('veggie');
    expect(DRILL_FOOD.grammar).toBe('vitamin');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/data/food.test.ts`
Expected: FAIL — `tsc`/vitest error that `grammar` does not exist on `DRILL_FOOD` (or assertion undefined).

- [ ] **Step 3: Widen the types**

In `src/data/types.ts`, change the `DrillType` union and add the grammar fields + `GrammarTrap` interface:

```ts
export type PosLabel = 'Pronoun' | 'Verb' | 'Object';

export type DrillType = 'pattern' | 'wordChoice' | 'grammar';

/** A tempting grammar near-miss tile tied to a gentle tip (Grammar drill). */
export interface GrammarTrap {
  slot: number;   // index into slots[]/answer[] this trap word belongs to
  word: string;   // the near-miss tile (must differ from every answer word)
  tip: string;    // gentle Thai-scaffolded nudge shown on a flagged accept
}

export interface DrillItem {
  id: string;
  drill: DrillType;     // which drill this item belongs to
  level: number;        // 1..5 (MVP uses 1, 2)
  thaiHint: string;     // shown to the kid as meaning scaffold
  slots: PosLabel[];    // POS labels shown above each slot
  answer: string[];     // correct words, in order (same length as slots)
  distractors?: string[]; // extra wrong tiles salted into the tray (Word-Choice)
  traps?: GrammarTrap[];  // near-miss tiles tied to tips (Grammar)
  strictness?: 'flag' | 'enforce'; // Grammar dial; undefined ⇒ exact match (Pattern/WC)
}
```

- [ ] **Step 4: Add the food mapping**

In `src/data/food.ts`, add the grammar entry to `DRILL_FOOD`:

```ts
export const DRILL_FOOD: Record<DrillType, FoodGroup> = {
  pattern: 'protein',
  wordChoice: 'veggie',
  grammar: 'vitamin',
};
```

- [ ] **Step 5: Run test + typecheck to verify pass**

Run: `npm test -- --run src/data/food.test.ts && npx tsc -b`
Expected: PASS, and `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/food.ts src/data/food.test.ts
git commit -m "feat: widen DrillType to grammar; map grammar -> vitamin food"
```

---

### Task 2: `gradePlacement` pure grader

**Files:**
- Create: `src/domain/grade.ts`
- Test: `src/domain/grade.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/domain/grade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { gradePlacement } from './grade';
import type { DrillItem } from '../data/types';

// minimal grammar item: 'he eats', with an agreement trap 'eat' on the verb slot
const flagItem: Pick<DrillItem, 'answer' | 'traps' | 'strictness'> = {
  answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
  strictness: 'flag',
};
const enforceItem = { ...flagItem, strictness: 'enforce' as const };
const patternItem: Pick<DrillItem, 'answer'> = { answer: ['I', 'run'] };

describe('gradePlacement', () => {
  it('exact answer -> ideal, passes, no flags', () => {
    expect(gradePlacement(['he', 'eats'], flagItem)).toEqual({
      status: 'ideal', passes: true, flags: [],
    });
  });

  it('near-miss in flag mode -> flagged, passes, carries the tip', () => {
    expect(gradePlacement(['he', 'eat'], flagItem)).toEqual({
      status: 'flagged', passes: true, flags: ['เขา → he eats 👍'],
    });
  });

  it('near-miss in enforce mode -> flagged, does NOT pass', () => {
    expect(gradePlacement(['he', 'eat'], enforceItem)).toEqual({
      status: 'flagged', passes: false, flags: ['เขา → he eats 👍'],
    });
  });

  it('an unregistered wrong word -> wrong, does not pass', () => {
    expect(gradePlacement(['he', 'table'], flagItem)).toEqual({
      status: 'wrong', passes: false, flags: [],
    });
  });

  it('a null (unfilled) slot -> wrong, does not pass', () => {
    expect(gradePlacement(['he', null], flagItem)).toEqual({
      status: 'wrong', passes: false, flags: [],
    });
  });

  it('wrong takes precedence over a flagged slot', () => {
    const item = {
      answer: ['he', 'eats'],
      traps: [{ slot: 1, word: 'eat', tip: 't' }],
      strictness: 'flag' as const,
    };
    // slot 0 wrong ('she'), slot 1 flagged ('eat') -> overall wrong
    expect(gradePlacement(['she', 'eat'], item).status).toBe('wrong');
    expect(gradePlacement(['she', 'eat'], item).passes).toBe(false);
  });

  it('trap-less item (Pattern/WC) -> only ideal or wrong', () => {
    expect(gradePlacement(['I', 'run'], patternItem).status).toBe('ideal');
    expect(gradePlacement(['run', 'I'], patternItem).status).toBe('wrong');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/grade.test.ts`
Expected: FAIL — `gradePlacement` not defined.

- [ ] **Step 3: Implement the grader**

Create `src/domain/grade.ts`:

```ts
import type { DrillItem } from '../data/types';

export type GradeStatus = 'ideal' | 'flagged' | 'wrong';

export interface Grade {
  status: GradeStatus;
  passes: boolean;   // may the round advance/finish on this placement?
  flags: string[];   // tip strings for flagged near-miss tiles, in slot order
}

type GradeItem = Pick<DrillItem, 'answer' | 'traps' | 'strictness'>;

/**
 * Grades a fully- or partially-placed sentence against an item.
 * - Exact match in every slot -> 'ideal'.
 * - Every off slot is a registered near-miss trap -> 'flagged'
 *   (passes only when strictness !== 'enforce').
 * - Any off slot that is not a trap (including an unfilled null) -> 'wrong'.
 */
export function gradePlacement(placed: (string | null)[], item: GradeItem): Grade {
  const { answer, traps, strictness } = item;
  const flags: string[] = [];
  let wrong = false;

  for (let i = 0; i < answer.length; i++) {
    const word = placed[i];
    if (word === answer[i]) continue;
    const trap = traps?.find((t) => t.slot === i && t.word === word);
    if (trap && word !== null) {
      flags.push(trap.tip);
    } else {
      wrong = true;
    }
  }

  if (wrong) return { status: 'wrong', passes: false, flags: [] };
  if (flags.length > 0) {
    return { status: 'flagged', passes: strictness !== 'enforce', flags };
  }
  return { status: 'ideal', passes: true, flags: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/domain/grade.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/grade.ts src/domain/grade.test.ts
git commit -m "feat: gradePlacement engine (ideal/flagged/wrong, strictness-aware)"
```

---

### Task 3: Equivalence test — `isPlacementCorrect` vs grader

Proves the rewrap-free decision: the legacy exact-match equals the grader's `ideal` on trap-less items. No production code changes.

**Files:**
- Test: `src/domain/check.test.ts` (modify)

- [ ] **Step 1: Add the equivalence test**

Append to `src/domain/check.test.ts`, inside the file (after the existing `shuffle` block):

```ts
import { gradePlacement } from './grade';

describe('isPlacementCorrect equals grader ideal for trap-less items', () => {
  const cases: (string | null)[][] = [
    ['I', 'run'],
    ['run', 'I'],
    ['I', null],
    ['I'],
  ];
  for (const placed of cases) {
    it(`agrees on ${JSON.stringify(placed)}`, () => {
      const legacy = isPlacementCorrect(placed, ['I', 'run']);
      const graded = gradePlacement(placed, { answer: ['I', 'run'] }).status === 'ideal';
      expect(graded).toBe(legacy);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- --run src/domain/check.test.ts`
Expected: PASS (existing + 4 new agree cases).

- [ ] **Step 3: Commit**

```bash
git add src/domain/check.test.ts
git commit -m "test: prove isPlacementCorrect equals grader ideal for trap-less items"
```

---

### Task 4: Grammar word bank items + trap-aware tray

**Files:**
- Modify: `src/data/wordBank.ts:7-35`
- Test: `src/data/wordBank.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these `it` blocks inside the `describe('WORD_BANK', …)` in `src/data/wordBank.test.ts`:

```ts
  it('has 5 grammar items at level 1 (flag) and level 2 (enforce)', () => {
    const l1 = itemsFor('grammar', 1);
    const l2 = itemsFor('grammar', 2);
    expect(l1.length).toBe(5);
    expect(l2.length).toBe(5);
    expect(l1.every((i) => i.strictness === 'flag')).toBe(true);
    expect(l2.every((i) => i.strictness === 'enforce')).toBe(true);
  });

  it('every grammar item has at least one trap', () => {
    for (const item of itemsFor('grammar', 1).concat(itemsFor('grammar', 2))) {
      expect(item.traps?.length).toBeGreaterThan(0);
    }
  });

  it('trayWords includes trap words after answer + distractors', () => {
    const item = itemsFor('grammar', 1)[0];
    const expected = [...item.answer, ...(item.traps ?? []).map((t) => t.word)];
    expect(trayWords(item)).toEqual(expected);
  });

  it('no item has a trap word that duplicates one of its answer words', () => {
    for (const item of WORD_BANK) {
      for (const t of item.traps ?? []) {
        expect(item.answer).not.toContain(t.word);
      }
    }
  });

  it('every trap slot index is within the item answer range', () => {
    for (const item of WORD_BANK) {
      for (const t of item.traps ?? []) {
        expect(t.slot).toBeGreaterThanOrEqual(0);
        expect(t.slot).toBeLessThan(item.answer.length);
      }
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/data/wordBank.test.ts`
Expected: FAIL — no grammar items (length 0); `trayWords` ignores traps.

- [ ] **Step 3: Add grammar items to the bank**

In `src/data/wordBank.ts`, append these items inside `WORD_BANK` (after the Word-Choice items, before the closing `]`):

```ts
  // Grammar · Level 1: S+V subject–verb agreement, FLAG mode (accept near-miss + tip)
  { id: 'gr-l1-1', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'], traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }] },
  { id: 'gr-l1-2', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'เธอเดิน', slots: ['Pronoun', 'Verb'], answer: ['she', 'walks'], traps: [{ slot: 1, word: 'walk', tip: 'เธอ → she walks 👍' }] },
  { id: 'gr-l1-3', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'แมววิ่ง', slots: ['Pronoun', 'Verb'], answer: ['it', 'runs'], traps: [{ slot: 1, word: 'run', tip: 'it → it runs 👍' }] },
  { id: 'gr-l1-4', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'เขานอน', slots: ['Pronoun', 'Verb'], answer: ['he', 'sleeps'], traps: [{ slot: 1, word: 'sleep', tip: 'เขา → he sleeps 👍' }] },
  { id: 'gr-l1-5', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'เธอเล่น', slots: ['Pronoun', 'Verb'], answer: ['she', 'plays'], traps: [{ slot: 1, word: 'play', tip: 'เธอ → she plays 👍' }] },
  // Grammar · Level 2: same agreement frames, ENFORCE mode (near-miss rejected -> retry)
  { id: 'gr-l2-1', drill: 'grammar', level: 2, strictness: 'enforce', thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'], traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }] },
  { id: 'gr-l2-2', drill: 'grammar', level: 2, strictness: 'enforce', thaiHint: 'เธอเดิน', slots: ['Pronoun', 'Verb'], answer: ['she', 'walks'], traps: [{ slot: 1, word: 'walk', tip: 'เธอ → she walks 👍' }] },
  { id: 'gr-l2-3', drill: 'grammar', level: 2, strictness: 'enforce', thaiHint: 'แมววิ่ง', slots: ['Pronoun', 'Verb'], answer: ['it', 'runs'], traps: [{ slot: 1, word: 'run', tip: 'it → it runs 👍' }] },
  { id: 'gr-l2-4', drill: 'grammar', level: 2, strictness: 'enforce', thaiHint: 'เขานอน', slots: ['Pronoun', 'Verb'], answer: ['he', 'sleeps'], traps: [{ slot: 1, word: 'sleep', tip: 'เขา → he sleeps 👍' }] },
  { id: 'gr-l2-5', drill: 'grammar', level: 2, strictness: 'enforce', thaiHint: 'เธอเล่น', slots: ['Pronoun', 'Verb'], answer: ['she', 'plays'], traps: [{ slot: 1, word: 'play', tip: 'เธอ → she plays 👍' }] },
```

- [ ] **Step 4: Update `trayWords` to include trap words**

In `src/data/wordBank.ts`, replace the `trayWords` function:

```ts
/** Tiles for an item's tray: answer words, then distractors, then trap words. */
export function trayWords(item: DrillItem): string[] {
  return [
    ...item.answer,
    ...(item.distractors ?? []),
    ...(item.traps ?? []).map((t) => t.word),
  ];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run src/data/wordBank.test.ts`
Expected: PASS (existing + 5 new).

- [ ] **Step 6: Commit**

```bash
git add src/data/wordBank.ts src/data/wordBank.test.ts
git commit -m "feat: grammar L1 (flag) + L2 (enforce) agreement items; trap-aware tray"
```

---

### Task 5: `resolveRound` flagged-accept path

`resolveRound` switches from `isPlacementCorrect(filled, answer)` to `gradePlacement(filled, item)`, gains a flagged-accept branch (advance/finish while carrying tips), and now takes the item (for traps/strictness) instead of a bare answer array.

**Files:**
- Modify: `src/domain/round.ts`
- Test: `src/domain/round.test.ts`

- [ ] **Step 1: Rewrite the tests for the new signature + flag behaviour**

Replace the whole body of `src/domain/round.test.ts` with:

```ts
// src/domain/round.test.ts
import { describe, expect, it } from 'vitest';
import { resolveRound } from './round';
import type { DrillItem } from '../data/types';

const pattern: Pick<DrillItem, 'answer'> = { answer: ['I', 'run'] };
const flag: Pick<DrillItem, 'answer' | 'traps' | 'strictness'> = {
  answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
  strictness: 'flag',
};
const enforce = { ...flag, strictness: 'enforce' as const };

describe('resolveRound', () => {
  it('wrong placement -> retry', () => {
    const action = resolveRound({ item: pattern, filled: ['run', 'I'], index: 0, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'retry' });
  });

  it('correct but not last item -> advance, no flags', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 2, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'advance', nextIndex: 3, flags: [] });
  });

  it('correct and last item with no mistakes -> finish with 3 stars', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 4, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'finish', stars: 3, flags: [] });
  });

  it('flag mode near-miss not last -> advance and carries the tip', () => {
    const action = resolveRound({ item: flag, filled: ['he', 'eat'], index: 1, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'advance', nextIndex: 2, flags: ['เขา → he eats 👍'] });
  });

  it('flag mode near-miss counts as one slip toward stars on the last item', () => {
    const action = resolveRound({ item: flag, filled: ['he', 'eat'], index: 4, total: 5, mistakes: 0 });
    expect(action.type).toBe('finish');
    if (action.type === 'finish') {
      expect(action.stars).toBe(2); // one slip (the flag) -> 2 stars
      expect(action.flags).toEqual(['เขา → he eats 👍']);
    }
  });

  it('enforce mode near-miss -> retry (no pass, no food)', () => {
    const action = resolveRound({ item: enforce, filled: ['he', 'eat'], index: 0, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'retry' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/domain/round.test.ts`
Expected: FAIL — `resolveRound` still expects `answer`, returns no `flags`, has no flag branch.

- [ ] **Step 3: Rewrite `resolveRound`**

Replace `src/domain/round.ts` with:

```ts
// src/domain/round.ts
import type { DrillItem } from '../data/types';
import { gradePlacement } from './grade';
import { computeStars } from './scoring';

export type RoundAction =
  | { type: 'finish'; stars: number; flags: string[] }
  | { type: 'advance'; nextIndex: number; flags: string[] }
  | { type: 'retry' };

/** Pure decision for what happens after a sentence is fully placed. */
export function resolveRound(params: {
  item: Pick<DrillItem, 'answer' | 'traps' | 'strictness'>;
  filled: (string | null)[];
  index: number;
  total: number;
  mistakes: number;
}): RoundAction {
  const { item, filled, index, total, mistakes } = params;
  const grade = gradePlacement(filled, item);
  if (!grade.passes) return { type: 'retry' };

  // A flag-mode near-miss accept counts as one slip toward stars.
  const slips = mistakes + (grade.status === 'flagged' ? 1 : 0);
  if (index === total - 1) {
    return { type: 'finish', stars: computeStars({ hints: 0, mistakes: slips }), flags: grade.flags };
  }
  return { type: 'advance', nextIndex: index + 1, flags: grade.flags };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/domain/round.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/round.ts src/domain/round.test.ts
git commit -m "feat: resolveRound uses grader; flag-mode near-miss accepts + docks a star"
```

---

### Task 6: `useRoundFeedback` flag state

Adds a `'flag'` feedback kind: a soft accept — the success confetti still fires (the round passed), held briefly, no buzz. The tip text is rendered by `DrillScreen` (Task 7), not by this hook.

**Files:**
- Modify: `src/components/useRoundFeedback.ts`
- Test: `src/components/useRoundFeedback.test.ts`

- [ ] **Step 1: Write the failing test**

Add this `it` block inside `describe('useRoundFeedback', …)` in `src/components/useRoundFeedback.test.ts`:

```ts
  it('flag: fires confetti (soft accept), does not buzz, clears after hold', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useRoundFeedback());

    act(() => result.current.play('flag', onDone));
    expect(result.current.feedback).toBe('flag');
    expect(result.current.locked).toBe(true);
    expect(fireConfetti).toHaveBeenCalledTimes(1);
    expect(buzz).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.feedback).toBeNull();
    expect(result.current.locked).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/useRoundFeedback.test.ts`
Expected: FAIL — `'flag'` not an accepted `play` kind / `HOLD_MS.flag` undefined.

- [ ] **Step 3: Add the flag kind**

In `src/components/useRoundFeedback.ts`, update the `Feedback` type, the hold map, and `play`:

```ts
export type Feedback = 'correct' | 'wrong' | 'flag' | null;

const HOLD_MS = { correct: 1100, wrong: 700, flag: 1400 } as const;
```

```ts
  function play(kind: 'correct' | 'wrong' | 'flag', onDone: () => void) {
    clear();
    setFeedback(kind);
    if (kind === 'wrong') buzz();
    else fireConfetti(); // 'correct' and 'flag' are both accepts
    timer.current = setTimeout(() => {
      timer.current = null;
      setFeedback(null);
      onDone();
    }, HOLD_MS[kind]);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/useRoundFeedback.test.ts`
Expected: PASS (existing 3 + new flag test).

- [ ] **Step 5: Commit**

```bash
git add src/components/useRoundFeedback.ts src/components/useRoundFeedback.test.ts
git commit -m "feat: useRoundFeedback flag state (soft accept, longer hold)"
```

---

### Task 7: Wire DrillScreen flag feedback + star dock + DrillPicker card

**Files:**
- Modify: `src/components/DrillScreen.tsx`
- Modify: `src/components/DrillPicker.tsx:5-8`
- Test: `src/components/DrillScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add these `it` blocks inside `describe('DrillScreen', …)` in `src/components/DrillScreen.test.tsx`:

```ts
  it('grammar tray includes the agreement trap tile', () => {
    render(<DrillScreen drill="grammar" level={1} />);
    // first grammar L1 item: answer ['he','eats'] + trap 'eat'
    expect(screen.getByRole('button', { name: 'eat' })).toBeInTheDocument();
  });

  it('mounts for grammar without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <DrillScreen drill="grammar" level={1} />
        </DndContext>,
      ),
    ).not.toThrow();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/components/DrillScreen.test.tsx`
Expected: FAIL — no `eat` tile until DrillScreen renders grammar trays (it already does via `trayWords`, but the test will surface any wiring regression introduced below); run after Step 3/4 if it passes early.

- [ ] **Step 3: Branch the feedback + dock the star in DrillScreen**

In `src/components/DrillScreen.tsx`, replace `evaluate` and `applyAction`, and add a tip toast. First, `evaluate` passes the item and chooses the feedback kind from the action's flags:

```ts
  function evaluate(filled: (string | null)[]) {
    const action = resolveRound({
      item,
      filled,
      index,
      total: items.length,
      mistakes,
    });
    const kind =
      action.type === 'retry' ? 'wrong' : (action.flags?.length ? 'flag' : 'correct');
    if (kind === 'flag') setTip(action.type === 'retry' ? null : action.flags!.join(' · '));
    play(kind, () => applyAction(action));
  }
```

```ts
  function applyAction(action: RoundAction) {
    switch (action.type) {
      case 'finish':
        finishRound({ drill, level, stars: action.stars, correctCount: items.length });
        break;
      case 'advance':
        if (action.flags.length) setMistakes((m) => m + 1); // flag = one slip
        setTip(null);
        setIndex(action.nextIndex);
        loadItem(action.nextIndex);
        break;
      case 'retry':
        setMistakes((m) => m + 1);
        loadItem(index);
        break;
    }
  }
```

Add the `tip` state near the other `useState` hooks (after `const [mistakes, setMistakes] = useState(0);`):

```ts
  const [tip, setTip] = useState<string | null>(null);
```

Render the tip toast inside the centre feedback zone — add it just after the existing `{feedback && ( … )}` block, still inside the same `<div className={…flex flex-1…}>`:

```tsx
          {feedback === 'flag' && tip && (
            <div className="pointer-events-none absolute bottom-2 rounded-xl bg-sky-100 px-4 py-2 text-center text-sm font-semibold text-sky-800 shadow">
              {tip}
            </div>
          )}
```

- [ ] **Step 4: Add the grammar card to DrillPicker**

In `src/components/DrillPicker.tsx`, add the grammar entry to the `DRILLS` array:

```ts
const DRILLS: { drill: DrillType; title: string }[] = [
  { drill: 'pattern', title: 'Pattern' },
  { drill: 'wordChoice', title: 'Word Choice' },
  { drill: 'grammar', title: 'Grammar' },
];
```

- [ ] **Step 5: Run tests + typecheck to verify pass**

Run: `npm test -- --run src/components/DrillScreen.test.tsx src/components/DrillPicker.test.tsx && npx tsc -b`
Expected: PASS, `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/DrillScreen.tsx src/components/DrillPicker.tsx src/components/DrillScreen.test.tsx
git commit -m "feat: DrillScreen flag tip + star dock; DrillPicker grammar card"
```

---

### Task 8: Sync GAME_DESIGN.md + full green verification

**Files:**
- Modify: `GAME_DESIGN.md` (repo root)
- Modify: `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md` (Drive copy — keep identical)

- [ ] **Step 1: Note the realised strictness dial**

In `GAME_DESIGN.md` §12, under the level matrix, append a short note after the matrix table:

```markdown
> **Grammar dial (shipped):** realised as a per-item `strictness: 'flag' | 'enforce'`. L1 = flag (near-miss subject–verb agreement is accepted: food drops + gentle Thai tip + one-star dock); L2 = enforce (near-miss rejected → retry). Engine: `src/domain/grade.ts` `gradePlacement`. In-app only L1 is reachable until level-select lands; L2 is authored + unit-tested.
```

- [ ] **Step 2: Sync the Drive copy**

Copy the same edit into `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md` so both copies stay identical.

- [ ] **Step 3: Full green bar**

Run, in order:

```bash
npm test -- --run
npm run build
npx tsc -b
```

Expected: all tests pass (90 prior + the new grammar tests), build clean, `tsc` clean. If any fail, fix before committing.

- [ ] **Step 4: Commit**

```bash
git add GAME_DESIGN.md
git commit -m "docs: note shipped grammar strictness dial (flag/enforce) in GAME_DESIGN"
```

- [ ] **Step 5: Verify branch state**

Run: `git branch --show-current && git log --oneline -8`
Expected: on `grammar-drill`, 8 task commits + the spec commit visible. Hand back to the main thread for the finishing-a-development-branch step (merge to `main`).

---

## Self-Review (completed during planning)

- **Spec coverage:** §3 module map → Tasks 1–8. §4 grader contract → Task 2 (truth table 1:1). §5 data → Task 4. §6 round + UI → Tasks 5–7. §7 persistence (no change) → confirmed: no store task needed. §8 free items → confirmed free except DrillPicker card (Task 7) and L1-only in-app (documented). §9 testing → each module's test task. §10 docs sync → Task 8.
- **Placeholder scan:** none — every code step shows full code.
- **Type consistency:** `Grade`/`GradeStatus`/`gradePlacement` (Task 2) reused verbatim in Tasks 3 & 5. `RoundAction` gains `flags: string[]` (non-optional on advance/finish) in Task 5 and is read as `action.flags` in Task 7. `GrammarTrap` fields (`slot`/`word`/`tip`) consistent across Tasks 1, 2, 4. `play` kind `'flag'` consistent across Tasks 6 & 7.
- **Known intentional gap:** L2 enforce is data + unit-tested but not in-app-reachable (App.tsx `level={1}`), matching Word-Choice's L1-only precedent. Documented in spec §8 and Task 8 note.

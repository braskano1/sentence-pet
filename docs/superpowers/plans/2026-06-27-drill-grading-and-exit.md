# Drill grading + exit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make near-miss grammar (e.g. "She run" for "She runs") reject with a teaching tip instead of being accepted, remove the `flag`/`strictness` mechanic, give Unit 2 grammar harder content, and add a confirm-gated exit to the drill.

**Architecture:** Pure domain change in `grade.ts`/`round.ts` (a trap match is now non-passing → routes to the existing retry path, which already surfaces the trap tip). The `flag` feedback kind and `strictness` field are deleted end-to-end. Content gains 5 new harder L2 grammar items. UI gains an exit button in `DrillHeader` wired to a local confirm overlay in `DrillScreen`.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Tailwind v4, Zustand, dnd-kit, framer-motion.

**Test runner:** `npx vitest run <path>` for a single file, `npx vitest run` for all. Type/build check: `npm run build`.

**Spec:** `docs/superpowers/specs/2026-06-27-drill-grading-and-exit-design.md`

---

## File map

- `src/domain/grade.ts` — `GradeStatus` collapses to `'ideal' | 'wrong'`; drop `flags`/`strictness`; trap → wrong.
- `src/domain/round.ts` — drop `flags` from `RoundAction`; drop the flagged-slip; keep `firstTrapTip`.
- `src/components/useRoundFeedback.ts` — drop the `'flag'` kind.
- `src/components/DrillScreen.tsx` — drop flag branches; add exit confirm overlay.
- `src/components/drill/DrillHeader.tsx` — add an `onExit` ✕ button.
- `src/data/types.ts` — remove `strictness` from `DrillItem`; fix the `GrammarTrap.tip` comment.
- `src/content/seed.ts` — strip `strictness`; replace the 5 `gr-l2-*` items with harder 3-slot sentences.
- Test files updated alongside each: `grade.test.ts`, `round.test.ts`, `useRoundFeedback.test.ts`, `DrillScreen.test.tsx`, `seed.test.ts`, plus a new `DrillHeader.test.tsx`.

**Sequencing note:** Vitest transpiles via esbuild and does not type-check, so per-file tests pass even while other files still reference removed symbols. `strictness` stays on the `DrillItem` type until Task 5 so intermediate edits compile; the final Task 7 runs `npm run build` to catch any lingering type errors project-wide.

---

### Task 1: grade.ts — near-miss is wrong, not flagged

**Files:**
- Modify: `src/domain/grade.ts`
- Test: `src/domain/grade.test.ts`

- [ ] **Step 1: Replace grade.test.ts with the new-behavior tests**

```ts
import { describe, it, expect } from 'vitest';
import { gradePlacement, slotResults } from './grade';
import type { DrillItem } from '../data/types';

// grammar item: 'he eats', with an agreement trap 'eat' on the verb slot
const grammarItem: Pick<DrillItem, 'answer' | 'traps'> = {
  answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
};
const patternItem: Pick<DrillItem, 'answer'> = { answer: ['I', 'run'] };

describe('gradePlacement', () => {
  it('exact answer -> ideal, passes', () => {
    expect(gradePlacement(['he', 'eats'], grammarItem)).toEqual({ status: 'ideal', passes: true });
  });

  it('a registered near-miss trap -> wrong, does NOT pass', () => {
    expect(gradePlacement(['he', 'eat'], grammarItem)).toEqual({ status: 'wrong', passes: false });
  });

  it('an unregistered wrong word -> wrong, does not pass', () => {
    expect(gradePlacement(['he', 'table'], grammarItem)).toEqual({ status: 'wrong', passes: false });
  });

  it('a null (unfilled) slot -> wrong, does not pass', () => {
    expect(gradePlacement(['he', null], grammarItem)).toEqual({ status: 'wrong', passes: false });
  });

  it('trap-less item (Pattern/WC) -> only ideal or wrong', () => {
    expect(gradePlacement(['I', 'run'], patternItem).status).toBe('ideal');
    expect(gradePlacement(['run', 'I'], patternItem).status).toBe('wrong');
  });

  it('placed longer than answer -> wrong', () => {
    expect(gradePlacement(['he', 'eats', 'extra'], grammarItem)).toEqual({ status: 'wrong', passes: false });
  });

  it('placed shorter than answer -> wrong', () => {
    expect(gradePlacement(['he'], grammarItem)).toEqual({ status: 'wrong', passes: false });
  });
});

describe('slotResults', () => {
  const item = {
    answer: ['She', 'feeds', 'the cat'],
    traps: [{ slot: 1, word: 'feed', tip: 'feeds (he/she) takes -s' }],
  };
  it('marks exact matches ok and others wrong', () => {
    expect(slotResults(['She', 'eats', 'the cat'], item)).toEqual(['ok', 'wrong', 'ok']);
  });
  it('marks a near-miss trap slot wrong (no longer accepted)', () => {
    expect(slotResults(['She', 'feed', 'the cat'], item)).toEqual(['ok', 'wrong', 'ok']);
  });
  it('marks an unfilled slot wrong', () => {
    expect(slotResults(['She', null, 'the cat'], item)).toEqual(['ok', 'wrong', 'ok']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/grade.test.ts`
Expected: FAIL — current `gradePlacement` returns `flags` and a `flagged` status; the new `toEqual` shapes won't match.

- [ ] **Step 3: Rewrite grade.ts to the new semantics**

```ts
import type { DrillItem } from '../data/types';

export type GradeStatus = 'ideal' | 'wrong';

export interface Grade {
  status: GradeStatus;
  passes: boolean; // may the round advance/finish on this placement?
}

type GradeItem = Pick<DrillItem, 'answer' | 'traps'>;

/**
 * Grades a fully- or partially-placed sentence against an item.
 * - Exact match in every slot -> 'ideal' (passes).
 * - Anything else (a registered near-miss trap, an unknown word, or an
 *   unfilled null) -> 'wrong' (does not pass). Near-miss traps no longer
 *   pass; their teaching tip is surfaced on retry by round.ts.
 */
export function gradePlacement(placed: (string | null)[], item: GradeItem): Grade {
  const { answer } = item;
  if (placed.length !== answer.length) {
    return { status: 'wrong', passes: false };
  }
  for (let i = 0; i < answer.length; i++) {
    if (placed[i] !== answer[i]) return { status: 'wrong', passes: false };
  }
  return { status: 'ideal', passes: true };
}

export type SlotResult = 'ok' | 'wrong';

/** Per-slot correctness for partial retry. Only an exact match is ok. */
export function slotResults(placed: (string | null)[], item: GradeItem): SlotResult[] {
  return item.answer.map((ans, i) => (placed[i] === ans ? 'ok' : 'wrong'));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/grade.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/domain/grade.ts src/domain/grade.test.ts
git commit -m "feat(grade): reject near-miss traps instead of flag-accepting them"
```

---

### Task 2: round.ts — drop flagged slips and flags from actions

**Files:**
- Modify: `src/domain/round.ts`
- Test: `src/domain/round.test.ts`

- [ ] **Step 1: Replace round.test.ts with the new-behavior tests**

```ts
// src/domain/round.test.ts
import { describe, expect, it } from 'vitest';
import { resolveRound } from './round';
import type { DrillItem } from '../data/types';

const pattern: Pick<DrillItem, 'answer'> = { answer: ['I', 'run'] };
const grammar: Pick<DrillItem, 'answer' | 'traps'> = {
  answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
};

describe('resolveRound', () => {
  it('returns retry with the wrong slot indices and a trap tip when present', () => {
    const item = {
      answer: ['She', 'feeds', 'the cat'],
      traps: [{ slot: 1, word: 'feed', tip: 'feeds (he/she) takes -s' }],
    };
    const action = resolveRound({ item, filled: ['She', 'feed', 'the cat'], index: 0, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.wrongSlots).toEqual([1]);
      expect(action.tip).toBe('feeds (he/she) takes -s');
    }
  });

  it('returns retry with tip null when no trap explains the slip', () => {
    const item = { answer: ['She', 'feeds', 'the cat'], traps: [] };
    const action = resolveRound({ item, filled: ['She', 'eats', 'the cat'], index: 0, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.wrongSlots).toEqual([1]);
      expect(action.tip).toBeNull();
    }
  });

  it('a grammar near-miss now routes to retry and carries the trap tip', () => {
    const action = resolveRound({ item: grammar, filled: ['he', 'eat'], index: 1, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.wrongSlots).toEqual([1]);
      expect(action.tip).toBe('เขา → he eats 👍');
    }
  });

  it('correct but not last item -> advance', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 2, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'advance', nextIndex: 3 });
  });

  it('correct and last item with no mistakes -> finish with 3 stars', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 4, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'finish', stars: 3 });
  });

  it('correct last item WITH prior mistakes -> finish with fewer stars', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 4, total: 5, mistakes: 2 });
    expect(action.type).toBe('finish');
    if (action.type === 'finish') {
      expect(action.stars).toBeLessThan(3);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/round.test.ts`
Expected: FAIL — current actions include `flags`, and the grammar near-miss currently `advance`s instead of `retry`.

- [ ] **Step 3: Rewrite round.ts**

```ts
import type { DrillItem } from '../data/types';
import { gradePlacement, slotResults } from './grade';
import { computeStars } from './scoring';

export type RoundAction =
  | { type: 'finish'; stars: number }
  | { type: 'advance'; nextIndex: number }
  | { type: 'retry'; wrongSlots: number[]; tip: string | null };

type RoundItem = Pick<DrillItem, 'answer' | 'traps'>;

function firstTrapTip(item: RoundItem, filled: (string | null)[], wrongSlots: number[]): string | null {
  for (const i of wrongSlots) {
    const trap = item.traps?.find((t) => t.slot === i && t.word === filled[i]);
    if (trap) return trap.tip;
  }
  return null;
}

/** Pure decision for what happens after a sentence is fully placed. */
export function resolveRound(params: {
  item: RoundItem;
  filled: (string | null)[];
  index: number;
  total: number;
  mistakes: number;
}): RoundAction {
  const { item, filled, index, total, mistakes } = params;
  const grade = gradePlacement(filled, item);
  if (!grade.passes) {
    const wrongSlots = slotResults(filled, item)
      .map((r, i) => (r === 'wrong' ? i : -1))
      .filter((i) => i >= 0);
    return { type: 'retry', wrongSlots, tip: firstTrapTip(item, filled, wrongSlots) };
  }

  if (index === total - 1) {
    return { type: 'finish', stars: computeStars({ hints: 0, mistakes }) };
  }
  return { type: 'advance', nextIndex: index + 1 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/round.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/round.ts src/domain/round.test.ts
git commit -m "feat(round): route near-misses to retry, drop flagged-slip and flags"
```

---

### Task 3: useRoundFeedback.ts — remove the 'flag' kind

**Files:**
- Modify: `src/components/useRoundFeedback.ts`
- Test: `src/components/useRoundFeedback.test.ts`

- [ ] **Step 1: Remove the 'flag' test block**

Delete the entire `it('flag: fires confetti (soft accept) ...')` test (lines ~70–86) from `src/components/useRoundFeedback.test.ts`. Leave the `correct`, `wrong`, and unmount tests unchanged.

- [ ] **Step 2: Run the test to verify the file still parses and the remaining tests pass**

Run: `npx vitest run src/components/useRoundFeedback.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Remove 'flag' from the hook**

```ts
// src/components/useRoundFeedback.ts
import { useEffect, useRef, useState } from 'react';
import { buzz, fireConfetti } from '../effects/celebrate';

export type Feedback = 'correct' | 'wrong' | null;

const HOLD_MS = { correct: 1100, wrong: 700 } as const;

/**
 * Plays a timed correct/incorrect feedback phase. `play` sets the feedback,
 * fires the side effect, holds for the kind's duration, then clears and runs onDone.
 * `locked` is true for the duration so callers can ignore input.
 */
export function useRoundFeedback() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clear() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function play(kind: 'correct' | 'wrong', onDone: () => void) {
    clear();
    setFeedback(kind);
    if (kind === 'wrong') buzz();
    else fireConfetti();
    timer.current = setTimeout(() => {
      timer.current = null;
      setFeedback(null);
      onDone();
    }, HOLD_MS[kind]);
  }

  useEffect(() => clear, []);

  return { feedback, play, locked: feedback !== null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/useRoundFeedback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/useRoundFeedback.ts src/components/useRoundFeedback.test.ts
git commit -m "refactor(feedback): drop the flag feedback kind"
```

---

### Task 4: DrillScreen.tsx — remove flag branches, add a rejected-grammar test

**Files:**
- Modify: `src/components/DrillScreen.tsx`
- Test: `src/components/DrillScreen.test.tsx`

- [ ] **Step 1: Add a failing test for a rejected grammar near-miss**

Append this test inside the `describe('DrillScreen', ...)` block in `src/components/DrillScreen.test.tsx` (the file already mocks `useRoundFeedback` so `play` runs `onDone` synchronously):

```ts
  it('rejects a grammar near-miss: clears the verb slot and shows the trap tip', () => {
    // first grammar L1 item: answer ['he','eats'] + trap 'eat'
    render(<DrillScreen items={itemsForDrill(SEED, 'grammar', 1)} drill="grammar" level={1} />);
    fireEvent.click(screen.getByTestId('tile-he'));
    fireEvent.click(screen.getByTestId('tile-eat')); // the agreement trap
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    // near-miss is rejected -> the wrong verb slot is cleared (retry)
    expect(screen.getByTestId('slot-1')).not.toHaveTextContent('eat');
    // and the trap's teaching tip is shown
    expect(screen.getByTestId('why-tip')).toHaveTextContent('เขา → he eats 👍');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/DrillScreen.test.tsx`
Expected: FAIL — today the near-miss is accepted (flag), so slot-1 keeps `eat` and no why-tip appears.

- [ ] **Step 3: Remove the flag branches in DrillScreen.tsx**

In `src/components/DrillScreen.tsx`:

Replace the `evaluate` tail (the `kind` line) so a pass is always `'correct'`:

```ts
    speak.speakSentence(item.answer.join(' '));
    setReaction('correct');
    play('correct', () => applyAction(action, filled));
```

Replace the `advance` case so it no longer reads `action.flags`:

```ts
      case 'advance':
        setStreak((s) => s + 1);
        setIndex(action.nextIndex);
        loadItem(action.nextIndex);
        break;
```

Remove `'flag'` from the flash-class expression (around line 188):

```tsx
            feedback === 'correct' ? 'flash-correct' : feedback === 'wrong' ? 'shake-wrong' : ''
```

Remove `'flag'` from the ✓ color expression (around line 197):

```tsx
                feedback === 'wrong' ? 'text-rose-500' : 'text-emerald-500'
```

(The `finish` case already passes `action.stars` only — no change needed there.)

- [ ] **Step 4: Run the DrillScreen tests to verify they pass**

Run: `npx vitest run src/components/DrillScreen.test.tsx`
Expected: PASS (all existing tests plus the new rejected-grammar test).

- [ ] **Step 5: Commit**

```bash
git add src/components/DrillScreen.tsx src/components/DrillScreen.test.tsx
git commit -m "feat(drill): render near-misses as rejected retries, remove flag UI"
```

---

### Task 5: Remove strictness + harder L2 grammar content

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/content/seed.ts`
- Test: `src/content/seed.test.ts`

- [ ] **Step 1: Update the seed test for the new grammar content**

In `src/content/seed.test.ts`, replace the `'has the expected migrated shape'` test and add an L1≠L2 grammar assertion. Pool size stays 30 (we replace, not add):

```ts
  it('has the expected migrated shape', () => {
    expect(SEED.units.length).toBe(2);
    expect(Object.keys(SEED.pool).length).toBe(30);
  });

  it('no item carries a strictness field anymore', () => {
    for (const item of Object.values(SEED.pool)) {
      expect('strictness' in item).toBe(false);
    }
  });

  it('L2 grammar sentences differ from L1 grammar sentences', () => {
    const sentences = (level: number) =>
      Object.values(SEED.pool)
        .filter((i) => i.drill === 'grammar' && i.level === level)
        .map((i) => i.answer.join(' '))
        .sort();
    const l1 = sentences(1);
    const l2 = sentences(2);
    expect(l2.length).toBe(5);
    for (const s of l2) expect(l1).not.toContain(s);
  });
```

- [ ] **Step 2: Run the seed test to verify it fails**

Run: `npx vitest run src/content/seed.test.ts`
Expected: FAIL — items still have `strictness`, and L2 grammar sentences equal L1's.

- [ ] **Step 3: Remove the `strictness` field from the type**

In `src/data/types.ts`, delete this line from `DrillItem`:

```ts
  strictness?: 'flag' | 'enforce'; // Grammar dial; undefined ⇒ exact match (Pattern/WC)
```

And update the `GrammarTrap.tip` comment:

```ts
  tip: string;    // gentle Thai-scaffolded nudge shown on a near-miss retry
```

- [ ] **Step 4: Strip `strictness` from L1 grammar and replace the L2 grammar items in seed.ts**

In `src/content/seed.ts`, remove the `"strictness": "flag",` line from each of `gr-l1-1` … `gr-l1-5` (5 deletions; leave those sentences otherwise unchanged).

Then replace the five L2 grammar pool entries (`gr-l2-1` … `gr-l2-5`) with these harder 3-slot S+V+O items (drop `strictness`, add an `Object` slot and an agreement trap on the verb):

```json
    "gr-l2-1": {
      "id": "gr-l2-1",
      "drill": "grammar",
      "level": 2,
      "thaiHint": "เธอกินข้าว",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["she", "eats", "rice"],
      "traps": [{ "slot": 1, "word": "eat", "tip": "เธอ → she eats 👍" }]
    },
    "gr-l2-2": {
      "id": "gr-l2-2",
      "drill": "grammar",
      "level": 2,
      "thaiHint": "เขาดื่มน้ำ",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["he", "drinks", "water"],
      "traps": [{ "slot": 1, "word": "drink", "tip": "เขา → he drinks 👍" }]
    },
    "gr-l2-3": {
      "id": "gr-l2-3",
      "drill": "grammar",
      "level": 2,
      "thaiHint": "เธออ่านหนังสือ",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["she", "reads", "books"],
      "traps": [{ "slot": 1, "word": "read", "tip": "เธอ → she reads 👍" }]
    },
    "gr-l2-4": {
      "id": "gr-l2-4",
      "drill": "grammar",
      "level": 2,
      "thaiHint": "เขาเล่นฟุตบอล",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["he", "plays", "football"],
      "traps": [{ "slot": 1, "word": "play", "tip": "เขา → he plays 👍" }]
    },
    "gr-l2-5": {
      "id": "gr-l2-5",
      "drill": "grammar",
      "level": 2,
      "thaiHint": "เธอชอบแมว",
      "slots": ["Pronoun", "Verb", "Object"],
      "answer": ["she", "likes", "cats"],
      "traps": [{ "slot": 1, "word": "like", "tip": "เธอ → she likes 👍" }]
    },
```

The `u2-grammar` lesson keeps its `itemIds: ["gr-l2-1", ... "gr-l2-5"]` — the ids are unchanged, only their content is.

- [ ] **Step 5: Run the content tests to verify they pass**

Run: `npx vitest run src/content/seed.test.ts src/content/validate.test.ts src/content/model.test.ts`
Expected: PASS. (The existing invariant "every grammar item has ≥1 trap and each trap.word differs from every answer word" still holds for the new items; pool size is still 30.)

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/content/seed.ts src/content/seed.test.ts
git commit -m "feat(content): drop strictness, give Unit 2 grammar harder 3-slot sentences"
```

---

### Task 6: Drill exit button + confirm overlay

**Files:**
- Modify: `src/components/drill/DrillHeader.tsx`
- Create: `src/components/drill/DrillHeader.test.tsx`
- Modify: `src/components/DrillScreen.tsx`
- Test: `src/components/DrillScreen.test.tsx`

- [ ] **Step 1: Write the failing DrillHeader test**

Create `src/components/drill/DrillHeader.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DrillHeader } from './DrillHeader';

describe('DrillHeader', () => {
  it('renders a Leave-drill button that calls onExit when clicked', () => {
    const onExit = vi.fn();
    render(<DrillHeader streak={0} index={0} total={5} onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /leave drill/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/drill/DrillHeader.test.tsx`
Expected: FAIL — `DrillHeader` has no `onExit` prop or button.

- [ ] **Step 3: Add the exit button to DrillHeader**

Replace `src/components/drill/DrillHeader.tsx` with:

```tsx
/** Round status: an exit (✕) + streak chip + a node per item (done / current / pending). Cosmetic. */
export function DrillHeader({
  streak,
  index,
  total,
  onExit,
}: {
  streak: number;
  index: number;
  total: number;
  onExit: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExit}
          aria-label="Leave drill"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-lg font-bold text-slate-500 shadow ring-1 ring-inset ring-slate-200"
        >
          ✕
        </button>
        <span
          data-testid="streak"
          className="flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-sm font-extrabold text-orange-700 ring-1 ring-inset ring-orange-200"
        >
          🔥 {streak}
        </span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            data-testid={`track-node-${i}`}
            className={`h-2.5 w-2.5 rounded-full ${
              i < index ? 'bg-amber-400' : i === index ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-white ring-1 ring-inset ring-slate-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the DrillHeader test to verify it passes**

Run: `npx vitest run src/components/drill/DrillHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing DrillScreen exit tests**

Append to `src/components/DrillScreen.test.tsx` inside `describe('DrillScreen', ...)`. The file already imports `useGameStore`:

```ts
  it('exit ✕ opens a confirm; Stay keeps the drill mounted', () => {
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByRole('button', { name: /leave drill/i }));
    expect(screen.getByText(/won't be saved/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /stay/i }));
    expect(screen.queryByText(/won't be saved/i)).not.toBeInTheDocument();
    expect(useGameStore.getState().screen).not.toBe('pickDrill');
  });

  it('exit ✕ -> Leave returns to the journey map without finishing the round', () => {
    const finishSpy = vi.spyOn(useGameStore.getState(), 'finishRound');
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByRole('button', { name: /leave drill/i }));
    fireEvent.click(screen.getByRole('button', { name: /^leave$/i }));
    expect(useGameStore.getState().screen).toBe('pickDrill');
    expect(finishSpy).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Run to verify they fail**

Run: `npx vitest run src/components/DrillScreen.test.tsx`
Expected: FAIL — no exit button / confirm yet.

- [ ] **Step 7: Wire the exit + confirm overlay into DrillScreen.tsx**

In `src/components/DrillScreen.tsx`:

Add the `PressButton` import next to the other component imports:

```ts
import { PressButton } from './PressButton';
```

Add `setScreen` to the store reads near `finishRound` (line ~24):

```ts
  const finishRound = useGameStore((s) => s.finishRound);
  const setScreen = useGameStore((s) => s.setScreen);
```

Add confirm state next to the other `useState` calls (after `const [activeWord, ...]`):

```ts
  const [confirmExit, setConfirmExit] = useState(false);
```

Pass `onExit` to the header (replace the existing `<DrillHeader ... />`):

```tsx
        <DrillHeader streak={streak} index={index} total={items.length} onExit={() => setConfirmExit(true)} />
```

Render the confirm overlay. Place it just before the closing `</div>` of the outer flex container (immediately after the `<WordTray>` block's wrapping `</div>`, still inside the `flex h-full flex-col` div):

```tsx
        {confirmExit && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-6">
            <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl">
              <p className="text-base font-extrabold text-slate-800">Leave drill?</p>
              <p className="mt-1 text-sm text-slate-500">Your progress won't be saved.</p>
              <div className="mt-4 flex gap-2">
                <PressButton
                  onClick={() => setConfirmExit(false)}
                  className="min-h-11 flex-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-extrabold text-slate-700"
                >
                  Stay
                </PressButton>
                <PressButton
                  onClick={() => setScreen('pickDrill')}
                  className="min-h-11 flex-1 rounded-xl bg-rose-500 px-3 py-2 text-sm font-extrabold text-white"
                >
                  Leave
                </PressButton>
              </div>
            </div>
          </div>
        )}
```

For the overlay's `absolute` positioning to anchor correctly, ensure the outer container is a positioning context — add `relative` to the outer `flex h-full flex-col ...` div's className:

```tsx
      <div className="relative flex h-full flex-col gap-3 bg-gradient-to-b from-sky-100 via-indigo-50 to-amber-50 p-4">
```

- [ ] **Step 8: Run the DrillScreen tests to verify they pass**

Run: `npx vitest run src/components/DrillScreen.test.tsx`
Expected: PASS (all prior tests plus the two new exit tests).

- [ ] **Step 9: Commit**

```bash
git add src/components/drill/DrillHeader.tsx src/components/drill/DrillHeader.test.tsx src/components/DrillScreen.tsx src/components/DrillScreen.test.tsx
git commit -m "feat(drill): add a confirm-gated exit back to the journey map"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: PASS — no failures across domain, content, and component tests.

- [ ] **Step 2: Type-check / build**

Run: `npm run build`
Expected: SUCCESS — no TypeScript errors. (This catches any lingering reference to the removed `strictness` field, `Grade.flags`, `RoundAction.flags`, or the `'flag'` feedback kind.)

- [ ] **Step 3: Manual verification in headed Chrome**

Follow the run/QA recipe in `C:\Users\DraculaZ\AppData\Local\Temp\drill-page-improve-handoff.md` (DevPanel VIEW AS + `store.startDrill`). Confirm:
1. Reach a grammar drill; place a near-miss (e.g. "he" + "eat" for "he eats"). It is **rejected** — the verb slot clears, the screen shakes, and the trap tip shows. It does **not** advance.
2. Place the exact answer — it advances normally.
3. Tap the ✕ — the "Leave drill?" confirm appears. **Stay** dismisses it; **Leave** returns to the journey map with no reward screen.

- [ ] **Step 4: Final commit (if Step 3 surfaced any tweak)**

```bash
git add -A
git commit -m "chore: drill grading + exit verification fixes"
```

---

## Self-review

- **Spec coverage:** Feature 1 reject semantics → Tasks 1–2; tip-on-reject preserved via `firstTrapTip` (Task 2) and asserted in Task 4; remove `flag`/`strictness` end-to-end → Tasks 1–5; harder L2 content → Task 5; Feature 2 exit + confirm + `pickDrill` destination + no-finishRound → Task 6. Verification → Task 7. All spec sections map to a task.
- **Placeholder scan:** none — every code step has complete code and an exact command with expected result.
- **Type consistency:** `Grade` = `{ status, passes }` (Task 1) is consumed as `grade.passes` in Task 2; `RoundAction` variants `finish{stars}` / `advance{nextIndex}` / `retry{wrongSlots,tip}` (Task 2) are consumed in Task 4's `applyAction`; `DrillHeader` gains `onExit: () => void` (Task 6 Step 3) matching the call site (Task 6 Step 7); `Feedback` = `'correct' | 'wrong' | null` (Task 3) matches the `play('correct', ...)` / `play('wrong', ...)` call sites in Task 4.

# Journey Map Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat unit-card list in `JourneyMap` with a winding "trail" level-map: serpentine nodes, a "you are here" beacon, milestone checkpoints, collapse-cleared-units folding, and food-on-cleared nodes so returning players can tell which lesson farms which food.

**Architecture:** UI-only. All gating/progress comes from existing `src/domain/journeyProgress.ts` helpers; no domain, store, or content changes. New presentation is decomposed into pure view helpers (`journeyView.ts`) plus four focused components (`StarPips`, `TrailNode`, `FoldedUnitBar`, `UnitSection`) under `src/components/journey/`, orchestrated by a rewritten `JourneyMap`. Fold state is session-local React state.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, framer-motion 12, Zustand, Vitest + @testing-library/react.

**Conventions:** typecheck `npx tsc -b`; test `npx vitest run <path>`; build `npm run build`. Branch `journey-redesign` (already created off `main`). Stage explicit files only — never `git add -A`/`.`; leave the concurrent session's `firebase.json` unstaged. Verify branch with `git rev-parse --abbrev-ref HEAD` before every commit. End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

- Create `src/components/journey/journeyView.ts` — pure view helpers + the `lessonLabel` aria string (moved from `JourneyMap.tsx`).
- Create `src/components/journey/journeyView.test.ts` — unit tests for the helpers.
- Create `src/components/journey/StarPips.tsx` + `StarPips.test.tsx` — star pip display.
- Create `src/components/journey/TrailNode.tsx` + `TrailNode.test.tsx` — one trail node, all states.
- Create `src/components/journey/FoldedUnitBar.tsx` + `FoldedUnitBar.test.tsx` — collapsed cleared-unit summary bar.
- Create `src/components/journey/UnitSection.tsx` — sticky unit header + spine + nodes + locked overlay + fold wiring.
- Modify `src/components/JourneyMap.tsx` — rewrite as shell + fold state + map of `UnitSection`.
- Modify `src/components/JourneyMap.test.tsx` — keep existing 4 tests, add fold + food coverage.

---

## Task 1: View helpers (`journeyView.ts`)

**Files:**
- Create: `src/components/journey/journeyView.ts`
- Test: `src/components/journey/journeyView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/journey/journeyView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { orderedUnits } from '../../content/model';
import { SEED } from '../../content/seed';
import {
  DRILL_LABEL, DRILL_TINT, foodEmoji, unitStars, currentLessonId, unitDone,
  serpentineOffset, lessonLabel,
} from './journeyView';

const units = orderedUnits(SEED);
const u1 = units[0]; // Basics
const u2 = units[1]; // Next Steps

describe('journeyView helpers', () => {
  it('maps each drill to a display label and a food emoji', () => {
    expect(DRILL_LABEL.pattern).toBe('Sentence Pattern');
    expect(foodEmoji('pattern')).toBe('🥩');
    expect(foodEmoji('mixed')).toBe('🍰');
    expect(DRILL_TINT.grammar.bg).toMatch(/^bg-/);
  });

  it('sums a unit\'s earned stars', () => {
    const stars = { 'u1-pattern': 3, 'u1-wordchoice': 2 };
    expect(unitStars(u1, stars)).toBe(5);
    expect(unitStars(u1, {})).toBe(0);
  });

  it('currentLessonId is the first unlocked, not-cleared lesson in order', () => {
    // fresh: first lesson of the first unit
    expect(currentLessonId(units, {})).toBe('u1-pattern');
    // clear u1-pattern → next open lesson
    expect(currentLessonId(units, { 'u1-pattern': 3 })).toBe('u1-wordchoice');
  });

  it('unitDone is true only when every lesson is cleared', () => {
    expect(unitDone(u1, {})).toBe(false);
    const all = Object.fromEntries(u1.lessons.map((l) => [l.id, 3]));
    expect(unitDone(u1, all)).toBe(true);
  });

  it('serpentineOffset cycles a 4-step pattern', () => {
    expect(serpentineOffset(0)).toBe(serpentineOffset(4));
    expect(serpentineOffset(0)).not.toBe(serpentineOffset(2));
  });

  it('lessonLabel preserves the existing aria phrasing', () => {
    expect(lessonLabel(u1, u1.lessons[0], {}, true)).toBe('Basics: pattern lesson, not started');
    expect(lessonLabel(u1, u1.lessons[0], { 'u1-pattern': 3 }, true)).toBe('Basics: pattern lesson, cleared, 3 stars');
    const cp = u1.lessons.find((l) => l.isCheckpoint)!;
    expect(lessonLabel(u1, cp, {}, false)).toBe('Basics: checkpoint, locked');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/journey/journeyView.test.ts`
Expected: FAIL — cannot resolve `./journeyView`.

- [ ] **Step 3: Write the implementation**

Create `src/components/journey/journeyView.ts`:

```ts
import type { DrillType } from '../../data/types';
import type { Unit, Lesson } from '../../content/model';
import { DRILL_FOOD, FOOD_META } from '../../data/food';
import { isLessonUnlocked, lessonCleared, unitProgress } from '../../domain/journeyProgress';
import type { LessonStars } from '../../domain/journeyProgress';

/** Display name per drill, shown under the current node and in folded bars. */
export const DRILL_LABEL: Record<DrillType, string> = {
  pattern: 'Sentence Pattern',
  wordChoice: 'Word Choice',
  grammar: 'Grammar',
  mixed: 'Mixed Review',
};

export interface DrillTint { bg: string; ring: string; ink: string; }

/** Soft per-drill tile tints (bg + ring + readable ink). */
export const DRILL_TINT: Record<DrillType, DrillTint> = {
  pattern: { bg: 'bg-orange-100', ring: 'ring-orange-200', ink: 'text-orange-700' },
  wordChoice: { bg: 'bg-green-100', ring: 'ring-green-200', ink: 'text-green-700' },
  grammar: { bg: 'bg-sky-100', ring: 'ring-sky-200', ink: 'text-sky-700' },
  mixed: { bg: 'bg-pink-100', ring: 'ring-pink-200', ink: 'text-pink-700' },
};

/** The food emoji a drill's lesson farms. */
export function foodEmoji(drill: DrillType): string {
  return FOOD_META[DRILL_FOOD[drill]].emoji;
}

/** Total stars earned across a unit's lessons. */
export function unitStars(unit: Unit, stars: LessonStars): number {
  return unit.lessons.reduce((sum, l) => sum + (stars[l.id] ?? 0), 0);
}

/** The single global "you are here": first unlocked, not-cleared lesson in journey order. */
export function currentLessonId(units: Unit[], stars: LessonStars): string | null {
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      if (isLessonUnlocked(units, unit, lesson, stars) && !lessonCleared(stars, lesson.id)) {
        return lesson.id;
      }
    }
  }
  return null;
}

/** A unit is fully done when it has lessons and every one is cleared. */
export function unitDone(unit: Unit, stars: LessonStars): boolean {
  const { cleared, total } = unitProgress(unit, stars);
  return total > 0 && cleared === total;
}

/** Serpentine horizontal offset class by node index (left / center / right / center). */
export function serpentineOffset(index: number): string {
  return ['-translate-x-16', 'translate-x-0', 'translate-x-16', 'translate-x-0'][index % 4];
}

/** Accessible label for a lesson node. Phrasing preserved from the original JourneyMap. */
export function lessonLabel(unit: Unit, lesson: Lesson, stars: LessonStars, open: boolean): string {
  const what = lesson.isCheckpoint ? 'checkpoint' : `${lesson.drill} lesson`;
  const status = lessonCleared(stars, lesson.id)
    ? `cleared, ${stars[lesson.id]} stars`
    : open
      ? 'not started'
      : 'locked';
  return `${unit.title}: ${what}, ${status}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/journey/journeyView.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must be journey-redesign
git add src/components/journey/journeyView.ts src/components/journey/journeyView.test.ts
git commit -m "feat(journey): add trail view helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: StarPips component

**Files:**
- Create: `src/components/journey/StarPips.tsx`
- Test: `src/components/journey/StarPips.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/journey/StarPips.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StarPips } from './StarPips';

describe('StarPips', () => {
  it('renders three stars total, filled to n', () => {
    const { container } = render(<StarPips n={2} />);
    // 3 star glyphs total in the text content
    expect(container.textContent).toBe('★★★');
    // the muted remainder is wrapped in a slate span
    expect(container.querySelector('.text-slate-300')?.textContent).toBe('★');
  });

  it('clamps n to the max', () => {
    const { container } = render(<StarPips n={9} max={3} />);
    expect(container.textContent).toBe('★★★');
    expect(container.querySelector('.text-slate-300')?.textContent).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/journey/StarPips.test.tsx`
Expected: FAIL — cannot resolve `./StarPips`.

- [ ] **Step 3: Write the implementation**

Create `src/components/journey/StarPips.tsx`:

```tsx
interface StarPipsProps {
  n: number;
  max?: number;
  className?: string;
}

/** Compact star rating: `n` filled (amber via parent), the rest muted. Decorative. */
export function StarPips({ n, max = 3, className = '' }: StarPipsProps) {
  const filled = Math.min(Math.max(0, n), max);
  return (
    <span className={`text-[11px] leading-none tracking-tight ${className}`} aria-hidden="true">
      {'★'.repeat(filled)}
      <span className="text-slate-300">{'★'.repeat(max - filled)}</span>
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/journey/StarPips.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/components/journey/StarPips.tsx src/components/journey/StarPips.test.tsx
git commit -m "feat(journey): add StarPips component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: TrailNode component

**Files:**
- Create: `src/components/journey/TrailNode.tsx`
- Test: `src/components/journey/TrailNode.test.tsx`

Renders one node. Determines its state from domain helpers. Cleared (Badge treatment): food emoji face + emerald ring + `✓` corner badge + star pips. Current: food face + "YOU ARE HERE" + pulse/bob (disabled under reduced motion) + drill label. Open: food face. Locked checkpoint: 🏆 grey. Locked lesson: 🔒 grey disabled. Checkpoint nodes use a larger rounded-square.

- [ ] **Step 1: Write the failing test**

Create `src/components/journey/TrailNode.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { orderedUnits } from '../../content/model';
import { SEED } from '../../content/seed';
import { TrailNode } from './TrailNode';

const units = orderedUnits(SEED);
const u1 = units[0];
const u2 = units[1];
const patternLesson = u1.lessons[0];           // u1-pattern
const lockedLesson = u2.lessons[0];            // u2-pattern (locked at fresh state)

function renderNode(props: Partial<React.ComponentProps<typeof TrailNode>> = {}) {
  const onStart = vi.fn();
  render(
    <TrailNode
      units={units} unit={u1} lesson={patternLesson} stars={{}}
      index={0} isCurrent={false} onStart={onStart} {...props}
    />,
  );
  return onStart;
}

describe('TrailNode', () => {
  it('a cleared node still shows its food emoji (not just a check)', () => {
    renderNode({ stars: { 'u1-pattern': 3 } });
    const btn = screen.getByRole('button', { name: /Basics: pattern lesson, cleared/i });
    expect(btn.textContent).toContain('🥩'); // protein, pattern's food
  });

  it('an open node starts its lesson on click', () => {
    const onStart = renderNode({ isCurrent: true });
    fireEvent.click(screen.getByRole('button', { name: /Basics: pattern lesson/i }));
    expect(onStart).toHaveBeenCalledWith('u1-pattern');
  });

  it('the current node shows a "you are here" beacon', () => {
    renderNode({ isCurrent: true });
    expect(screen.getByText(/you are here/i)).toBeInTheDocument();
  });

  it('a locked node is disabled', () => {
    render(
      <TrailNode units={units} unit={u2} lesson={lockedLesson} stars={{}}
        index={0} isCurrent={false} onStart={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Next Steps: pattern lesson, locked/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/journey/TrailNode.test.tsx`
Expected: FAIL — cannot resolve `./TrailNode`.

- [ ] **Step 3: Write the implementation**

Create `src/components/journey/TrailNode.tsx`:

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { PressButton } from '../PressButton';
import { StarPips } from './StarPips';
import type { Unit, Lesson } from '../../content/model';
import type { LessonStars } from '../../domain/journeyProgress';
import { isLessonUnlocked, lessonCleared } from '../../domain/journeyProgress';
import {
  DRILL_LABEL, DRILL_TINT, foodEmoji, serpentineOffset, lessonLabel,
} from './journeyView';

interface TrailNodeProps {
  units: Unit[];
  unit: Unit;
  lesson: Lesson;
  stars: LessonStars;
  index: number;
  isCurrent: boolean;
  onStart: (lessonId: string) => void;
}

export function TrailNode({ units, unit, lesson, stars, index, isCurrent, onStart }: TrailNodeProps) {
  const reduce = useReducedMotion();
  const open = isLessonUnlocked(units, unit, lesson, stars);
  const cleared = lessonCleared(stars, lesson.id);
  const tint = DRILL_TINT[lesson.drill];
  const food = foodEmoji(lesson.drill);
  const label = lessonLabel(unit, lesson, stars, open);

  const shape = lesson.isCheckpoint ? 'rounded-3xl' : 'rounded-full';
  const size = lesson.isCheckpoint ? 'h-[5.5rem] w-[5.5rem] text-4xl' : 'h-16 w-16 text-2xl';

  let face = food;
  let tileCls = `${tint.bg} ring-4 ring-white`;
  let badge: React.ReactNode = null;
  let caption: React.ReactNode = null;

  if (cleared) {
    tileCls = `${tint.bg} ring-4 ring-emerald-300`;
    badge = (
      <span
        className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-sm font-bold text-white shadow ring-2 ring-white"
        aria-hidden="true"
      >✓</span>
    );
    caption = <StarPips n={stars[lesson.id] ?? 0} className="mt-1 text-amber-500" />;
  } else if (isCurrent) {
    tileCls = `${tint.bg} ring-4 ring-white shadow-xl`;
    caption = <span className={`mt-1 text-xs font-bold ${tint.ink}`}>{DRILL_LABEL[lesson.drill]}</span>;
  } else if (!open) {
    if (lesson.isCheckpoint) {
      face = '🏆';
      tileCls = 'bg-slate-200 text-slate-400 ring-4 ring-slate-100';
      caption = <span className="mt-1 text-[11px] font-bold text-slate-400">CHECKPOINT 🔒</span>;
    } else {
      face = '🔒';
      tileCls = 'bg-slate-200 text-slate-400';
    }
  }

  const pulse = isCurrent && !reduce
    ? { scale: [1, 1.05, 1], y: [0, -4, 0] }
    : undefined;

  return (
    <div className={`relative flex flex-col items-center ${serpentineOffset(index)}`}>
      {isCurrent && (
        <span className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
          YOU ARE HERE
        </span>
      )}
      <motion.div
        className="relative"
        animate={pulse}
        transition={pulse ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        <PressButton
          disabled={!open}
          aria-label={label}
          onClick={() => onStart(lesson.id)}
          className={`grid ${size} place-items-center ${shape} font-bold shadow-lg ${tileCls}`}
        >
          {face}
        </PressButton>
        {badge}
      </motion.div>
      {caption}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/journey/TrailNode.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/components/journey/TrailNode.tsx src/components/journey/TrailNode.test.tsx
git commit -m "feat(journey): add TrailNode with badge cleared treatment

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: FoldedUnitBar component

**Files:**
- Create: `src/components/journey/FoldedUnitBar.tsx`
- Test: `src/components/journey/FoldedUnitBar.test.tsx`

A one-line summary for a fully-cleared, collapsed unit: ✓ chip · emoji · title · `★ total` · `cleared/total` · `▾`. The whole bar is a button that expands the unit.

- [ ] **Step 1: Write the failing test**

Create `src/components/journey/FoldedUnitBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { orderedUnits } from '../../content/model';
import { SEED } from '../../content/seed';
import { FoldedUnitBar } from './FoldedUnitBar';

const u1 = orderedUnits(SEED)[0];
const allCleared = Object.fromEntries(u1.lessons.map((l) => [l.id, 3]));

describe('FoldedUnitBar', () => {
  it('shows the unit title and total stars, and is collapsed (aria-expanded=false)', () => {
    render(<FoldedUnitBar unit={u1} stars={allCleared} onExpand={vi.fn()} />);
    expect(screen.getByText('Basics')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /expand Basics/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    // 4 lessons * 3 stars = 12
    expect(btn.textContent).toContain('12');
  });

  it('calls onExpand when clicked', () => {
    const onExpand = vi.fn();
    render(<FoldedUnitBar unit={u1} stars={allCleared} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole('button', { name: /expand Basics/i }));
    expect(onExpand).toHaveBeenCalledWith(u1.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/journey/FoldedUnitBar.test.tsx`
Expected: FAIL — cannot resolve `./FoldedUnitBar`.

- [ ] **Step 3: Write the implementation**

Create `src/components/journey/FoldedUnitBar.tsx`:

```tsx
import { PressButton } from '../PressButton';
import type { Unit } from '../../content/model';
import type { LessonStars } from '../../domain/journeyProgress';
import { unitProgress } from '../../domain/journeyProgress';
import { unitStars } from './journeyView';

interface FoldedUnitBarProps {
  unit: Unit;
  stars: LessonStars;
  onExpand: (unitId: string) => void;
}

/** Collapsed summary for a fully-cleared unit. Tap to expand. */
export function FoldedUnitBar({ unit, stars, onExpand }: FoldedUnitBarProps) {
  const { cleared, total } = unitProgress(unit, stars);
  return (
    <PressButton
      aria-expanded={false}
      aria-label={`expand ${unit.title}`}
      onClick={() => onExpand(unit.id)}
      className="flex w-full items-center gap-3 rounded-2xl bg-white/70 px-3 py-2.5 text-left shadow-sm ring-1 ring-emerald-100"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-400 text-sm text-white shadow" aria-hidden="true">✓</span>
      <span className="text-xl" aria-hidden="true">{unit.emoji}</span>
      <span className="font-bold text-slate-700">{unit.title}</span>
      <span className="ml-auto flex items-center gap-2 text-xs font-bold text-slate-400">
        <span className="text-amber-500">★ {unitStars(unit, stars)}</span>
        <span>{cleared}/{total}</span>
        <span className="text-slate-300" aria-hidden="true">▾</span>
      </span>
    </PressButton>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/journey/FoldedUnitBar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/components/journey/FoldedUnitBar.tsx src/components/journey/FoldedUnitBar.test.tsx
git commit -m "feat(journey): add FoldedUnitBar summary

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: UnitSection component

**Files:**
- Create: `src/components/journey/UnitSection.tsx`

Composes a unit: when folded → `FoldedUnitBar`; otherwise → sticky header (emoji, title, `cleared/total` badge or `collapse ▴` for a cleared+expanded unit), a dotted spine, the `TrailNode`s, and (if locked) an unlock-hint overlay. No new test file — behavior is covered by the `JourneyMap` integration tests in Task 6 (this is a thin composition layer; testing it twice would be redundant).

- [ ] **Step 1: Write the implementation**

Create `src/components/journey/UnitSection.tsx`:

```tsx
import { TrailNode } from './TrailNode';
import { FoldedUnitBar } from './FoldedUnitBar';
import { PressButton } from '../PressButton';
import type { Unit } from '../../content/model';
import type { LessonStars } from '../../domain/journeyProgress';
import { isUnitUnlocked, unitProgress } from '../../domain/journeyProgress';
import { unitDone } from './journeyView';

interface UnitSectionProps {
  units: Unit[];
  unit: Unit;
  stars: LessonStars;
  currentId: string | null;
  folded: boolean;
  onToggle: (unitId: string) => void;
  onStart: (lessonId: string) => void;
}

export function UnitSection({ units, unit, stars, currentId, folded, onToggle, onStart }: UnitSectionProps) {
  const unlocked = isUnitUnlocked(units, unit, stars);
  const done = unitDone(unit, stars);
  const { cleared, total } = unitProgress(unit, stars);

  if (folded) {
    return (
      <section>
        <FoldedUnitBar unit={unit} stars={stars} onExpand={onToggle} />
      </section>
    );
  }

  return (
    <section className="relative">
      <div className="sticky top-0 z-30 -mx-1 mb-2 flex items-center gap-2 bg-indigo-50/90 px-3 py-2 backdrop-blur">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-xl shadow ring-1 ring-indigo-100" aria-hidden="true">
          {unit.emoji}
        </span>
        <h2 className="font-extrabold text-indigo-900">{unit.title}</h2>
        {done ? (
          <PressButton
            aria-expanded={true}
            aria-label={`collapse ${unit.title}`}
            onClick={() => onToggle(unit.id)}
            className="ml-auto text-xs font-bold text-indigo-400"
          >
            collapse ▴
          </PressButton>
        ) : (
          <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 shadow-sm">
            {cleared}/{total}
          </span>
        )}
      </div>

      <div className={`relative ${unlocked ? '' : 'opacity-60'}`}>
        <div
          className="pointer-events-none absolute inset-y-2 left-1/2 -z-0 w-1 -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,#c7d2fe_0_8px,transparent_8px_16px)]"
          aria-hidden="true"
        />
        {unit.lessons.map((lesson, i) => (
          <div key={lesson.id} className="relative z-10 my-3 flex justify-center">
            <TrailNode
              units={units}
              unit={unit}
              lesson={lesson}
              stars={stars}
              index={i}
              isCurrent={lesson.id === currentId}
              onStart={onStart}
            />
          </div>
        ))}

        {!unlocked && (
          <div className="absolute inset-0 z-20 grid place-items-center rounded-3xl bg-slate-900/5 backdrop-blur-[1px]">
            <div className="rounded-2xl bg-white/95 px-4 py-3 text-center shadow-lg ring-1 ring-slate-200">
              <div className="text-2xl" aria-hidden="true">🔒</div>
              <div className="text-sm font-bold text-slate-700">Clear the previous checkpoint</div>
              <div className="text-xs text-slate-500">to open {unit.title}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc -b`
Expected: no errors. (Component is exercised by Task 6 tests.)

- [ ] **Step 3: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/components/journey/UnitSection.tsx
git commit -m "feat(journey): add UnitSection (header, spine, nodes, fold, lock overlay)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Rewrite JourneyMap + extend its tests

**Files:**
- Modify: `src/components/JourneyMap.tsx` (full rewrite)
- Modify: `src/components/JourneyMap.test.tsx` (keep 4 existing tests, add fold + food)

JourneyMap becomes the shell: sticky header (Back, "Journey", total-stars badge), a scrollable trail body, and session-local fold state seeded so fully-cleared units start folded. A unit stays folded unless the player expanded it; toggling flips it.

- [ ] **Step 1: Write the failing tests**

Replace `src/components/JourneyMap.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JourneyMap } from './JourneyMap';
import { useGameStore } from '../state/gameStore';
import { orderedUnits } from '../content/model';
import { SEED } from '../content/seed';

const u1 = orderedUnits(SEED)[0];
const u1AllCleared = Object.fromEntries(u1.lessons.map((l) => [l.id, 3]));

describe('JourneyMap', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  // ---- preserved behavior ----
  it('renders each unit title', () => {
    render(<JourneyMap />);
    expect(screen.getByText('Basics')).toBeInTheDocument();
    expect(screen.getByText('Next Steps')).toBeInTheDocument();
  });

  it('a locked unit\'s first node is disabled', () => {
    render(<JourneyMap />);
    expect(screen.getByRole('button', { name: /Next Steps.*pattern/i })).toBeDisabled();
  });

  it('tapping an available node starts that lesson', () => {
    render(<JourneyMap />);
    fireEvent.click(screen.getByRole('button', { name: /Basics.*pattern.*not started/i }));
    expect(useGameStore.getState().currentLessonId).toBe('u1-pattern');
    expect(useGameStore.getState().screen).toBe('drill');
  });

  it('a checkpoint is locked until the unit lessons are cleared', () => {
    render(<JourneyMap />);
    expect(screen.getByRole('button', { name: /Basics.*checkpoint/i })).toBeDisabled();
  });

  // ---- new behavior ----
  it('a fully-cleared unit starts folded (summary bar, nodes hidden)', () => {
    useGameStore.setState({ journey: { lessonStars: u1AllCleared } });
    render(<JourneyMap />);
    // folded → expand control present, lesson nodes absent
    expect(screen.getByRole('button', { name: /expand Basics/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Basics: pattern lesson/i })).not.toBeInTheDocument();
  });

  it('expanding a folded unit reveals its nodes', () => {
    useGameStore.setState({ journey: { lessonStars: u1AllCleared } });
    render(<JourneyMap />);
    fireEvent.click(screen.getByRole('button', { name: /expand Basics/i }));
    expect(screen.getByRole('button', { name: /Basics: pattern lesson, cleared/i })).toBeInTheDocument();
  });

  it('cleared nodes show their food emoji, not just a check', () => {
    useGameStore.setState({ journey: { lessonStars: { 'u1-pattern': 3 } } });
    render(<JourneyMap />);
    const node = screen.getByRole('button', { name: /Basics: pattern lesson, cleared/i });
    expect(node.textContent).toContain('🥩');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/JourneyMap.test.tsx`
Expected: FAIL — the new fold tests fail against the old flat-card implementation (no "expand Basics" button).

- [ ] **Step 3: Rewrite the implementation**

Replace `src/components/JourneyMap.tsx` with:

```tsx
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { orderedUnits } from '../content/model';
import { useContentStore } from '../content/store';
import { UnitSection } from './journey/UnitSection';
import { PressButton } from './PressButton';
import { currentLessonId, unitDone } from './journey/journeyView';

export function JourneyMap() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startLesson = useGameStore((s) => s.startLesson);
  const stars = useGameStore((s) => s.journey.lessonStars);
  const bundle = useContentStore((s) => s.bundle);
  const units = useMemo(() => orderedUnits(bundle), [bundle]);

  const currentId = currentLessonId(units, stars);
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);

  // Units the player has explicitly expanded despite being fully cleared.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (unitId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(unitId) ? next.delete(unitId) : next.add(unitId);
      return next;
    });

  return (
    <div className="grid h-full grid-rows-[auto_1fr] bg-gradient-to-b from-indigo-100 to-indigo-50">
      <header className="flex items-center gap-2 px-4 pb-3 pt-4">
        <PressButton
          onClick={() => setScreen('petRoom')}
          className="grid h-10 w-10 place-items-center rounded-xl bg-white text-indigo-700 shadow"
          aria-label="Back to pet room"
        >
          ←
        </PressButton>
        <h1 className="text-lg font-extrabold text-indigo-900">Journey</h1>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-amber-500 shadow">
          <span aria-hidden="true">★</span>
          <span className="text-slate-700">{totalStars}</span>
          <span className="sr-only">stars earned</span>
        </div>
      </header>

      <div className="space-y-4 overflow-y-auto px-4 pb-10">
        {units.map((unit, index) => {
          const folded = unitDone(unit, stars) && !expanded.has(unit.id);
          return (
            <motion.div
              key={unit.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
            >
              <UnitSection
                units={units}
                unit={unit}
                stars={stars}
                currentId={currentId}
                folded={folded}
                onToggle={toggle}
                onStart={startLesson}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/JourneyMap.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Full typecheck + suite**

Run: `npx tsc -b`
Expected: no errors.
Run: `npx vitest run`
Expected: all green (existing baseline ~610 passed / 13 skipped, plus the new journey tests).

- [ ] **Step 6: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/components/JourneyMap.tsx src/components/JourneyMap.test.tsx
git commit -m "feat(journey): rewrite JourneyMap as a folding trail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Visual verification, cleanup, final checks

**Files:**
- Delete: `public/journey-redesign.html`, `shot.mjs`, `shot-badge.png`, `shot-ring.png`, `shot-chip.png` (throwaway mockup artifacts; never committed)

- [ ] **Step 1: Visual check in the browser (main thread, sandbox disabled)**

Start the dev server if not already running (a free port; 5173–5176/5180 are taken by other sessions):
Run: `npm run dev -- --port 5177`
Navigate PetRoom → Journey. Confirm: trail renders, nodes serpentine along the dotted spine, the current lesson shows the "YOU ARE HERE" beacon and pulses, cleared nodes show their food emoji + ✓ badge + stars, the locked unit is dimmed with the unlock hint. Clear a unit via the dev panel (or set stars) and confirm it folds to a summary bar and re-expands on tap.

- [ ] **Step 2: Remove throwaway artifacts**

```bash
git rev-parse --abbrev-ref HEAD
Remove-Item public/journey-redesign.html, shot.mjs, shot-badge.png, shot-ring.png, shot-chip.png -ErrorAction SilentlyContinue
```

(These were never staged, so this only deletes untracked files. Confirm with `git status --short` that nothing tracked changed.)

- [ ] **Step 3: Final green gate**

Run: `npx tsc -b` → no errors.
Run: `npm run build` → succeeds.
Run: `npx vitest run` → all green.

- [ ] **Step 4: Confirm the working tree is clean except the concurrent session's firebase.json**

Run: `git status --short`
Expected: only ` M firebase.json` (the concurrent session's — leave it unstaged). No journey artifacts remain.

---

## Self-Review

**Spec coverage:**
- Shell `grid-rows-[auto_1fr]`, sticky header, total stars → Task 6. ✓
- Sticky unit header, spine, serpentine nodes, locked overlay → Task 5. ✓
- Node states incl. Badge cleared treatment + cleared checkpoint 🍰 → Task 3 (`foodEmoji('mixed')` = 🍰; checkpoint cleared falls through to the food face since `cleared` branch precedes the locked-checkpoint branch). ✓
- Folding (auto-fold cleared, expand/collapse, session-local) → Tasks 4–6. ✓
- Helpers (LABEL, tint, food, StarPips, serpentine, currentLessonId, unitDone, lessonLabel) → Tasks 1–2. ✓
- Motion + reduced-motion → Task 3 (`useReducedMotion`), Task 6 (stagger-in). ✓
- A11y (aria-labels preserved, disabled locked, aria-expanded fold, aria-hidden decoration) → Tasks 3–6. ✓
- Tests: cleared folds, expand toggle, food-on-cleared, locked disabled → Task 6. ✓
- Cleanup artifacts, verify gates → Task 7. ✓

**Placeholder scan:** none — every code/step is complete.

**Type consistency:** `currentLessonId`/`unitDone`/`unitStars`/`lessonLabel`/`foodEmoji`/`serpentineOffset`/`DRILL_LABEL`/`DRILL_TINT` signatures defined in Task 1 are used unchanged in Tasks 3–6. `TrailNode`/`FoldedUnitBar`/`UnitSection` prop names match across definition and use. `onStart`/`onToggle`/`onExpand` callbacks consistent.

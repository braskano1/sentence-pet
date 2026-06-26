# Themed Learning Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat drill-picker grid with a Duolingo-style themed-unit learning journey: ordered topic Units → single-drill Lesson nodes → a Mixed checkpoint that gates the next unit, with persisted per-lesson star progress.

**Architecture:** Content is plain data (`src/data/journey.ts`, the future admin-backend seam). Progression rules are pure functions (`src/domain/journeyProgress.ts`) over a `lessonStars` record. The store gains a persisted `journey` slice + transient `currentLessonId`, a `startLesson` action, and records best stars on round finish — reusing the existing drill engine and reward flow unchanged. A new `JourneyMap` component (unit cards) replaces `DrillPicker`.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist) + Vitest + framer-motion.

**Spec:** `docs/superpowers/specs/2026-06-26-themed-learning-journey-design.md`

**Conventions (carry forward):**
- Prefix every Bash command with `cd "D:\ai_projects\AI_design_thinking\sentence-pet" &&` (the tool resets cwd).
- Typecheck is `npx tsc -b` (NOT `tsc --noEmit`).
- Pure logic → unit-tested; components → render-only; mock `canvas-confetti` in any test transitively importing `src/effects/celebrate.ts`.
- Run a single test file: `npx vitest run <path>`. Run all: `npm test`.

---

### Task 1: Journey content model + seed data

**Files:**
- Create: `src/data/journey.ts`
- Test: `src/data/journey.test.ts`

- [ ] **Step 1: Write the failing test**

`src/data/journey.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { JOURNEY, findLesson } from './journey';
import { itemsFor } from './wordBank';

describe('JOURNEY content', () => {
  it('has at least two units, ordered ascending with unique orders', () => {
    expect(JOURNEY.length).toBeGreaterThanOrEqual(2);
    const orders = JOURNEY.map((u) => u.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('every unit has lessons, exactly one checkpoint, and it is last', () => {
    for (const u of JOURNEY) {
      expect(u.lessons.length).toBeGreaterThan(0);
      const checkpoints = u.lessons.filter((l) => l.isCheckpoint);
      expect(checkpoints.length).toBe(1);
      expect(u.lessons[u.lessons.length - 1].isCheckpoint).toBe(true);
    }
  });

  it('all lesson ids are unique across the whole journey', () => {
    const ids = JOURNEY.flatMap((u) => u.lessons.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every lesson (drill, level) resolves to at least one item', () => {
    for (const u of JOURNEY) {
      for (const l of u.lessons) {
        expect(itemsFor(l.drill, l.level).length).toBeGreaterThan(0);
      }
    }
  });

  it('findLesson resolves a known id to its unit + lesson', () => {
    const first = JOURNEY[0].lessons[0];
    const found = findLesson(first.id);
    expect(found?.lesson.id).toBe(first.id);
    expect(found?.unit.id).toBe(JOURNEY[0].id);
    expect(findLesson('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/data/journey.test.ts`
Expected: FAIL — cannot resolve `./journey`.

- [ ] **Step 3: Write minimal implementation**

`src/data/journey.ts`:

```ts
import type { DrillType } from './types';

/** One node on the journey: a named pointer to a (drill, level) round.
 *  isCheckpoint marks the unit's final node — the forward hook where the
 *  Phase B-3 boss battle will later swap in for the Mixed round. */
export interface Lesson {
  id: string;
  drill: DrillType;
  level: number;
  isCheckpoint?: boolean;
}

/** A themed cluster of lessons. Cleared checkpoint unlocks the next unit. */
export interface Unit {
  id: string;
  title: string;
  emoji: string;
  order: number;
  lessons: Lesson[];
}

/** Seed journey. Wraps existing WORD_BANK content so the journey ships
 *  playable; theme-specific items arrive with the admin backend later. */
export const JOURNEY: Unit[] = [
  {
    id: 'u1-basics',
    title: 'Basics',
    emoji: '🐣',
    order: 1,
    lessons: [
      { id: 'u1-pattern', drill: 'pattern', level: 1 },
      { id: 'u1-wordchoice', drill: 'wordChoice', level: 1 },
      { id: 'u1-grammar', drill: 'grammar', level: 1 },
      { id: 'u1-checkpoint', drill: 'mixed', level: 1, isCheckpoint: true },
    ],
  },
  {
    id: 'u2-next-steps',
    title: 'Next Steps',
    emoji: '🌱',
    order: 2,
    lessons: [
      { id: 'u2-pattern', drill: 'pattern', level: 2 },
      { id: 'u2-grammar', drill: 'grammar', level: 2 },
      { id: 'u2-checkpoint', drill: 'mixed', level: 1, isCheckpoint: true },
    ],
  },
];

/** Units sorted by order (defensive; JOURNEY is authored sorted). */
export function orderedUnits(): Unit[] {
  return [...JOURNEY].sort((a, b) => a.order - b.order);
}

/** Resolve a lesson id to its unit + lesson, or undefined. */
export function findLesson(id: string): { unit: Unit; lesson: Lesson } | undefined {
  for (const unit of JOURNEY) {
    const lesson = unit.lessons.find((l) => l.id === id);
    if (lesson) return { unit, lesson };
  }
  return undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/data/journey.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/data/journey.ts src/data/journey.test.ts && git commit -m "feat: journey content model + seed units"
```

---

### Task 2: Progression rules (pure module)

**Files:**
- Create: `src/domain/journeyProgress.ts`
- Test: `src/domain/journeyProgress.test.ts`

Progress is represented as a `lessonStars: Record<lessonId, number>` map — a key present means the lesson is cleared (best stars 0..3). All functions are pure over (journey/unit/lesson, lessonStars).

- [ ] **Step 1: Write the failing test**

`src/domain/journeyProgress.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Unit } from '../data/journey';
import { lessonCleared, unitProgress, isLessonUnlocked, isUnitUnlocked } from './journeyProgress';

const JOURNEY: Unit[] = [
  {
    id: 'a', title: 'A', emoji: '🐣', order: 1,
    lessons: [
      { id: 'a1', drill: 'pattern', level: 1 },
      { id: 'a2', drill: 'grammar', level: 1 },
      { id: 'a-ck', drill: 'mixed', level: 1, isCheckpoint: true },
    ],
  },
  {
    id: 'b', title: 'B', emoji: '🌱', order: 2,
    lessons: [
      { id: 'b1', drill: 'pattern', level: 2 },
      { id: 'b-ck', drill: 'mixed', level: 1, isCheckpoint: true },
    ],
  },
];
const unitA = JOURNEY[0];
const unitB = JOURNEY[1];

describe('lessonCleared', () => {
  it('is true iff the id is present in the stars map', () => {
    expect(lessonCleared({ a1: 3 }, 'a1')).toBe(true);
    expect(lessonCleared({ a1: 0 }, 'a1')).toBe(true); // 0 stars still cleared
    expect(lessonCleared({}, 'a1')).toBe(false);
  });
});

describe('unitProgress', () => {
  it('counts cleared lessons over total', () => {
    expect(unitProgress(unitA, { a1: 3 })).toEqual({ cleared: 1, total: 3 });
    expect(unitProgress(unitA, {})).toEqual({ cleared: 0, total: 3 });
  });
});

describe('isUnitUnlocked', () => {
  it('first unit is always unlocked', () => {
    expect(isUnitUnlocked(JOURNEY, unitA, {})).toBe(true);
  });
  it('later unit locked until previous unit checkpoint cleared', () => {
    expect(isUnitUnlocked(JOURNEY, unitB, {})).toBe(false);
    expect(isUnitUnlocked(JOURNEY, unitB, { a1: 3, a2: 3 })).toBe(false);
    expect(isUnitUnlocked(JOURNEY, unitB, { 'a-ck': 2 })).toBe(true);
  });
});

describe('isLessonUnlocked', () => {
  it('non-checkpoint lessons of an unlocked unit are all open', () => {
    expect(isLessonUnlocked(JOURNEY, unitA, unitA.lessons[0], {})).toBe(true);
    expect(isLessonUnlocked(JOURNEY, unitA, unitA.lessons[1], {})).toBe(true);
  });
  it('checkpoint locked until all non-checkpoint lessons cleared', () => {
    const ck = unitA.lessons[2];
    expect(isLessonUnlocked(JOURNEY, unitA, ck, {})).toBe(false);
    expect(isLessonUnlocked(JOURNEY, unitA, ck, { a1: 3 })).toBe(false);
    expect(isLessonUnlocked(JOURNEY, unitA, ck, { a1: 3, a2: 1 })).toBe(true);
  });
  it('nothing in a locked unit is unlocked', () => {
    expect(isLessonUnlocked(JOURNEY, unitB, unitB.lessons[0], {})).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/journeyProgress.test.ts`
Expected: FAIL — cannot resolve `./journeyProgress`.

- [ ] **Step 3: Write minimal implementation**

`src/domain/journeyProgress.ts`:

```ts
import type { Unit, Lesson } from '../data/journey';

export type LessonStars = Record<string, number>;

/** A lesson is cleared iff its id is present in the stars map. */
export function lessonCleared(stars: LessonStars, lessonId: string): boolean {
  return Object.prototype.hasOwnProperty.call(stars, lessonId);
}

/** Cleared / total lesson counts for a unit's progress badge. */
export function unitProgress(unit: Unit, stars: LessonStars): { cleared: number; total: number } {
  const cleared = unit.lessons.filter((l) => lessonCleared(stars, l.id)).length;
  return { cleared, total: unit.lessons.length };
}

/** The unit immediately before `unit` by order, or undefined for the first. */
function previousUnit(journey: Unit[], unit: Unit): Unit | undefined {
  const ordered = [...journey].sort((a, b) => a.order - b.order);
  const idx = ordered.findIndex((u) => u.id === unit.id);
  return idx > 0 ? ordered[idx - 1] : undefined;
}

/** First unit always open; later units gated on the previous unit's checkpoint. */
export function isUnitUnlocked(journey: Unit[], unit: Unit, stars: LessonStars): boolean {
  const prev = previousUnit(journey, unit);
  if (!prev) return true;
  const checkpoint = prev.lessons.find((l) => l.isCheckpoint);
  return checkpoint ? lessonCleared(stars, checkpoint.id) : true;
}

/** Unit-gated: all non-checkpoint lessons of an unlocked unit are open.
 *  The checkpoint opens once every non-checkpoint lesson in the unit is cleared. */
export function isLessonUnlocked(journey: Unit[], unit: Unit, lesson: Lesson, stars: LessonStars): boolean {
  if (!isUnitUnlocked(journey, unit, stars)) return false;
  if (!lesson.isCheckpoint) return true;
  return unit.lessons.filter((l) => !l.isCheckpoint).every((l) => lessonCleared(stars, l.id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/journeyProgress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/domain/journeyProgress.ts src/domain/journeyProgress.test.ts && git commit -m "feat: journey progression rules (pure)"
```

---

### Task 3: Store — journey slice, startLesson, star recording, persist v9

**Files:**
- Modify: `src/state/gameStore.ts` (interface, freshState, action, finishRound, partialize, version, migrate)
- Test: `src/state/gameStore.test.ts` (append describe blocks)

- [ ] **Step 1: Write the failing tests**

Append to `src/state/gameStore.test.ts`:

```ts
import { JOURNEY } from '../data/journey';

describe('startLesson + journey star recording', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('startLesson resolves a lesson to its drill/level and sets currentLessonId', () => {
    useGameStore.getState().startLesson('u1-pattern');
    const s = useGameStore.getState();
    expect(s.selectedDrill).toBe('pattern');
    expect(s.selectedLevel).toBe(1);
    expect(s.currentLessonId).toBe('u1-pattern');
    expect(s.screen).toBe('drill');
  });

  it('finishRound records best stars for the current lesson and clears it', () => {
    useGameStore.getState().startLesson('u1-pattern');
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 2, correctCount: 5 });
    expect(useGameStore.getState().journey.lessonStars['u1-pattern']).toBe(2);
    expect(useGameStore.getState().currentLessonId).toBeNull();
  });

  it('replaying a lesson keeps the best stars (never lowers)', () => {
    useGameStore.getState().startLesson('u1-pattern');
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 5 });
    useGameStore.getState().startLesson('u1-pattern');
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 1, correctCount: 5 });
    expect(useGameStore.getState().journey.lessonStars['u1-pattern']).toBe(3);
  });

  it('startLesson on an unknown id is a no-op (stays on current screen)', () => {
    const before = useGameStore.getState().screen;
    useGameStore.getState().startLesson('does-not-exist');
    expect(useGameStore.getState().screen).toBe(before);
    expect(useGameStore.getState().currentLessonId).toBeNull();
  });
});

describe('persist v9 (journey)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  it('migrate backfills an empty journey on a v8 save', () => {
    const v8 = {
      pets: [{ id: 'a', species: 'leaf', hatched: true, xp: 100, happiness: 60,
        bars: { protein: 50, veggie: 50, vitamin: 50, treat: 50 },
        stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '' }],
      activePetId: 'a', coins: 0, inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    };
    const out = getMigrate()(v8, 8) as { journey: { lessonStars: Record<string, number> } };
    expect(out.journey).toEqual({ lessonStars: {} });
  });

  it('persisted slice excludes currentLessonId', () => {
    const getPartialize = (useGameStore as unknown as {
      persist: { getOptions: () => { partialize?: (s: unknown) => unknown } };
    }).persist.getOptions().partialize;
    const persisted = getPartialize!(useGameStore.getState()) as Record<string, unknown>;
    expect('currentLessonId' in persisted).toBe(false);
  });

  it('JOURNEY is referenced so seed ids are stable', () => {
    expect(JOURNEY[0].lessons[0].id).toBe('u1-pattern');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/state/gameStore.test.ts`
Expected: FAIL — `startLesson` / `currentLessonId` / `journey` not on the store.

- [ ] **Step 3: Implement the store changes**

In `src/state/gameStore.ts`:

(a) Add the import near the other data imports (top of file):

```ts
import { findLesson } from '../data/journey';
```

(b) Add to the `GameState` interface (in the state-fields block, after `lastLevelUp`):

```ts
  journey: { lessonStars: Record<string, number> };
  currentLessonId: string | null;
```

and add to the actions block (after `clearLevelUp`):

```ts
  startLesson: (lessonId: string) => void;
```

(c) Add to `freshState()` return object (after `lastLevelUp: null`):

```ts
    journey: { lessonStars: {} as Record<string, number> },
    currentLessonId: null as string | null,
```

(d) Add the `startLesson` action (place it next to `startDrill`):

```ts
      startLesson: (lessonId) =>
        set((s) => {
          const found = findLesson(lessonId);
          if (!found) return s; // unknown id — defensive no-op
          return {
            selectedDrill: found.lesson.drill,
            selectedLevel: found.lesson.level,
            currentLessonId: lessonId,
            screen: 'drill' as Screen,
          };
        }),
```

(e) Record best stars in `finishRound`. Inside the `set((s) => { ... })`, after `const group = DRILL_FOOD[drill];`, add:

```ts
          const lessonId = s.currentLessonId;
          const journey = lessonId
            ? { lessonStars: { ...s.journey.lessonStars, [lessonId]: Math.max(s.journey.lessonStars[lessonId] ?? 0, stars) } }
            : s.journey;
```

and in the returned object of `finishRound`, add these two fields (e.g. after `lastLevelUp: levelUp,`):

```ts
            journey,
            currentLessonId: null,
```

(f) Update `partialize` to also exclude `currentLessonId`:

```ts
      partialize: (s) => {
        const { lastLevelUp, currentLessonId, ...rest } = s;
        void lastLevelUp; // transient — not persisted
        void currentLessonId; // transient — not persisted
        return rest as Omit<GameState, 'lastLevelUp' | 'currentLessonId'>;
      },
```

(g) Bump `version: 8` → `version: 9`.

(h) In `migrate`, backfill `journey` on the shared `base` object. Add `journey` to the `base` spread (alongside `owned`/`activeBackground`):

```ts
        const base = {
          selectedDrill: 'pattern' as DrillType,
          ...st,
          inventory: { ...freshInventory(), ...(st.inventory ?? {}) },
          owned: st.owned ?? [],
          activeBackground: st.activeBackground ?? null,
          journey: (st as { journey?: { lessonStars?: Record<string, number> } }).journey ?? { lessonStars: {} },
        };
```

Also widen the `st` cast type to include `journey?: { lessonStars?: Record<string, number> }` (add it to the inline object type alongside `owned?`).

Update the migrate comment line to note: `// v8->v9 backfills journey { lessonStars: {} }.`

- [ ] **Step 4: Run tests + typecheck to verify pass**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/state/gameStore.test.ts && npx tsc -b`
Expected: PASS (all store tests, including prior ones) and clean typecheck.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/state/gameStore.ts src/state/gameStore.test.ts && git commit -m "feat: store journey slice, startLesson, star recording, persist v9"
```

---

### Task 4: JourneyMap component (replaces DrillPicker)

**Files:**
- Create: `src/components/JourneyMap.tsx`
- Create: `src/components/JourneyMap.test.tsx`
- Modify: `src/App.tsx` (swap `DrillPicker` → `JourneyMap` for the `pickDrill` case + import)
- Delete: `src/components/DrillPicker.tsx`, `src/components/DrillPicker.test.tsx`

The `pickDrill` screen id stays (PetRoom's "Play ▶" already routes to it). Unit cards (layout B): emoji + title + cleared/total badge + a row of node-dots. Dots: cleared (✓), available (drill-colored, tappable → `startLesson`), locked (greyed, disabled). Checkpoint dot uses a gold star style.

- [ ] **Step 1: Write the failing test**

`src/components/JourneyMap.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JourneyMap } from './JourneyMap';
import { useGameStore } from '../state/gameStore';

describe('JourneyMap', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('renders a card per unit with its title', () => {
    render(<JourneyMap />);
    expect(screen.getByText('Basics')).toBeInTheDocument();
    expect(screen.getByText('Next Steps')).toBeInTheDocument();
  });

  it('locked unit cards are present but their nodes are disabled', () => {
    render(<JourneyMap />);
    // Unit 2 "Next Steps" is locked at fresh state → its first node disabled.
    const lockedNode = screen.getByRole('button', { name: /Next Steps.*pattern/i });
    expect(lockedNode).toBeDisabled();
  });

  it('tapping an available node calls startLesson with the lesson id', () => {
    const spy = vi.spyOn(useGameStore.getState(), 'startLesson');
    render(<JourneyMap />);
    const node = screen.getByRole('button', { name: /Basics.*pattern.*not started/i });
    fireEvent.click(node);
    expect(spy).toHaveBeenCalledWith('u1-pattern');
  });

  it('a checkpoint is locked until the unit lessons are cleared', () => {
    render(<JourneyMap />);
    const checkpoint = screen.getByRole('button', { name: /Basics.*checkpoint/i });
    expect(checkpoint).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/JourneyMap.test.tsx`
Expected: FAIL — cannot resolve `./JourneyMap`.

- [ ] **Step 3: Implement the component**

`src/components/JourneyMap.tsx`:

```tsx
import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { orderedUnits } from '../data/journey';
import type { Unit, Lesson } from '../data/journey';
import { isUnitUnlocked, isLessonUnlocked, unitProgress, lessonCleared } from '../domain/journeyProgress';
import type { LessonStars } from '../domain/journeyProgress';
import { DRILL_FOOD, FOOD_META } from '../data/food';
import { PressButton } from './PressButton';

const DOT_COLOR: Record<string, string> = {
  pattern: 'bg-emerald-200 text-emerald-800',
  wordChoice: 'bg-blue-200 text-blue-800',
  grammar: 'bg-amber-200 text-amber-900',
  mixed: 'bg-pink-200 text-pink-800',
};

function lessonLabel(unit: Unit, lesson: Lesson, stars: LessonStars): string {
  const what = lesson.isCheckpoint ? 'checkpoint' : `${lesson.drill} lesson`;
  const status = lessonCleared(stars, lesson.id) ? `cleared, ${stars[lesson.id]} stars` : 'not started';
  return `${unit.title}: ${what}, ${status}`;
}

function dotContent(lesson: Lesson, stars: LessonStars): string {
  if (lessonCleared(stars, lesson.id)) return '✓';
  if (lesson.isCheckpoint) return '★';
  return FOOD_META[DRILL_FOOD[lesson.drill]].emoji;
}

export function JourneyMap() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startLesson = useGameStore((s) => s.startLesson);
  const stars = useGameStore((s) => s.journey.lessonStars);
  const units = orderedUnits();

  return (
    <div className="flex h-full flex-col bg-indigo-50 p-6">
      <div className="flex items-center justify-between pb-4">
        <PressButton
          onClick={() => setScreen('petRoom')}
          className="min-h-12 rounded-xl px-4 py-2 font-semibold text-indigo-700"
        >
          ← Back
        </PressButton>
        <h1 className="text-xl font-bold text-indigo-800">Journey</h1>
        <span className="w-16" />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {units.map((unit, index) => {
          const unlocked = isUnitUnlocked(units, unit, stars);
          const prog = unitProgress(unit, stars);
          return (
            <motion.div
              key={unit.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`rounded-2xl bg-white p-5 shadow ${unlocked ? '' : 'opacity-50'}`}
            >
              <div className="flex items-center gap-2 pb-3">
                <span className="text-2xl">{unit.emoji}</span>
                <span className="flex-1 text-lg font-semibold text-slate-800">{unit.title}</span>
                <span className="text-sm font-semibold text-slate-500">
                  {unlocked ? `${prog.cleared}/${prog.total}` : '🔒 locked'}
                </span>
              </div>
              <div className="flex gap-3">
                {unit.lessons.map((lesson) => {
                  const open = isLessonUnlocked(units, unit, lesson, stars);
                  const cleared = lessonCleared(stars, lesson.id);
                  const base = lesson.isCheckpoint
                    ? 'bg-amber-300 text-amber-900 rounded-xl'
                    : `${DOT_COLOR[lesson.drill]} rounded-full`;
                  const tone = cleared ? 'bg-emerald-300 text-emerald-900' : !open ? 'bg-slate-200 text-slate-400' : '';
                  return (
                    <PressButton
                      key={lesson.id}
                      disabled={!open}
                      aria-label={lessonLabel(unit, lesson, stars)}
                      onClick={() => startLesson(lesson.id)}
                      className={`flex h-12 w-12 items-center justify-center text-lg font-bold shadow ${base} ${tone} ${open ? '' : 'cursor-not-allowed'}`}
                    >
                      {dotContent(lesson, stars)}
                    </PressButton>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Swap the screen wiring in `src/App.tsx`**

Replace the import line:

```ts
import { DrillPicker } from './components/DrillPicker';
```

with:

```ts
import { JourneyMap } from './components/JourneyMap';
```

Replace the `pickDrill` case:

```ts
    case 'pickDrill': return { key: 'pickDrill', node: <JourneyMap /> };
```

- [ ] **Step 5: Delete the old DrillPicker**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git rm src/components/DrillPicker.tsx src/components/DrillPicker.test.tsx
```

- [ ] **Step 6: Run tests + typecheck + build**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/JourneyMap.test.tsx && npx tsc -b && npm run build`
Expected: JourneyMap tests PASS; typecheck clean; build clean.

- [ ] **Step 7: Run the full suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test`
Expected: all tests green (DrillPicker tests gone; journey tests added).

- [ ] **Step 8: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat: JourneyMap unit-card screen replaces DrillPicker"
```

---

### Task 5: Wire-up verification + docs

**Files:**
- Modify: `GAME_DESIGN.md` (note the journey supersedes free-pick level-select; keep the H: copy in sync)

- [ ] **Step 1: Add a journey note to `GAME_DESIGN.md`**

Add a short shipped-note paragraph under the curriculum/level-select section, e.g.:

```markdown
> **Themed journey (shipped):** the free-pick drill grid is replaced by a
> themed-unit journey (`src/data/journey.ts`): ordered Units → single-drill
> Lesson nodes → a Mixed checkpoint gating the next unit. Unit-gated unlock,
> per-lesson best-stars persisted (`journey.lessonStars`, persist v9), no lives,
> pet 1–50 decoupled. `JourneyMap` (unit cards) replaced `DrillPicker`.
> Checkpoint `isCheckpoint` is the seam for the B-3 boss battle; `JOURNEY` data
> is the seam for the admin backend. Spec/plan dated 2026-06-26.
```

- [ ] **Step 2: Sync the second copy**

Copy the same edit into `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md` (keep both in sync per project convention).

- [ ] **Step 3: Final full verification**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test && npx tsc -b && npm run build`
Expected: all green, clean typecheck, clean build.

- [ ] **Step 4: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add GAME_DESIGN.md && git commit -m "docs: note themed journey in GAME_DESIGN"
```

---

## Manual QA (after build — jsdom cannot see visuals)

Run `npm run dev -- --host`, then:
- Journey map shows unit cards; **Basics** open, **Next Steps** dimmed/🔒.
- Play & clear all 3 Basics lessons → the **checkpoint** dot becomes tappable → clear it → **Next Steps** unlocks. Dots flip to ✓ and show stars.
- Food bars still fill per node's drill (Pattern→protein, etc.); pet XP/level still progress; level-up confetti still fires on RewardScreen.
- Replay a cleared lesson with fewer stars → its recorded stars do **not** drop.
- Tab/keyboard: node-dots are reachable buttons with descriptive labels; locked dots are disabled.

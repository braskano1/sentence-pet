# Word-Choice Drill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Word-Choice drill (drill #2, yields 🥦 veggie) so a second nutrition bar moves and `Health = min(4 bars)` becomes a real balance hook.

**Architecture:** Reuse the existing drag/slots/round engine wholesale; the only mechanical change is salting the word tray with distractor tiles. Generalize the store's single-protein inventory into a per-food-group record, add a drill-type concept and a drill-picker screen, and render all four nutrition bars.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist) + Vitest + @dnd-kit + framer-motion.

**Spec:** `docs/superpowers/specs/2026-06-24-word-choice-drill-design.md`

**Conventions (carried from prior slices):**
- Pure logic in pure modules, tested exhaustively. Component tests are render-only (mount-without-throwing + static text). Never assert animated style values.
- Mock `canvas-confetti` in any test that transitively imports `celebrate.ts`.
- Tokens stored lowercase mid-sentence form, except `I` and acronyms.
- Run a single test file: `npm test -- --run src/path/to/file.test.ts`
- Run all: `npm test -- --run`  ·  Build: `npm run build`
- LF→CRLF git warnings are cosmetic; ignore.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/data/types.ts` | `DrillType`, `FoodGroup`, `Screen+='pickDrill'`, `DrillItem` gains `drill`/`distractors` |
| `src/data/food.ts` | NEW — `DRILL_FOOD` map, `FOOD_META`, `FOOD_GROUPS` (single source for emoji/label/bar color) |
| `src/data/wordBank.ts` | tag pattern items, +5 word-choice items, `itemsFor`, `trayWords`, `itemsForLevel` alias |
| `src/state/gameStore.ts` | inventory record, `selectedDrill`, `startDrill`, `finishRound(drill)`, `feed(group)` |
| `src/components/DrillScreen.tsx` | `drill` prop, tray from `trayWords`, route `finishRound` |
| `src/components/DrillPicker.tsx` | NEW — pick-a-drill screen |
| `src/components/PetRoom.tsx` | Play→pickDrill, per-group feed buttons |
| `src/components/StatBars.tsx` | render all 4 bars via FOOD_META |
| `src/components/RewardScreen.tsx` | show earned food group emoji |
| `src/components/EggHatch.tsx` | switch `itemsForLevel` → `itemsFor('pattern', 1)` (cleanup) |
| `src/App.tsx` | `pickDrill` case, pass `drill` to DrillScreen |

---

## Task 1: Types + food metadata

Add the new type vocabulary and the food-group metadata table. Does NOT yet touch `DrillItem` (so existing word-bank items keep compiling).

**Files:**
- Modify: `src/data/types.ts`
- Create: `src/data/food.ts`
- Test: `src/data/food.test.ts`

- [ ] **Step 1: Add types to `src/data/types.ts`**

Add `DrillType` near the top (after `PosLabel`):

```ts
export type DrillType = 'pattern' | 'wordChoice';
```

Change `Screen` to include the picker:

```ts
export type Screen = 'egg' | 'petRoom' | 'pickDrill' | 'drill' | 'reward';
```

Add `FoodGroup` at the very end of the file (after `NutritionBars`):

```ts
export type FoodGroup = keyof NutritionBars;
```

- [ ] **Step 2: Write the failing test `src/data/food.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { DRILL_FOOD, FOOD_META, FOOD_GROUPS } from './food';

describe('food mapping', () => {
  it('maps each drill to its food group', () => {
    expect(DRILL_FOOD.pattern).toBe('protein');
    expect(DRILL_FOOD.wordChoice).toBe('veggie');
  });

  it('has meta for all four food groups', () => {
    expect(FOOD_GROUPS).toEqual(['protein', 'veggie', 'vitamin', 'treat']);
    for (const g of FOOD_GROUPS) {
      expect(FOOD_META[g].emoji).toBeTruthy();
      expect(FOOD_META[g].label).toBeTruthy();
      expect(FOOD_META[g].color).toMatch(/^bg-/);
    }
  });
});
```

- [ ] **Step 3: Run it, verify it fails**

Run: `npm test -- --run src/data/food.test.ts`
Expected: FAIL — cannot resolve `./food`.

- [ ] **Step 4: Create `src/data/food.ts`**

```ts
import type { DrillType, FoodGroup } from './types';

/** Which nutrition bar each drill's food feeds. */
export const DRILL_FOOD: Record<DrillType, FoodGroup> = {
  pattern: 'protein',
  wordChoice: 'veggie',
};

export interface FoodMeta {
  emoji: string;
  label: string;
  color: string; // tailwind bg-* for the bar fill
}

export const FOOD_META: Record<FoodGroup, FoodMeta> = {
  protein: { emoji: '🥩', label: 'Protein', color: 'bg-orange-500' },
  veggie: { emoji: '🥦', label: 'Veggie', color: 'bg-green-500' },
  vitamin: { emoji: '💊', label: 'Vitamin', color: 'bg-sky-500' },
  treat: { emoji: '🍰', label: 'Treat', color: 'bg-pink-500' },
};

export const FOOD_GROUPS: FoodGroup[] = ['protein', 'veggie', 'vitamin', 'treat'];
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- --run src/data/food.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/food.ts src/data/food.test.ts
git commit -m "feat: drill/food types and food metadata table"
```

---

## Task 2: Word bank — drill tagging, distractors, helpers

Add `drill`/`distractors` to `DrillItem`, tag existing items, add 5 Word-Choice items, and the `itemsFor`/`trayWords` helpers. Keep `itemsForLevel` as a back-compat alias so `EggHatch`/`DrillScreen` keep compiling until their own tasks.

**Files:**
- Modify: `src/data/types.ts` (DrillItem fields)
- Modify: `src/data/wordBank.ts`
- Test: `src/data/wordBank.test.ts`

- [ ] **Step 1: Add fields to `DrillItem` in `src/data/types.ts`**

```ts
export interface DrillItem {
  id: string;
  drill: DrillType;     // which drill this item belongs to
  level: number;        // 1..5 (MVP uses 1, 2)
  thaiHint: string;     // shown to the kid as meaning scaffold
  slots: PosLabel[];    // POS labels shown above each slot
  answer: string[];     // correct words, in order (same length as slots)
  distractors?: string[]; // extra wrong tiles salted into the tray (Word-Choice)
}
```

- [ ] **Step 2: Update the failing test `src/data/wordBank.test.ts`**

Replace the whole file with:

```ts
import { describe, it, expect } from 'vitest';
import { WORD_BANK, itemsFor, trayWords } from './wordBank';

describe('WORD_BANK', () => {
  it('has 5 pattern items at level 1 and level 2', () => {
    expect(itemsFor('pattern', 1).length).toBe(5);
    expect(itemsFor('pattern', 2).length).toBe(5);
  });

  it('has 5 word-choice items at level 1, each with 2 distractors', () => {
    const wc = itemsFor('wordChoice', 1);
    expect(wc.length).toBe(5);
    for (const item of wc) {
      expect(item.distractors?.length).toBe(2);
    }
  });

  it('every item answer length equals its slots length', () => {
    for (const item of WORD_BANK) {
      expect(item.answer.length).toBe(item.slots.length);
    }
  });

  it('trayWords appends distractors to the answer', () => {
    const item = itemsFor('wordChoice', 1)[0];
    expect(trayWords(item)).toEqual([...item.answer, ...item.distractors!]);
  });

  it('trayWords equals the answer when there are no distractors', () => {
    const item = itemsFor('pattern', 1)[0];
    expect(trayWords(item)).toEqual(item.answer);
  });
});
```

- [ ] **Step 3: Run it, verify it fails**

Run: `npm test -- --run src/data/wordBank.test.ts`
Expected: FAIL — `itemsFor`/`trayWords` not exported.

- [ ] **Step 4: Rewrite `src/data/wordBank.ts`**

```ts
import type { DrillItem, DrillType } from './types';

// Tokens are stored in natural mid-sentence form (lowercase), EXCEPT words that
// are always capitalized mid-sentence: the pronoun "I" and acronyms like "TV".
// Sentence-initial capitalization + trailing period are applied at DISPLAY time
// via domain/sentence.ts (capitalizeFirst / renderSentence).
export const WORD_BANK: DrillItem[] = [
  // Pattern · Level 1: S + V
  { id: 'l1-1', drill: 'pattern', level: 1, thaiHint: 'ฉันวิ่ง', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] },
  { id: 'l1-2', drill: 'pattern', level: 1, thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'] },
  { id: 'l1-3', drill: 'pattern', level: 1, thaiHint: 'พวกเรานอน', slots: ['Pronoun', 'Verb'], answer: ['we', 'sleep'] },
  { id: 'l1-4', drill: 'pattern', level: 1, thaiHint: 'เธอเดิน', slots: ['Pronoun', 'Verb'], answer: ['she', 'walks'] },
  { id: 'l1-5', drill: 'pattern', level: 1, thaiHint: 'พวกเขาเล่น', slots: ['Pronoun', 'Verb'], answer: ['they', 'play'] },
  // Pattern · Level 2: S + V + O
  { id: 'l2-1', drill: 'pattern', level: 2, thaiHint: 'ฉันกินข้าว', slots: ['Pronoun', 'Verb', 'Object'], answer: ['I', 'eat', 'rice'] },
  { id: 'l2-2', drill: 'pattern', level: 2, thaiHint: 'เขาดื่มน้ำ', slots: ['Pronoun', 'Verb', 'Object'], answer: ['he', 'drinks', 'water'] },
  { id: 'l2-3', drill: 'pattern', level: 2, thaiHint: 'เธออ่านหนังสือ', slots: ['Pronoun', 'Verb', 'Object'], answer: ['she', 'reads', 'a book'] },
  { id: 'l2-4', drill: 'pattern', level: 2, thaiHint: 'พวกเราเล่นฟุตบอล', slots: ['Pronoun', 'Verb', 'Object'], answer: ['we', 'play', 'football'] },
  { id: 'l2-5', drill: 'pattern', level: 2, thaiHint: 'พวกเขาดูทีวี', slots: ['Pronoun', 'Verb', 'Object'], answer: ['they', 'watch', 'TV'] },
  // Word-Choice · Level 1: same S+V frames, tray salted with 2 conjugation distractors
  { id: 'wc-l1-1', drill: 'wordChoice', level: 1, thaiHint: 'ฉันวิ่ง', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'], distractors: ['runs', 'running'] },
  { id: 'wc-l1-2', drill: 'wordChoice', level: 1, thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'], distractors: ['eat', 'eating'] },
  { id: 'wc-l1-3', drill: 'wordChoice', level: 1, thaiHint: 'พวกเรานอน', slots: ['Pronoun', 'Verb'], answer: ['we', 'sleep'], distractors: ['sleeps', 'sleeping'] },
  { id: 'wc-l1-4', drill: 'wordChoice', level: 1, thaiHint: 'เธอเดิน', slots: ['Pronoun', 'Verb'], answer: ['she', 'walks'], distractors: ['walk', 'walking'] },
  { id: 'wc-l1-5', drill: 'wordChoice', level: 1, thaiHint: 'พวกเขาเล่น', slots: ['Pronoun', 'Verb'], answer: ['they', 'play'], distractors: ['plays', 'playing'] },
];

export function itemsFor(drill: DrillType, level: number): DrillItem[] {
  return WORD_BANK.filter((i) => i.drill === drill && i.level === level);
}

/** Tiles for an item's tray: the answer words plus any distractors (component shuffles). */
export function trayWords(item: DrillItem): string[] {
  return [...item.answer, ...(item.distractors ?? [])];
}

/** Back-compat: existing callers that only want pattern items by level. */
export function itemsForLevel(level: number): DrillItem[] {
  return itemsFor('pattern', level);
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- --run src/data/wordBank.test.ts`
Expected: PASS. Then `npm test -- --run` to confirm EggHatch/DrillScreen (via the alias) still green.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/wordBank.ts src/data/wordBank.test.ts
git commit -m "feat: tag drill items, add word-choice bank with distractors"
```

---

## Task 3: Distractor-in-slot regression guard (round engine)

The round engine already rejects a distractor via exact-match; lock that behavior with a test. (No production code changes — this guards the reused engine under the new salted-tray scenario.)

**Files:**
- Test: `src/domain/round.test.ts`

- [ ] **Step 1: Add the guard test to `src/domain/round.test.ts`**

Inside the existing `describe('resolveRound', ...)` block, add:

```ts
  it('a distractor placed in a slot -> retry', () => {
    // answer is ['I','run']; 'runs' is a Word-Choice distractor
    const action = resolveRound({ filled: ['I', 'runs'], answer, index: 0, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'retry' });
  });
```

- [ ] **Step 2: Run tests, verify pass**

Run: `npm test -- --run src/domain/round.test.ts`
Expected: PASS (engine already correct).

- [ ] **Step 3: Commit**

```bash
git add src/domain/round.test.ts
git commit -m "test: guard distractor placement rejects via round engine"
```

---

## Task 4: Store — per-group inventory, drill routing, feeding

Generalize inventory to a per-food-group record, add drill selection, route food by drill, and feed a single group.

**Files:**
- Modify: `src/state/gameStore.ts`
- Test: `src/state/gameStore.test.ts`

- [ ] **Step 1: Update the failing test `src/state/gameStore.test.ts`**

Replace the `finishRound`/`feedAll` tests (and keep the others). The full file:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';

function reset() {
  useGameStore.getState().resetForTest();
}

describe('gameStore', () => {
  beforeEach(reset);

  it('starts on the egg screen, not hatched', () => {
    const s = useGameStore.getState();
    expect(s.screen).toBe('egg');
    expect(s.pet.hatched).toBe(false);
    expect(s.pet.xp).toBe(0);
  });

  it('hatch() marks hatched and moves to petRoom', () => {
    useGameStore.getState().hatch();
    const s = useGameStore.getState();
    expect(s.pet.hatched).toBe(true);
    expect(s.screen).toBe('petRoom');
  });

  it('startDrill selects the drill and opens the drill screen', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().startDrill('wordChoice');
    const s = useGameStore.getState();
    expect(s.selectedDrill).toBe('wordChoice');
    expect(s.screen).toBe('drill');
  });

  it('finishRound (pattern) adds xp, protein food, coins and decays stats', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 5 });
    const s = useGameStore.getState();
    expect(s.pet.xp).toBe(50);                 // 5 correct * (10*level=10)
    expect(s.inventory.protein).toBe(5);        // 1 food per correct
    expect(s.pet.coins).toBe(25);               // 10 + 5*3
    expect(s.pet.bars.protein).toBe(55);        // 60 - 5 decay
    expect(s.lastReward).toEqual({ level: 1, stars: 3, food: 5, coins: 25, group: 'protein' });
  });

  it('finishRound (wordChoice) routes food to the veggie group', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'wordChoice', level: 1, stars: 3, correctCount: 5 });
    const s = useGameStore.getState();
    expect(s.inventory.veggie).toBe(5);
    expect(s.inventory.protein).toBe(0);
    expect(s.lastReward?.group).toBe('veggie');
  });

  it('feed(group) moves that food into its bar and clears only that group', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'wordChoice', level: 1, stars: 3, correctCount: 5 });
    useGameStore.getState().feed('veggie');
    const s = useGameStore.getState();
    expect(s.inventory.veggie).toBe(0);
    expect(s.pet.bars.veggie).toBe(100);        // 55 + 75 capped at 100
    expect(s.pet.bars.protein).toBe(55);        // untouched
  });

  it('xp at/over young threshold reports young stage', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().addXpForTest(1000);
    expect(useGameStore.getState().stage()).toBe('young');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: FAIL — `startDrill`/`feed`/`selectedDrill` missing, `finishRound` signature mismatch.

- [ ] **Step 3: Rewrite `src/state/gameStore.ts`**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GAME_CONFIG } from '../config/gameConfig';
import { DRILL_FOOD } from '../data/food';
import type { DrillType, FoodGroup, NutritionBars, PetStage, Screen } from '../data/types';
import { decayBars, decayHappiness, feedBar } from '../domain/pet';
import { stageForXp, xpForLevel } from '../domain/xp';

interface Pet {
  hatched: boolean;
  xp: number;
  coins: number;
  happiness: number;
  bars: NutritionBars;
}

interface RewardSummary {
  level: number;
  stars: number;
  food: number;
  coins: number;
  group: FoodGroup;
}

interface RoundResult {
  drill: DrillType;
  level: number;
  stars: number;
  correctCount: number;
}

interface GameState {
  screen: Screen;
  pet: Pet;
  inventory: Record<FoodGroup, number>;
  selectedDrill: DrillType;
  lastReward: RewardSummary | null;
  // actions
  setScreen: (s: Screen) => void;
  hatch: () => void;
  startDrill: (drill: DrillType) => void;
  finishRound: (r: RoundResult) => void;
  feed: (group: FoodGroup) => void;
  stage: () => PetStage;
  // test helpers
  addXpForTest: (xp: number) => void;
  resetForTest: () => void;
}

function freshPet(): Pet {
  return {
    hatched: false,
    xp: 0,
    coins: 0,
    happiness: GAME_CONFIG.happiness.start,
    bars: {
      protein: GAME_CONFIG.bars.start,
      veggie: GAME_CONFIG.bars.start,
      vitamin: GAME_CONFIG.bars.start,
      treat: GAME_CONFIG.bars.start,
    },
  };
}

function freshInventory(): Record<FoodGroup, number> {
  return { protein: 0, veggie: 0, vitamin: 0, treat: 0 };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'egg',
      pet: freshPet(),
      inventory: freshInventory(),
      selectedDrill: 'pattern',
      lastReward: null,

      setScreen: (screen) => set({ screen }),

      hatch: () =>
        set((st) => ({ pet: { ...st.pet, hatched: true }, screen: 'petRoom' })),

      startDrill: (drill) => set({ selectedDrill: drill, screen: 'drill' }),

      finishRound: ({ drill, level, stars, correctCount }) =>
        set((st) => {
          const group = DRILL_FOOD[drill];
          const xpGain = correctCount * xpForLevel(level);
          const coinsGain = GAME_CONFIG.coins.base + GAME_CONFIG.coins.perStar * stars;
          const happiness = decayHappiness(st.pet.happiness) + GAME_CONFIG.happiness.onClear +
            (stars === 3 ? GAME_CONFIG.happiness.onThreeStars : 0);
          return {
            pet: {
              ...st.pet,
              xp: st.pet.xp + xpGain,
              coins: st.pet.coins + coinsGain,
              happiness: Math.min(GAME_CONFIG.happiness.max, happiness),
              bars: decayBars(st.pet.bars),
            },
            inventory: { ...st.inventory, [group]: st.inventory[group] + correctCount },
            lastReward: { level, stars, food: correctCount, coins: coinsGain, group },
            screen: 'reward',
          };
        }),

      feed: (group) =>
        set((st) => ({
          pet: { ...st.pet, bars: feedBar(st.pet.bars, group, st.inventory[group]) },
          inventory: { ...st.inventory, [group]: 0 },
        })),

      stage: () => stageForXp(get().pet.xp, get().pet.hatched),

      addXpForTest: (xp) => set((st) => ({ pet: { ...st.pet, xp: st.pet.xp + xp } })),
      resetForTest: () =>
        set({
          screen: 'egg',
          pet: freshPet(),
          inventory: freshInventory(),
          selectedDrill: 'pattern',
          lastReward: null,
        }),
    }),
    {
      name: 'sentence-pet',
      version: 2,
      // v1 persisted inventory was { protein } only; backfill the new groups.
      migrate: (persisted: unknown) => {
        const st = persisted as { inventory?: Partial<Record<FoodGroup, number>> } | null;
        if (st && st.inventory) {
          st.inventory = { ...freshInventory(), ...st.inventory };
        }
        return st as GameState;
      },
    },
  ),
);
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: PASS. (Other suites referencing the old `finishRound`/`feedAll` — PetRoom, DrillScreen — are updated in later tasks; expect those red until then. Do NOT run the full suite green-gate here.)

- [ ] **Step 5: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat: per-group inventory, drill selection, food routing, feed(group)"
```

---

## Task 5: DrillScreen — drill prop + salted tray

Make the drill screen drill-aware: load items for the chosen drill, build the tray from `trayWords` (answer + distractors), and pass `drill` to `finishRound`.

**Files:**
- Modify: `src/components/DrillScreen.tsx`
- Test: `src/components/DrillScreen.test.tsx`

- [ ] **Step 1: Update the failing test `src/components/DrillScreen.test.tsx`**

Replace the file with:

```tsx
// src/components/DrillScreen.test.tsx
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { DrillScreen } from './DrillScreen';
import { useGameStore } from '../state/gameStore';

describe('DrillScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders the Thai hint and the POS slots for the first item', () => {
    render(<DrillScreen drill="pattern" level={1} />);
    expect(screen.getByText(/Sentence 1 of 5/)).toBeInTheDocument();
    expect(screen.getAllByText('Pronoun').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Verb').length).toBeGreaterThan(0);
  });

  it('renders a draggable tile for each answer word', () => {
    render(<DrillScreen drill="pattern" level={1} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('word-choice tray includes distractor tiles (more than the answer)', () => {
    render(<DrillScreen drill="wordChoice" level={1} />);
    const buttons = screen.getAllByRole('button');
    // 2 answer + 2 distractors => at least 4 tiles
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('mounts inside a DndContext without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <DrillScreen drill="pattern" level={2} />
        </DndContext>,
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- --run src/components/DrillScreen.test.tsx`
Expected: FAIL — `DrillScreen` requires a `drill` prop / still uses `itemsForLevel`.

- [ ] **Step 3: Edit `src/components/DrillScreen.tsx`**

Change the import line (was `itemsForLevel`):

```ts
import { itemsFor, trayWords } from '../data/wordBank';
```

Add the type import (alongside the other imports):

```ts
import type { DrillType } from '../data/types';
```

Change the signature and the items/initial-state lines:

```ts
export function DrillScreen({ drill, level }: { drill: DrillType; level: number }) {
  const items = useMemo(() => itemsFor(drill, level), [drill, level]);
  const finishRound = useGameStore((s) => s.finishRound);

  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<(string | null)[]>(() => items[0].slots.map(() => null));
  const [tiles, setTiles] = useState<string[]>(() => shuffle(trayWords(items[0])));
  const [used, setUsed] = useState<boolean[]>(() => trayWords(items[0]).map(() => false));
  const [mistakes, setMistakes] = useState(0);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const { feedback, play, locked } = useRoundFeedback();
```

Update `loadItem`:

```ts
  function loadItem(i: number) {
    setPlaced(items[i].slots.map(() => null));
    setTiles(shuffle(trayWords(items[i])));
    setUsed(trayWords(items[i]).map(() => false));
  }
```

Update the `finish` branch in `applyAction` to pass `drill`:

```ts
      case 'finish':
        finishRound({ drill, level, stars: action.stars, correctCount: items.length });
        break;
```

(The `evaluate`/`resolveRound`/clear logic is unchanged — `placeTile`, `used`, and `isPlacementCorrect` already key off `tiles[index]`, which is now length M.)

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- --run src/components/DrillScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DrillScreen.tsx src/components/DrillScreen.test.tsx
git commit -m "feat: DrillScreen drill prop and salted tray via trayWords"
```

---

## Task 6: DrillPicker screen

New screen: pick a drill, which calls `startDrill`.

**Files:**
- Create: `src/components/DrillPicker.tsx`
- Test: `src/components/DrillPicker.test.tsx`

- [ ] **Step 1: Write the failing test `src/components/DrillPicker.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { DrillPicker } from './DrillPicker';
import { useGameStore } from '../state/gameStore';

beforeEach(() => useGameStore.getState().resetForTest());

describe('DrillPicker', () => {
  it('shows a card for each drill', () => {
    render(<DrillPicker />);
    expect(screen.getByText('Pattern')).toBeInTheDocument();
    expect(screen.getByText('Word Choice')).toBeInTheDocument();
  });

  it('picking a drill starts it', async () => {
    render(<DrillPicker />);
    await userEvent.click(screen.getByText('Word Choice'));
    const s = useGameStore.getState();
    expect(s.selectedDrill).toBe('wordChoice');
    expect(s.screen).toBe('drill');
  });

  it('Back returns to the pet room', async () => {
    render(<DrillPicker />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- --run src/components/DrillPicker.test.tsx`
Expected: FAIL — cannot resolve `./DrillPicker`.

- [ ] **Step 3: Create `src/components/DrillPicker.tsx`**

```tsx
import { useGameStore } from '../state/gameStore';
import { DRILL_FOOD, FOOD_META } from '../data/food';
import type { DrillType } from '../data/types';

const DRILLS: { drill: DrillType; title: string }[] = [
  { drill: 'pattern', title: 'Pattern' },
  { drill: 'wordChoice', title: 'Word Choice' },
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
          return (
            <button
              key={drill}
              onClick={() => startDrill(drill)}
              className="flex min-h-12 items-center gap-4 rounded-2xl bg-white p-6 text-left shadow"
            >
              <span className="text-4xl">{meta.emoji}</span>
              <span>
                <span className="block text-lg font-semibold text-slate-800">{title}</span>
                <span className="text-sm text-slate-500">Earns {meta.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- --run src/components/DrillPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DrillPicker.tsx src/components/DrillPicker.test.tsx
git commit -m "feat: drill picker screen"
```

---

## Task 7: PetRoom — per-group feed buttons + Play routes to picker

**Files:**
- Modify: `src/components/PetRoom.tsx`
- Test: `src/components/PetRoom.test.tsx`

- [ ] **Step 1: Update the failing test `src/components/PetRoom.test.tsx`**

Replace the file with:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PetRoom } from './PetRoom';
import { useGameStore } from '../state/gameStore';

beforeEach(() => useGameStore.getState().resetForTest());

describe('PetRoom', () => {
  it('a feed button consumes that food group into its bar', async () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'wordChoice', level: 1, stars: 3, correctCount: 5 });
    useGameStore.getState().setScreen('petRoom');
    render(<PetRoom />);
    await userEvent.click(screen.getByRole('button', { name: /feed/i }));
    expect(useGameStore.getState().inventory.veggie).toBe(0);
  });

  it('Play opens the drill picker', async () => {
    useGameStore.getState().hatch();
    render(<PetRoom />);
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(useGameStore.getState().screen).toBe('pickDrill');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- --run src/components/PetRoom.test.tsx`
Expected: FAIL — `feedAll` gone / Play still routes to `drill`.

- [ ] **Step 3: Rewrite `src/components/PetRoom.tsx`**

```tsx
import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { PetSprite } from './PetSprite';
import { StatBars } from './StatBars';
import { useCountUp } from '../effects/useCountUp';
import { FOOD_GROUPS, FOOD_META } from '../data/food';

export function PetRoom() {
  const pet = useGameStore((s) => s.pet);
  const inventory = useGameStore((s) => s.inventory);
  const stage = useGameStore((s) => s.stage());
  const feed = useGameStore((s) => s.feed);
  const setScreen = useGameStore((s) => s.setScreen);
  const [feedTrigger, setFeedTrigger] = useState(0);

  const xp = useCountUp(pet.xp);
  const coins = useCountUp(pet.coins);

  const available = FOOD_GROUPS.filter((g) => inventory[g] > 0);

  return (
    <div className="flex h-full flex-col bg-emerald-50 p-6">
      {/* middle zone: pet + stats, centered, grabs slack */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <PetSprite stage={stage} feedTrigger={feedTrigger} />
        <p className="text-slate-500">XP {xp} · 🪙 {coins}</p>
        <StatBars bars={pet.bars} happiness={pet.happiness} />
      </div>
      {/* bottom zone: actions pinned in the thumb arc */}
      <div className="flex flex-col gap-3">
        {available.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {available.map((g) => (
              <button
                key={g}
                onClick={() => {
                  feed(g);
                  setFeedTrigger((n) => n + 1);
                }}
                className="min-h-12 flex-1 rounded-xl bg-orange-500 px-4 py-3 text-base font-semibold text-white shadow"
              >
                Feed {FOOD_META[g].emoji} ({inventory[g]})
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setScreen('pickDrill')}
          className="min-h-12 w-full rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow"
        >
          Play ▶
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- --run src/components/PetRoom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PetRoom.tsx src/components/PetRoom.test.tsx
git commit -m "feat: per-group feed buttons; Play opens drill picker"
```

---

## Task 8: StatBars — show all four nutrition bars

**Files:**
- Modify: `src/components/StatBars.tsx`
- Test: `src/components/StatBars.test.tsx`

- [ ] **Step 1: Update the failing test `src/components/StatBars.test.tsx`**

Replace the file with:

```tsx
// src/components/StatBars.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatBars } from './StatBars';

describe('StatBars', () => {
  const bars = { protein: 50, veggie: 50, vitamin: 50, treat: 50 };

  it('renders Health, Happiness and all four nutrition bars', () => {
    render(<StatBars bars={bars} happiness={42} />);
    expect(screen.getByText(/Health/)).toBeInTheDocument();
    expect(screen.getByText(/Happiness/)).toBeInTheDocument();
    expect(screen.getByText(/Protein/)).toBeInTheDocument();
    expect(screen.getByText(/Veggie/)).toBeInTheDocument();
    expect(screen.getByText(/Vitamin/)).toBeInTheDocument();
    expect(screen.getByText(/Treat/)).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- --run src/components/StatBars.test.tsx`
Expected: FAIL — Veggie/Vitamin/Treat not rendered.

- [ ] **Step 3: Edit `src/components/StatBars.tsx`**

Add the import:

```ts
import { FOOD_GROUPS, FOOD_META } from '../data/food';
```

Replace the `StatBars` function (keep the `Bar` component unchanged):

```tsx
export function StatBars({ bars, happiness }: { bars: NutritionBars; happiness: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Bar label="❤️ Health" value={health(bars)} color="bg-rose-500" />
      <Bar label="😊 Happiness" value={happiness} color="bg-yellow-400" />
      {FOOD_GROUPS.map((g) => (
        <Bar
          key={g}
          label={`${FOOD_META[g].emoji} ${FOOD_META[g].label}`}
          value={bars[g]}
          color={FOOD_META[g].color}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- --run src/components/StatBars.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatBars.tsx src/components/StatBars.test.tsx
git commit -m "feat: StatBars renders all four nutrition bars"
```

---

## Task 9: RewardScreen — show earned food group

**Files:**
- Modify: `src/components/RewardScreen.tsx`
- Test: `src/components/RewardScreen.test.tsx`

- [ ] **Step 1: Update the failing test `src/components/RewardScreen.test.tsx`**

Replace the two `setState` lines to include `group`, and add a veggie assertion. Full file:

```tsx
// src/components/RewardScreen.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { RewardScreen } from './RewardScreen';
import { useGameStore } from '../state/gameStore';

describe('RewardScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders nothing when there is no reward', () => {
    const { container } = render(<RewardScreen />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the earned food group (protein) when present', () => {
    useGameStore.setState({ lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'protein' } });
    render(<RewardScreen />);
    expect(screen.getByText(/Level cleared/)).toBeInTheDocument();
    expect(screen.getByText(/protein/i)).toBeInTheDocument();
    expect(screen.getByText(/coins/)).toBeInTheDocument();
  });

  it('shows veggie for a word-choice reward', () => {
    useGameStore.setState({ lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'veggie' } });
    render(<RewardScreen />);
    expect(screen.getByText(/veggie/i)).toBeInTheDocument();
  });

  it('navigates to petRoom when Continue is clicked', async () => {
    useGameStore.setState({ lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'protein' } });
    render(<RewardScreen />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- --run src/components/RewardScreen.test.tsx`
Expected: FAIL — the veggie case (still hardcoded 🥩 protein).

- [ ] **Step 3: Edit `src/components/RewardScreen.tsx`**

Add the import:

```ts
import { FOOD_META } from '../data/food';
```

After the `if (!reward) return null;` line, derive the food meta (fallback guards any pre-migration reward without `group`):

```ts
  const meta = FOOD_META[reward.group] ?? FOOD_META.protein;
```

Replace the protein line:

```tsx
        <motion.p variants={item} className="text-lg text-slate-700">
          You earned {food} {meta.emoji} {meta.label.toLowerCase()}
        </motion.p>
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- --run src/components/RewardScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/RewardScreen.tsx src/components/RewardScreen.test.tsx
git commit -m "feat: reward screen shows the earned food group"
```

---

## Task 10: Wire into App + EggHatch cleanup + full green

Route the new `pickDrill` screen, pass the selected drill to `DrillScreen`, switch `EggHatch` off the alias, remove the `itemsForLevel` alias, then verify the whole suite + build.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/EggHatch.tsx`
- Modify: `src/data/wordBank.ts` (remove alias)

- [ ] **Step 1: Edit `src/App.tsx`**

Add the import:

```ts
import { DrillPicker } from './components/DrillPicker';
```

Replace `screenKeyAndNode` and read `selectedDrill` in `CurrentScreen`:

```tsx
function screenKeyAndNode(screen: string, hatched: boolean, drill: DrillType) {
  if (!hatched) return { key: 'egg', node: <EggHatch /> };
  switch (screen) {
    case 'pickDrill': return { key: 'pickDrill', node: <DrillPicker /> };
    case 'drill': return { key: 'drill', node: <DrillScreen drill={drill} level={1} /> };
    case 'reward': return { key: 'reward', node: <RewardScreen /> };
    case 'petRoom':
    default: return { key: 'petRoom', node: <PetRoom /> };
  }
}

function CurrentScreen() {
  const screen = useGameStore((s) => s.screen);
  const hatched = useGameStore((s) => s.pet.hatched);
  const drill = useGameStore((s) => s.selectedDrill);
  const { key, node } = screenKeyAndNode(screen, hatched, drill);
  // ...unchanged AnimatePresence/motion.div wrapper...
```

Add the type import at the top:

```ts
import type { DrillType } from './data/types';
```

- [ ] **Step 2: Edit `src/components/EggHatch.tsx`**

Change the import:

```ts
import { itemsFor } from '../data/wordBank';
```

Change the item line:

```ts
  const item = useMemo(() => itemsFor('pattern', 1)[0], []);
```

- [ ] **Step 3: Remove the alias from `src/data/wordBank.ts`**

Delete the `itemsForLevel` function (the back-compat alias added in Task 2). `itemsFor` and `trayWords` remain.

- [ ] **Step 4: Run the full suite + build**

Run: `npm test -- --run`
Expected: ALL PASS (was 77; now higher with the new tests).

Run: `npm run build`
Expected: clean build, no TS errors.

Run: `npx tsc --noEmit` (belt-and-suspenders type check)
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/EggHatch.tsx src/data/wordBank.ts
git commit -m "feat: wire drill picker into App; route selected drill; drop itemsForLevel alias"
```

---

## Manual verification (after Task 10)

Run `npm run dev`, open the local URL in a phone-portrait viewport, and confirm:
1. Egg hatch still works (one sentence → pet).
2. Play → drill picker shows Pattern 🥩 + Word Choice 🥦.
3. Word Choice round: tray has extra (distractor) tiles; placing a wrong tile shakes + retries; a correct round → reward shows 🥦 veggie.
4. PetRoom shows separate Feed 🥩 / Feed 🥦 buttons sized to inventory; feeding raises the matching bar; Health (= min of 4 bars) reflects the lowest bar.
5. StatBars shows all four bars + Health + Happiness.

---

## Self-Review

**Spec coverage:**
- Salted-tray mechanic → Task 5 (+ guard Task 3). ✓
- `DrillType`/`FoodGroup`/`Screen`/`DrillItem` fields → Tasks 1–2. ✓
- `food.ts` `DRILL_FOOD`/`FOOD_META` → Task 1. ✓
- 5 word-choice items, 2 distractors, `itemsFor`/`trayWords` → Task 2. ✓
- Store: inventory record, `selectedDrill`, `startDrill`, `finishRound(drill)`, `feed(group)`, `lastReward.group`, persist migration → Task 4. ✓
- DrillPicker screen → Task 6. ✓
- PetRoom per-group feed + Play→pickDrill → Task 7. ✓
- StatBars 4 bars → Task 8. ✓
- RewardScreen group emoji → Task 9. ✓
- App wiring → Task 10. ✓

**Placeholder scan:** none — every code step shows full code.

**Type consistency:** `DrillType`, `FoodGroup`, `DRILL_FOOD`, `FOOD_META`, `FOOD_GROUPS`, `itemsFor(drill, level)`, `trayWords(item)`, `startDrill(drill)`, `feed(group)`, `finishRound({drill,level,stars,correctCount})`, `lastReward.group` are consistent across all tasks.

**Green-state note:** After Task 4, the PetRoom/DrillScreen suites are temporarily red (they still call the old API) until Tasks 5/7 update them. This is expected mid-plan; the full suite is green again at Task 10. Each task's own targeted test file is green at its commit.

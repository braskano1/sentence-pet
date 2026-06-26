# Drill Page Redesign ("Living Drill") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the in-round sentence-building screen with tap-to-place, POS-colored slots, a centre-stage live pet, a cosmetic streak + star track, inline data-driven why-wrong, partial retry, per-word/Thai/sentence audio, and a 💡 hint — without changing scoring, content, or persistence.

**Architecture:** New pure helpers in `domain/` (tap placement, per-slot grading) and `config/` (POS colors, speech seam) are built and tested first. Then leaf presentational components (`drill/DrillHeader`, `drill/DrillPet`, `drill/WhyTip`, `drill/HintButton`) and the updated shared `SentenceSlots`/`WordTray`. Finally `DrillScreen` wires them together and `EggHatch` inherits the tap+colors+audio subset. Audio runs over the Web Speech API behind a swappable provider; it no-ops in jsdom and where unsupported.

**Tech Stack:** React 19, TypeScript, Tailwind v4, framer-motion 12, @dnd-kit, Zustand, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-26-drill-page-redesign-design.md`

**Conventions (carry forward):**
- Build dir = `D:\ai_projects\AI_design_thinking\sentence-pet`. Branch `drill-redesign` (already created off `main`).
- Bash tool is POSIX bash (prefix `cd "D:\ai_projects\AI_design_thinking\sentence-pet" &&`); PowerShell needs `Set-Location` first. Both reset cwd between calls.
- Typecheck = `npx tsc -b`. Tests = `npx vitest run <path>`. Full build = `npm run build`.
- jsdom can't run framer-motion: component tests mock it (see `src/App.test.tsx` and the menu tests for the Proxy mock).
- Commit after each task.

**Note on the approved mock vs. truth:** the mock showed POS-colored *tray tiles*. The data has no per-distractor POS, so coloring every tray tile would mislabel distractors. Correct version: **slots and placed words are POS-colored**; tray tiles stay one inviting color and adopt the slot color once placed. Same "structure is visible" payoff, honest.

**Audio placement refinement:** the full English sentence is spoken **on each accepted answer in `DrillScreen`** (right as the built sentence is confirmed), not on the RewardScreen — this avoids threading the solved sentence through the store and keeps "no store change".

---

## File structure

```
src/
  config/
    posColors.ts          // NEW: PosLabel -> Tailwind chip classes (+ fallback)
    posColors.test.ts     // NEW
    audio.ts              // NEW: SpeechProvider + Web Speech impl + no-op + getSpeechProvider()
    audio.test.ts         // NEW
  hooks/
    useSpeech.ts          // NEW: memoized speakWord/speakThai/speakSentence
    useSpeech.test.ts     // NEW
  domain/
    placement.ts          // MODIFY: + currentSlotIndex, + tapPlace
    placement.test.ts     // MODIFY: + new cases
    grade.ts              // MODIFY: + slotResults
    grade.test.ts         // MODIFY: + slotResults cases
    round.ts              // MODIFY: 'retry' carries wrongSlots + tip
    round.test.ts         // MODIFY: retry shape
  components/
    SentenceSlots.tsx     // MODIFY: POS colors + current-slot glow
    SentenceSlots.test.tsx// MODIFY
    WordTray.tsx          // MODIFY: onTapPlace + larger press
    WordTray.test.tsx     // MODIFY
    DrillScreen.tsx       // MODIFY: orchestration + new layout
    DrillScreen.test.tsx  // MODIFY
    EggHatch.tsx          // MODIFY: tap + audio (colors inherited)
    drill/
      DrillHeader.tsx     // NEW
      DrillHeader.test.tsx// NEW
      DrillPet.tsx        // NEW
      DrillPet.test.tsx   // NEW
      WhyTip.tsx          // NEW
      WhyTip.test.tsx     // NEW
      HintButton.tsx      // NEW
      HintButton.test.tsx // NEW
```

---

## Task 1: POS color map

**Files:**
- Create: `src/config/posColors.ts`
- Test: `src/config/posColors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/config/posColors.test.ts
import { describe, it, expect } from 'vitest';
import { posClasses } from './posColors';

describe('posClasses', () => {
  it('maps known parts of speech to their hue', () => {
    expect(posClasses('Pronoun')).toContain('sky');
    expect(posClasses('Verb')).toContain('emerald');
    expect(posClasses('Object')).toContain('amber');
  });
  it('falls back to slate for unknown labels', () => {
    expect(posClasses('Adverb')).toContain('slate');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/config/posColors.test.ts`
Expected: FAIL ("posClasses" not exported).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/config/posColors.ts
import type { PosLabel } from '../data/types';

/** Tailwind chip classes (bg + text + border) for a POS-colored slot or placed word. */
const MAP: Record<PosLabel, string> = {
  Pronoun: 'bg-sky-100 text-sky-900 border-sky-300',
  Verb: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  Object: 'bg-amber-100 text-amber-900 border-amber-300',
};

const FALLBACK = 'bg-slate-100 text-slate-900 border-slate-300';

export function posClasses(label: PosLabel | string): string {
  return (MAP as Record<string, string>)[label] ?? FALLBACK;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/config/posColors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/config/posColors.ts src/config/posColors.test.ts && git commit -m "feat(drill): POS color map for slots and placed words"
```

---

## Task 2: Tap placement helpers

**Files:**
- Modify: `src/domain/placement.ts`
- Test: `src/domain/placement.test.ts`

- [ ] **Step 1: Write the failing test (append to the existing describe block)**

```ts
// src/domain/placement.test.ts — append
import { currentSlotIndex, tapPlace } from './placement';

describe('currentSlotIndex', () => {
  it('returns the leftmost empty slot', () => {
    expect(currentSlotIndex([null, null])).toBe(0);
    expect(currentSlotIndex(['She', null, null])).toBe(1);
  });
  it('returns -1 when full', () => {
    expect(currentSlotIndex(['She', 'feeds'])).toBe(-1);
  });
});

describe('tapPlace', () => {
  const tiles = ['She', 'feeds', 'the cat'];
  it('places a tile into the current (leftmost empty) slot', () => {
    const state = { placed: ['She', null, null] as (string | null)[], used: [true, false, false] };
    const next = tapPlace(state, tiles, 1);
    expect(next.placed).toEqual(['She', 'feeds', null]);
    expect(next.used).toEqual([true, true, false]);
  });
  it('is a no-op (same ref) when the sentence is full', () => {
    const state = { placed: ['She', 'feeds', 'the cat'] as (string | null)[], used: [true, true, true] };
    expect(tapPlace(state, tiles, 0)).toBe(state);
  });
  it('is a no-op when the tile is already used', () => {
    const state = { placed: [null, null, null] as (string | null)[], used: [true, false, false] };
    expect(tapPlace(state, tiles, 0)).toBe(state);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/placement.test.ts`
Expected: FAIL ("currentSlotIndex"/"tapPlace" not exported).

- [ ] **Step 3: Write minimal implementation (append to `placement.ts`)**

```ts
// src/domain/placement.ts — append

/** Index of the leftmost empty slot, or -1 when the sentence is full. */
export function currentSlotIndex(placed: (string | null)[]): number {
  return placed.findIndex((p) => p === null);
}

/**
 * Tap-to-place: drop the tile at `tileIndex` into the current (leftmost empty) slot.
 * No-op (same ref) when full or the tile is used — mirrors placeTile's contract.
 */
export function tapPlace(state: PlacementState, tiles: string[], tileIndex: number): PlacementState {
  const slot = currentSlotIndex(state.placed);
  if (slot === -1) return state;
  return placeTile(state, tiles, tileIndex, slot);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/placement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/domain/placement.ts src/domain/placement.test.ts && git commit -m "feat(drill): tapPlace + currentSlotIndex helpers"
```

---

## Task 3: Per-slot grading + retry payload

**Files:**
- Modify: `src/domain/grade.ts`, `src/domain/round.ts`
- Test: `src/domain/grade.test.ts`, `src/domain/round.test.ts`

- [ ] **Step 1: Write the failing grade test (append)**

```ts
// src/domain/grade.test.ts — append
import { slotResults } from './grade';

describe('slotResults', () => {
  const item = {
    answer: ['She', 'feeds', 'the cat'],
    traps: [{ slot: 1, word: 'feed', tip: 'feeds (he/she) takes -s' }],
    strictness: undefined as 'flag' | 'enforce' | undefined,
  };
  it('marks exact matches ok and others wrong', () => {
    expect(slotResults(['She', 'eats', 'the cat'], item)).toEqual(['ok', 'wrong', 'ok']);
  });
  it('treats an accepted near-miss trap (non-enforce) as ok', () => {
    expect(slotResults(['She', 'feed', 'the cat'], item)).toEqual(['ok', 'ok', 'ok']);
  });
  it('treats a trap under enforce as wrong', () => {
    expect(slotResults(['She', 'feed', 'the cat'], { ...item, strictness: 'enforce' })).toEqual(['ok', 'wrong', 'ok']);
  });
  it('marks an unfilled slot wrong', () => {
    expect(slotResults(['She', null, 'the cat'], item)).toEqual(['ok', 'wrong', 'ok']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/grade.test.ts`
Expected: FAIL ("slotResults" not exported).

- [ ] **Step 3: Implement `slotResults` (append to `grade.ts`)**

```ts
// src/domain/grade.ts — append
export type SlotResult = 'ok' | 'wrong';

/** Per-slot correctness for partial retry. An accepted near-miss (trap, non-enforce) counts ok. */
export function slotResults(placed: (string | null)[], item: GradeItem): SlotResult[] {
  const { answer, traps, strictness } = item;
  return answer.map((ans, i) => {
    const word = placed[i];
    if (word === ans) return 'ok';
    const trap = traps?.find((t) => t.slot === i && t.word === word);
    if (trap && strictness !== 'enforce') return 'ok';
    return 'wrong';
  });
}
```

- [ ] **Step 4: Run to verify grade passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/grade.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the round test for the new retry shape**

Replace the existing retry assertion in `src/domain/round.test.ts` (the test that expects `{ type: 'retry' }`) with:

```ts
  it('returns retry with the wrong slot indices and a trap tip when present', () => {
    const item = {
      answer: ['She', 'feeds', 'the cat'],
      traps: [{ slot: 1, word: 'feed', tip: 'feeds (he/she) takes -s' }],
      strictness: 'enforce' as const,
    };
    const action = resolveRound({ item, filled: ['She', 'feed', 'the cat'], index: 0, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.wrongSlots).toEqual([1]);
      expect(action.tip).toBe('feeds (he/she) takes -s');
    }
  });

  it('returns retry with tip null when no trap explains the slip', () => {
    const item = { answer: ['She', 'feeds', 'the cat'], traps: [], strictness: undefined };
    const action = resolveRound({ item, filled: ['She', 'eats', 'the cat'], index: 0, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.wrongSlots).toEqual([1]);
      expect(action.tip).toBeNull();
    }
  });
```

- [ ] **Step 6: Run to verify round test fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/round.test.ts`
Expected: FAIL (retry has no `wrongSlots`/`tip`).

- [ ] **Step 7: Update `round.ts`**

```ts
// src/domain/round.ts — full file
import type { DrillItem } from '../data/types';
import { gradePlacement, slotResults } from './grade';
import { computeStars } from './scoring';

export type RoundAction =
  | { type: 'finish'; stars: number; flags: string[] }
  | { type: 'advance'; nextIndex: number; flags: string[] }
  | { type: 'retry'; wrongSlots: number[]; tip: string | null };

type RoundItem = Pick<DrillItem, 'answer' | 'traps' | 'strictness'>;

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

  const slips = mistakes + (grade.status === 'flagged' ? 1 : 0);
  if (index === total - 1) {
    return { type: 'finish', stars: computeStars({ hints: 0, mistakes: slips }), flags: grade.flags };
  }
  return { type: 'advance', nextIndex: index + 1, flags: grade.flags };
}
```

- [ ] **Step 8: Run to verify round + grade pass**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/round.test.ts src/domain/grade.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/domain/grade.ts src/domain/grade.test.ts src/domain/round.ts src/domain/round.test.ts && git commit -m "feat(drill): per-slot grading + partial-retry payload (wrongSlots, tip)"
```

---

## Task 4: Speech seam

**Files:**
- Create: `src/config/audio.ts`, `src/config/audio.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/config/audio.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSpeechProvider, noopSpeech } from './audio';

const realSynth = (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
const realUtter = (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;

afterEach(() => {
  (globalThis as Record<string, unknown>).speechSynthesis = realSynth;
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = realUtter;
});

describe('getSpeechProvider', () => {
  it('returns the no-op provider when speech synthesis is unavailable', () => {
    delete (globalThis as Record<string, unknown>).speechSynthesis;
    expect(getSpeechProvider()).toBe(noopSpeech);
    expect(() => getSpeechProvider().speak('hi', 'en-US')).not.toThrow();
  });

  it('speaks an utterance with the given lang when available', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    (globalThis as Record<string, unknown>).speechSynthesis = { speak, cancel };
    (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = class {
      text: string; lang = '';
      constructor(t: string) { this.text = t; }
    };
    getSpeechProvider().speak('feeds', 'en-US');
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].lang).toBe('en-US');
    expect(speak.mock.calls[0][0].text).toBe('feeds');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/config/audio.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `audio.ts`**

```ts
// src/config/audio.ts

/** A pluggable text-to-speech sink. Swap the Web Speech impl for recorded clips later. */
export interface SpeechProvider {
  speak(text: string, lang: string): void;
}

export const noopSpeech: SpeechProvider = { speak: () => {} };

function webSpeech(): SpeechProvider {
  return {
    speak(text, lang) {
      const synth = globalThis.speechSynthesis;
      const utter = new globalThis.SpeechSynthesisUtterance(text);
      utter.lang = lang;
      synth.cancel(); // never queue; speak the latest
      synth.speak(utter);
    },
  };
}

/** Web Speech when the browser supports it, otherwise a silent no-op. */
export function getSpeechProvider(): SpeechProvider {
  const g = globalThis as { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown };
  if (g.speechSynthesis && typeof g.SpeechSynthesisUtterance === 'function') {
    return webSpeech();
  }
  return noopSpeech;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/config/audio.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/config/audio.ts src/config/audio.test.ts && git commit -m "feat(drill): Web Speech provider seam with silent fallback"
```

---

## Task 5: useSpeech hook

**Files:**
- Create: `src/hooks/useSpeech.ts`, `src/hooks/useSpeech.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useSpeech.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const speak = vi.fn();
vi.mock('../config/audio', () => ({
  getSpeechProvider: () => ({ speak }),
  noopSpeech: { speak: () => {} },
}));

import { useSpeech } from './useSpeech';

describe('useSpeech', () => {
  it('routes words to en-US, the hint to th-TH, the sentence to en-US', () => {
    const { result } = renderHook(() => useSpeech());
    result.current.speakWord('feeds');
    result.current.speakThai('แมว');
    result.current.speakSentence('She feeds the cat');
    expect(speak).toHaveBeenNthCalledWith(1, 'feeds', 'en-US');
    expect(speak).toHaveBeenNthCalledWith(2, 'แมว', 'th-TH');
    expect(speak).toHaveBeenNthCalledWith(3, 'She feeds the cat', 'en-US');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/hooks/useSpeech.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `useSpeech.ts`**

```ts
// src/hooks/useSpeech.ts
import { useMemo } from 'react';
import { getSpeechProvider } from '../config/audio';

export const EN = 'en-US';
export const TH = 'th-TH';

/** Stable speak helpers for the drill: English words/sentence, Thai meaning hint. */
export function useSpeech() {
  return useMemo(() => {
    const p = getSpeechProvider();
    return {
      speakWord: (w: string) => p.speak(w, EN),
      speakThai: (t: string) => p.speak(t, TH),
      speakSentence: (s: string) => p.speak(s, EN),
    };
  }, []);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/hooks/useSpeech.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/hooks/useSpeech.ts src/hooks/useSpeech.test.ts && git commit -m "feat(drill): useSpeech hook"
```

---

## Task 6: DrillHeader (streak + star track)

**Files:**
- Create: `src/components/drill/DrillHeader.tsx`, `src/components/drill/DrillHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/drill/DrillHeader.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DrillHeader } from './DrillHeader';

describe('DrillHeader', () => {
  it('shows the streak count and a node per round item', () => {
    render(<DrillHeader streak={3} index={1} total={5} />);
    expect(screen.getByTestId('streak')).toHaveTextContent('3');
    expect(screen.getAllByTestId(/^track-node-/)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/drill/DrillHeader.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `DrillHeader.tsx`**

```tsx
// src/components/drill/DrillHeader.tsx

/** Round status: streak chip + a node per item (done / current / pending). Cosmetic. */
export function DrillHeader({ streak, index, total }: { streak: number; index: number; total: number }) {
  return (
    <div className="flex items-center justify-between">
      <span
        data-testid="streak"
        className="flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-sm font-extrabold text-orange-700 ring-1 ring-inset ring-orange-200"
      >
        🔥 {streak}
      </span>
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

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/drill/DrillHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/drill/DrillHeader.tsx src/components/drill/DrillHeader.test.tsx && git commit -m "feat(drill): DrillHeader streak + star track"
```

---

## Task 7: WhyTip

**Files:**
- Create: `src/components/drill/WhyTip.tsx`, `src/components/drill/WhyTip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/drill/WhyTip.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WhyTip } from './WhyTip';

describe('WhyTip', () => {
  it('renders the tip text in an assertive live region', () => {
    render(<WhyTip text="feeds (he/she) takes -s" />);
    const tip = screen.getByTestId('why-tip');
    expect(tip).toHaveTextContent('feeds (he/she) takes -s');
    expect(tip).toHaveAttribute('role', 'status');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/drill/WhyTip.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `WhyTip.tsx`**

```tsx
// src/components/drill/WhyTip.tsx
import { motion } from 'framer-motion';

/** Inline "why it's wrong" banner shown on a slip. */
export function WhyTip({ text }: { text: string }) {
  return (
    <motion.p
      data-testid="why-tip"
      role="status"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-center text-sm font-semibold text-rose-700"
    >
      {text}
    </motion.p>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/drill/WhyTip.test.tsx`
Expected: PASS (mock framer-motion if the run warns; this component renders fine under the real lib in jsdom for a static element, but if it errors, add the Proxy mock from `src/App.test.tsx`).

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/drill/WhyTip.tsx src/components/drill/WhyTip.test.tsx && git commit -m "feat(drill): WhyTip inline explanation"
```

---

## Task 8: HintButton

**Files:**
- Create: `src/components/drill/HintButton.tsx`, `src/components/drill/HintButton.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/drill/HintButton.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HintButton } from './HintButton';

describe('HintButton', () => {
  it('calls onHint when tapped', () => {
    const onHint = vi.fn();
    render(<HintButton onHint={onHint} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /hint/i }));
    expect(onHint).toHaveBeenCalled();
  });
  it('is disabled when there is nothing to fill', () => {
    render(<HintButton onHint={() => {}} disabled />);
    expect(screen.getByRole('button', { name: /hint/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/drill/HintButton.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `HintButton.tsx`**

```tsx
// src/components/drill/HintButton.tsx

/** Reveals the current slot's correct word (resets the streak; counts as a slip). */
export function HintButton({ onHint, disabled }: { onHint: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onHint}
      disabled={disabled}
      className="flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-700 ring-1 ring-inset ring-violet-200 transition active:scale-95 disabled:opacity-40"
    >
      💡 Hint
    </button>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/drill/HintButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/drill/HintButton.tsx src/components/drill/HintButton.test.tsx && git commit -m "feat(drill): HintButton"
```

---

## Task 9: DrillPet (centre-stage)

**Files:**
- Create: `src/components/drill/DrillPet.tsx`, `src/components/drill/DrillPet.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/drill/DrillPet.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// framer-motion can't run in jsdom — render motion.* as plain elements.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const make = (tag: string) => ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) => {
    const STRIP = new Set(['initial','animate','exit','transition','variants','whileHover','whileTap']);
    const dom: Record<string, unknown> = {};
    for (const k in rest) if (!STRIP.has(k)) dom[k] = rest[k];
    return React.createElement(tag, dom, children as React.ReactNode);
  };
  return {
    motion: new Proxy({}, { get: (_t, tag) => make(String(tag)) }),
    useAnimationControls: () => ({ start: () => {} }),
  };
});

import { DrillPet } from './DrillPet';

describe('DrillPet', () => {
  it('shows the active pet and a nudge line', () => {
    render(<DrillPet species="leaf" stage="baby" happiness={80} reaction="idle" line="Which verb? 👀" />);
    expect(screen.getByText(/which verb/i)).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/drill/DrillPet.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `DrillPet.tsx`** (reuses `PetSprite` for the sprite + idle bob and its `feedTrigger` bounce; a `key` bump on `wrong` replays a small shake)

```tsx
// src/components/drill/DrillPet.tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { PetStage, Species } from '../../data/types';
import { PetSprite } from '../PetSprite';
import { SpeechBubble } from '../SpeechBubble';

export type PetReaction = 'idle' | 'correct' | 'wrong';

/** Centre-stage active pet: idle bob, a bounce on correct, a shake on wrong, plus a nudge line. */
export function DrillPet({
  species, stage, happiness, reaction, line,
}: {
  species: Species; stage: PetStage; happiness: number; reaction: PetReaction; line: string;
}) {
  // bounce: increment PetSprite.feedTrigger when a correct answer lands
  const [bounce, setBounce] = useState(0);
  const [shake, setShake] = useState(0);
  const prev = useRef<PetReaction>('idle');
  useEffect(() => {
    if (reaction === prev.current) return;
    if (reaction === 'correct') setBounce((b) => b + 1);
    if (reaction === 'wrong') setShake((s) => s + 1);
    prev.current = reaction;
  }, [reaction]);

  return (
    <div className="flex flex-col items-center">
      <SpeechBubble name="" line={line} />
      <motion.div
        key={shake}
        animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : undefined}
        transition={{ duration: 0.45 }}
        className="mt-1"
      >
        <PetSprite species={species} stage={stage} happiness={happiness} feedTrigger={bounce} />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/drill/DrillPet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/drill/DrillPet.tsx src/components/drill/DrillPet.test.tsx && git commit -m "feat(drill): DrillPet centre-stage reacting pet"
```

---

## Task 10: WordTray — tap-to-place

**Files:**
- Modify: `src/components/WordTray.tsx`, `src/components/WordTray.test.tsx`

- [ ] **Step 1: Add the failing test**

Read `src/components/WordTray.test.tsx` first to reuse its existing render/mock setup, then add:

```tsx
  it('calls onTapPlace with the tile index when a tile is tapped', () => {
    const onTapPlace = vi.fn();
    render(<WordTray tiles={['She', 'feeds']} used={[false, false]} onTapPlace={onTapPlace} />);
    fireEvent.click(screen.getByTestId('tile-feeds'));
    expect(onTapPlace).toHaveBeenCalledWith(1);
  });
```

(Ensure `vi`, `fireEvent`, `screen`, `render` are imported in the file.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/WordTray.test.tsx`
Expected: FAIL (`onTapPlace` not a prop / not called).

- [ ] **Step 3: Update `WordTray.tsx`**

```tsx
// src/components/WordTray.tsx
import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';

interface Props {
  tiles: string[];
  used: boolean[];
  onTapPlace?: (index: number) => void;
}

function Tile({ word, index, onTap }: { word: string; index: number; onTap?: (i: number) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tile-${index}` });
  return (
    <motion.button
      ref={setNodeRef}
      data-testid={`tile-${word}`}
      {...listeners}
      {...attributes}
      onClick={() => onTap?.(index)}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: isDragging ? 0.3 : 1, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.2 }}
      className="min-h-12 touch-none rounded-xl bg-indigo-500 px-5 py-3 text-lg font-semibold text-white shadow active:scale-95"
    >
      {word}
    </motion.button>
  );
}

export function WordTray({ tiles, used, onTapPlace }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {tiles.map((word, i) =>
        used[i] ? null : <Tile key={`tile-${i}`} word={word} index={i} onTap={onTapPlace} />,
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/WordTray.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/WordTray.tsx src/components/WordTray.test.tsx && git commit -m "feat(drill): WordTray tap-to-place"
```

---

## Task 11: SentenceSlots — POS colors + current-slot glow

**Files:**
- Modify: `src/components/SentenceSlots.tsx`, `src/components/SentenceSlots.test.tsx`

- [ ] **Step 1: Add the failing test**

Read `src/components/SentenceSlots.test.tsx` first, then add:

```tsx
  it('highlights the current (leftmost empty) slot', () => {
    render(<SentenceSlots slots={['Pronoun', 'Verb', 'Object']} placed={['She', null, null]} onClearSlot={() => {}} />);
    expect(screen.getByTestId('slot-1')).toHaveClass('border-emerald-500');
  });
  it('colors a filled slot by its part of speech', () => {
    render(<SentenceSlots slots={['Pronoun', 'Verb', 'Object']} placed={['She', 'feeds', null]} onClearSlot={() => {}} />);
    expect(screen.getByTestId('slot-1')).toHaveClass('bg-emerald-100');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/SentenceSlots.test.tsx`
Expected: FAIL (classes absent).

- [ ] **Step 3: Update `SentenceSlots.tsx`**

```tsx
// src/components/SentenceSlots.tsx
import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import type { PosLabel } from '../data/types';
import { capitalizeFirst } from '../domain/sentence';
import { currentSlotIndex } from '../domain/placement';
import { posClasses } from '../config/posColors';

interface Props {
  slots: PosLabel[];
  placed: (string | null)[];
  onClearSlot: (index: number) => void;
}

/** First slot is capitalized (sentence start); others shown as-is. */
function displayToken(word: string, index: number): string {
  return index === 0 ? capitalizeFirst(word) : word;
}

function Slot({
  index, label, word, isCurrent, onClear,
}: {
  index: number; label: PosLabel; word: string | null; isCurrent: boolean; onClear: (i: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
  const empty = word === null;
  const base = 'min-h-12 min-w-20 rounded-xl px-4 py-3 text-lg font-semibold border-2';
  const look = empty
    ? `border-dashed ${isOver || isCurrent ? 'border-emerald-500 bg-emerald-50' : 'border-slate-400 bg-white'}`
    : posClasses(label);
  return (
    <motion.button
      ref={setNodeRef}
      data-testid={`slot-${index}`}
      onClick={() => !empty && onClear(index)}
      animate={{ scale: isOver && empty ? 1.06 : 1 }}
      transition={{ duration: 0.15 }}
      className={`${base} ${look}`}
    >
      <span className="block text-xs opacity-70">{label}</span>
      {empty ? (
        <span className="block text-slate-300"> </span>
      ) : (
        <motion.span
          key={word}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="block"
        >
          {displayToken(word, index)}
        </motion.span>
      )}
    </motion.button>
  );
}

export function SentenceSlots({ slots, placed, onClearSlot }: Props) {
  const allFilled = placed.every((p) => p !== null);
  const current = currentSlotIndex(placed);
  return (
    <div className="flex flex-wrap items-end justify-center gap-2">
      {slots.map((label, i) => (
        <Slot key={i} index={i} label={label} word={placed[i]} isCurrent={i === current} onClear={onClearSlot} />
      ))}
      {allFilled && <span className="self-end pb-3 text-2xl font-semibold text-slate-900">.</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/SentenceSlots.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/SentenceSlots.tsx src/components/SentenceSlots.test.tsx && git commit -m "feat(drill): POS-colored slots + current-slot glow"
```

---

## Task 12: DrillScreen — orchestration + new layout

**Files:**
- Modify: `src/components/DrillScreen.tsx`, `src/components/DrillScreen.test.tsx`

- [ ] **Step 1: Add failing behavior tests**

Read `src/components/DrillScreen.test.tsx` first to reuse its mocks (it must mock `framer-motion`, the content store, and `../state/gameStore`). Ensure these mocks exist (add if missing), then add:

```tsx
  it('tap-places a tile into the current slot', () => {
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByTestId('tile-She'));
    expect(screen.getByTestId('slot-0')).toHaveTextContent('She');
  });

  it('on a wrong answer, clears only the wrong slot and shows the why-tip', () => {
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    // build "She eats the cat" (wrong verb)
    fireEvent.click(screen.getByTestId('tile-She'));
    fireEvent.click(screen.getByTestId('tile-eats'));
    fireEvent.click(screen.getByTestId('tile-the cat'));
    expect(screen.getByTestId('slot-0')).toHaveTextContent('She');   // kept
    expect(screen.getByTestId('slot-2')).toHaveTextContent('the cat'); // kept
    expect(screen.getByTestId('slot-1')).not.toHaveTextContent('eats'); // wrong cleared
    expect(screen.getByTestId('why-tip')).toBeInTheDocument();
  });
```

Where `ITEM` (define at the top of the test file) is:

```tsx
const ITEM = {
  id: 'i1', drill: 'pattern' as const, level: 1, thaiHint: 'เธอให้อาหารแมว',
  slots: ['Pronoun', 'Verb', 'Object'] as const,
  answer: ['She', 'feeds', 'the cat'],
  distractors: ['eats'],
};
```

> The wrong-answer test relies on the feedback hold timer. Wrap the click that fills the last slot and the assertions with fake timers (or `await screen.findByTestId('why-tip')` after advancing timers). Use `vi.useFakeTimers()` + `vi.runAllTimers()` inside `act(...)`, or mock `useRoundFeedback` to call `onDone` synchronously. Prefer mocking `useRoundFeedback`:
> ```tsx
> vi.mock('./useRoundFeedback', () => ({
>   useRoundFeedback: () => ({ feedback: null, locked: false, play: (_k: string, done: () => void) => done() }),
> }));
> ```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/DrillScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Replace `DrillScreen.tsx`**

```tsx
// src/components/DrillScreen.tsx
import { useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { trayWords } from '../content/model';
import type { DrillItem, DrillType } from '../data/types';
import { shuffle } from '../domain/check';
import { parseDndId, placeTile, tapPlace, currentSlotIndex } from '../domain/placement';
import { resolveRound, type RoundAction } from '../domain/round';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { stageForXp } from '../domain/xp';
import { useSpeech } from '../hooks/useSpeech';
import { SentenceSlots } from './SentenceSlots';
import { WordTray } from './WordTray';
import { useRoundFeedback } from './useRoundFeedback';
import { DrillHeader } from './drill/DrillHeader';
import { DrillPet, type PetReaction } from './drill/DrillPet';
import { WhyTip } from './drill/WhyTip';
import { HintButton } from './drill/HintButton';

export function DrillScreen({ items, drill, level }: { items: DrillItem[]; drill: DrillType; level: number }) {
  const finishRound = useGameStore((s) => s.finishRound);
  const pet = useGameStore(selectActivePet);

  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<(string | null)[]>(() => items[0].slots.map(() => null));
  const [tiles, setTiles] = useState<string[]>(() => shuffle(trayWords(items[0])));
  const [used, setUsed] = useState<boolean[]>(() => trayWords(items[0]).map(() => false));
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [why, setWhy] = useState<string | null>(null);
  const [reaction, setReaction] = useState<PetReaction>('idle');
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const { feedback, play, locked } = useRoundFeedback();
  const speak = useSpeech();

  const item = items[index];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function loadItem(i: number) {
    const words = trayWords(items[i]);
    setPlaced(items[i].slots.map(() => null));
    setTiles(shuffle(words));
    setUsed(words.map(() => false));
    setWhy(null);
    setReaction('idle');
  }

  function handleClear(slotIndex: number) {
    if (locked) return;
    const word = placed[slotIndex];
    if (word === null) return;
    const next = [...placed];
    next[slotIndex] = null;
    setPlaced(next);
    const ui = used.findIndex((u, i) => u && tiles[i] === word);
    if (ui !== -1) {
      const nextUsed = [...used];
      nextUsed[ui] = false;
      setUsed(nextUsed);
    }
  }

  function commit(next: { placed: (string | null)[]; used: boolean[] }) {
    if (next.placed === placed) return; // no-op
    setPlaced(next.placed);
    setUsed(next.used);
    setWhy(null);
    if (next.placed.every((p) => p !== null)) evaluate(next.placed);
  }

  function onTapPlace(tileIndex: number) {
    if (locked) return;
    speak.speakWord(tiles[tileIndex]);
    commit(tapPlace({ placed, used }, tiles, tileIndex));
  }

  function onDragStart(e: DragStartEvent) {
    if (locked) return;
    const id = parseDndId(String(e.active.id));
    if (id?.kind === 'tile') setActiveWord(tiles[id.index]);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveWord(null);
    if (locked) return;
    if (!e.over) return;
    const from = parseDndId(String(e.active.id));
    const to = parseDndId(String(e.over.id));
    if (from?.kind !== 'tile' || to?.kind !== 'slot') return;
    speak.speakWord(tiles[from.index]);
    commit(placeTile({ placed, used }, tiles, from.index, to.index));
  }

  function evaluate(filled: (string | null)[]) {
    const action = resolveRound({ item, filled, index, total: items.length, mistakes });
    if (action.type === 'retry') {
      setReaction('wrong');
      play('wrong', () => applyAction(action, filled));
      return;
    }
    speak.speakSentence(item.answer.join(' '));
    setReaction('correct');
    const kind = action.flags.length ? 'flag' : 'correct';
    play(kind, () => applyAction(action, filled));
  }

  function applyAction(action: RoundAction, filled: (string | null)[]) {
    switch (action.type) {
      case 'finish':
        finishRound({ drill, level, stars: action.stars, correctCount: items.length });
        break;
      case 'advance':
        setStreak((s) => (action.flags.length ? 0 : s + 1));
        if (action.flags.length) setMistakes((m) => m + 1);
        setIndex(action.nextIndex);
        loadItem(action.nextIndex);
        break;
      case 'retry': {
        setMistakes((m) => m + 1);
        setStreak(0);
        const np = [...filled];
        const nu = [...used];
        for (const si of action.wrongSlots) {
          const w = filled[si];
          np[si] = null;
          const ui = tiles.findIndex((t, i) => nu[i] && t === w);
          if (ui !== -1) nu[ui] = false;
        }
        setPlaced(np);
        setUsed(nu);
        setWhy(action.tip ?? `The ${item.slots[action.wrongSlots[0]]} isn't right yet.`);
        break;
      }
    }
  }

  function hint() {
    if (locked) return;
    const slot = currentSlotIndex(placed);
    if (slot === -1) return;
    const word = item.answer[slot];
    const tileIndex = tiles.findIndex((t, i) => !used[i] && t === word);
    if (tileIndex === -1) return;
    setStreak(0);
    setMistakes((m) => m + 1);
    setWhy(null);
    speak.speakWord(word);
    commit(placeTile({ placed, used }, tiles, tileIndex, slot));
  }

  const stage = stageForXp(pet.xp, pet.hatched);
  const line = why
    ? 'Hmm, not quite!'
    : currentSlotIndex(placed) === -1
      ? 'Tap a word to fix it!'
      : `Which ${item.slots[currentSlotIndex(placed)]}? 👀`;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex h-full flex-col gap-3 bg-gradient-to-b from-sky-100 via-indigo-50 to-amber-50 p-4">
        <DrillHeader streak={streak} index={index} total={items.length} />

        <DrillPet species={pet.species} stage={stage} happiness={pet.happiness} reaction={reaction} line={line} />

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-slate-800">{item.thaiHint}</span>
            <button
              type="button" aria-label="Hear the meaning"
              onClick={() => speak.speakThai(item.thaiHint)}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700"
            >🔊</button>
            <HintButton onHint={hint} disabled={locked || currentSlotIndex(placed) === -1} />
          </div>
        </div>

        <div
          className={`relative flex flex-1 flex-col items-center justify-center gap-3 rounded-xl ${
            feedback === 'correct' || feedback === 'flag' ? 'flash-correct' : feedback === 'wrong' ? 'shake-wrong' : ''
          }`}
        >
          <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} />
          {why && <WhyTip text={why} />}
          {feedback && (
            <div
              aria-hidden
              className={`pop-check pointer-events-none absolute text-6xl font-bold ${
                feedback === 'wrong' ? 'text-rose-500' : feedback === 'flag' ? 'text-sky-500' : 'text-emerald-500'
              }`}
            >
              {feedback === 'wrong' ? '✗' : '✓'}
            </div>
          )}
        </div>

        <div className="pb-2">
          <WordTray tiles={tiles} used={used} onTapPlace={onTapPlace} />
        </div>
      </div>
      <DragOverlay>
        {activeWord ? (
          <div className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 text-lg font-semibold text-white shadow">{activeWord}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

> Confirm `stageForXp` is exported from `src/domain/xp.ts` (the store uses it via `stage()`); if its name differs, use the actual export. `selectActivePet` is exported from `src/state/gameStore.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/DrillScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/DrillScreen.tsx src/components/DrillScreen.test.tsx && git commit -m "feat(drill): orchestrate tap/streak/why/pet + partial retry + audio + new layout"
```

---

## Task 13: EggHatch — inherit tap + audio

**Files:**
- Modify: `src/components/EggHatch.tsx`, `src/components/EggHatch.test.tsx`

EggHatch already renders `SentenceSlots`/`WordTray`, so POS colors + current-slot glow come for free once Task 11 lands. This task adds **tap-to-place** and **per-word audio**, and keeps the existing reset-on-wrong (no streak/pet/why).

- [ ] **Step 1: Add a failing test**

Read `src/components/EggHatch.test.tsx` first (reuse mocks), then add:

```tsx
  it('lets you tap a tile into the current slot', () => {
    render(<EggHatch />);
    const firstTile = screen.getAllByTestId(/^tile-/)[0];
    const word = firstTile.getAttribute('data-testid')!.replace('tile-', '');
    fireEvent.click(firstTile);
    expect(screen.getByTestId('slot-0')).toHaveTextContent(word);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/EggHatch.test.tsx`
Expected: FAIL (no tap handler wired).

- [ ] **Step 3: Wire tap + audio in `EggHatch.tsx`**

Add imports near the top:

```tsx
import { tapPlace } from '../domain/placement';
import { useSpeech } from '../hooks/useSpeech';
```

Inside the component, after `const { feedback, play, locked } = useRoundFeedback();`, add:

```tsx
  const speak = useSpeech();

  function onTapPlace(tileIndex: number) {
    if (locked) return;
    speak.speakWord(tiles[tileIndex]);
    const next = tapPlace({ placed, used }, tiles, tileIndex);
    if (next.placed === placed) return;
    setPlaced(next.placed);
    setUsed(next.used);
    if (next.placed.every((p) => p !== null)) {
      const correct = isPlacementCorrect(next.placed, item.answer);
      play(correct ? 'correct' : 'wrong', () => (correct ? hatch() : reset()));
    }
  }
```

Then pass the handler to the tray:

```tsx
<WordTray tiles={tiles} used={used} onTapPlace={onTapPlace} />
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/EggHatch.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/EggHatch.tsx src/components/EggHatch.test.tsx && git commit -m "feat(drill): egg hatch inherits tap-to-place + per-word audio"
```

---

## Task 14: Full green bar + visual/interaction QA

**Files:** none (verification)

- [ ] **Step 1: Typecheck + build**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm run build`
Expected: both succeed.

- [ ] **Step 2: Full test suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run`
Expected: all pass (previous 391 + the new tests), only the rules suite skipped without Java.

- [ ] **Step 3: Headed-Chrome interaction QA (per the menu-redesign QA recipe)**

Bring up the emulator + dev server (temp `.env.local`, JDK 21, `npm run emulators`, `npm run dev`), drive a drill via installed Chrome (`window.store` exposes the game store in DEV). Verify, with screenshots: tap places into the current slot; drag still works; a wrong answer clears only the wrong slot and shows the why-tip; correct words stay; 💡 hint fills the current slot and resets the streak; the streak/track update; the pet bounces on correct and shakes on wrong; the 🔊/🔈 buttons are present; `prefers-reduced-motion` degrades motion. Then tear down: restore `.env.local` from `.env.local.qabak`, delete throwaway scripts, kill dev+emulator, confirm `git status` clean.

- [ ] **Step 4: Open the PR**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git push -u origin drill-redesign && gh pr create --title "Drill page redesign: Living Drill" --body "Implements docs/superpowers/specs/2026-06-26-drill-page-redesign-design.md"
```

---

## Self-review notes (addressed)

- **Spec coverage:** tap-to-place (T2,T10,T12), POS colors (T1,T11), partial retry (T3,T12), why-wrong (T3,T7,T12), audio split (T4,T5,T12), 💡 hint (T8,T12), centre-stage pet + reaction (T9,T12), streak + track (T6,T12), no content/persistence/scoring change (T3 keeps scoring; no store edits), egg hatch subset (T13). The only intentional deviations from the mock are documented at the top (tray tiles stay neutral; sentence audio fires on accept, not on RewardScreen).
- **Type consistency:** `tapPlace`/`currentSlotIndex` (placement), `slotResults`/`SlotResult` (grade), retry `{ wrongSlots, tip }` (round), `posClasses` (posColors), `getSpeechProvider`/`noopSpeech` (audio), `useSpeech` → `speakWord/speakThai/speakSentence`, `DrillPet`/`PetReaction`, `DrillHeader`/`WhyTip`/`HintButton` props — all referenced consistently across tasks.
- **Open verification during execution:** confirm `stageForXp` export name in `src/domain/xp.ts` and that `selectActivePet` is exported from the store (both used by Task 12); adjust the import if the real names differ.

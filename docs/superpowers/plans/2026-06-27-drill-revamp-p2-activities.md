# Drill Revamp P2 — New Activity Types + L1 Toggle + Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three new player activity screens (flashcard, matching, fill-blank) plus drag-drop `hidePos`, a per-user TH/ENG (L1) toggle, kind-aware scoring/food, and admin authoring by `kind` — building on P1's course foundation.

**Architecture:** Introduce a discriminated `ContentItem` union (`FlashcardItem | MatchingItem | DragDropItem | FillBlankItem`) so the per-course `pool` carries typed items; route player screens by `kind` at the existing `screenKeyAndNode` seam; persist the L1 toggle in `gameStore`; gate it per unit via `l1Enabled`. Each new screen is its own component (interactions genuinely differ), drag-drop reuses `DrillScreen` unchanged apart from `hidePos`.

**Tech Stack:** React + TypeScript, Zustand (+persist), Vitest + Testing Library, @dnd-kit (drag), Tailwind, Firebase Firestore.

**Repo:** `D:\ai_projects\AI_design_thinking\sentence-pet` — branch `journey-redesign` (P1 committed; NOT merged to main — whole line promotes as one release later).

**Spec:** `docs/superpowers/specs/2026-06-27-drill-revamp-design.md`
**P2 handoff:** `docs/superpowers/plans/2026-06-27-drill-revamp-p2-handoff.md`

**RESOLVED open decision (course-select entry):** **Always show select.** PetRoom Play ▶ routes to `pickCourse` (not `pickDrill`). Implemented in Task 4.

---

## Landmines (carry through EVERY task)

- **Stage explicit files only — never `git add -A`.** Concurrent sessions share `.git`; `git add -A` sweeps in unrelated edits. Each commit step below lists exact paths.
- **`firebase.json` is intentionally modified-but-unstaged.** Never stage it.
- **`src/content/seed.ts` is generated** — regenerate via admin export + `seed:export`, never hand-edit. Task 3 adds a runtime kind-stamp so an un-regenerated seed still loads.
- **Boss battle is an existing feature** — out of scope for P2 (P3 wires gated/final). Don't touch boss flow.
- **`.superpowers/` is gitignored** — brainstorm/mockups live there.

## How to run / verify

- Dev: `npm run dev` (free port 5173+), play as guest → PetRoom → Play ▶.
- Tests: `npm test` (P1 baseline: 731 pass). Each task adds tests and must keep the suite green.
- Build: `npm run build` (must stay clean — no warnings).
- Admin: `<dev-url>/#admin`, sign in as admin (Firebase custom claim `admin`).

---

## File Structure (what each task creates / modifies)

**Foundation**
- `src/data/types.ts` — add `L1Helper`, `MatchingPair`, the four `*Item` interfaces, `ContentItem` union, `DrillItem` alias, type guards. (Task 1)
- `src/content/model.ts`, `src/content/course.ts` — pool type → `Record<string, ContentItem>`; narrowing helpers. (Task 1)
- `src/content/validate.ts` — kind-aware `validateItem` switch. (Task 2)
- `src/content/migrate.ts` — stamp `kind: 'dragdrop'` on legacy items. (Task 3)

**Player entry + L1**
- `src/components/PetRoom.tsx` — Play ▶ → `pickCourse`. (Task 4)
- `src/state/gameStore.ts` — `l1Mode` state + persist v14. (Task 5)
- `src/components/L1Toggle.tsx` (new), `src/content/l1.ts` (new) — toggle UI + `showL1` display helper. (Task 5)

**Player screens** (routed at `src/App.tsx` `screenKeyAndNode`)
- `src/components/FlashcardScreen.tsx` (new). (Task 6)
- `src/components/MatchingScreen.tsx` (new). (Task 7)
- `src/components/FillBlankScreen.tsx` (new) + `src/domain/fillblank.ts` (new, grading/hints). (Task 8)
- `src/components/DrillScreen.tsx`, `src/components/SentenceSlots.tsx` — thread `hidePos`. (Task 9)

**Scoring / admin**
- `src/data/food.ts`, `src/domain/scoring.ts` — kind-aware food + stars. (Task 10)
- `src/components/admin/ItemEditor.tsx` — kind-switched form. (Task 11)
- `src/components/admin/JourneyTab.tsx` — kind+level+count per node, unit `l1Enabled`. (Task 12)

---

## Task 1: Discriminated `ContentItem` union (type foundation)

Introduce the spec's discriminated union. Keep `DrillItem` as a back-compat alias of `DragDropItem` so all existing dragdrop code keeps compiling; widen the pool to `Record<string, ContentItem>`; add type guards for narrowing at the routing seam.

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/content/model.ts` (pool type + helpers narrow to dragdrop)
- Modify: `src/content/course.ts:27` (pool type)
- Test: `src/data/types.test.ts` (new)

- [ ] **Step 1: Write the failing test for type guards**

Create `src/data/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isDragDrop, isFlashcard, isMatching, isFillBlank } from './types';
import type { ContentItem } from './types';

const dd: ContentItem = { id: 'd1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'แมว', slots: ['Pronoun'], answer: ['I'] };
const fc: ContentItem = { id: 'f1', kind: 'flashcard', level: 1, front: 'cat', back: 'แมว' };
const mt: ContentItem = { id: 'm1', kind: 'matching', level: 1, pairs: [{ left: 'cat', right: 'แมว' }, { left: 'dog', right: 'หมา' }] };
const fb: ContentItem = { id: 'b1', kind: 'fillblank', level: 1, template: 'I ___ rice', answer: 'eat' };

describe('content item type guards', () => {
  it('narrows by kind', () => {
    expect(isDragDrop(dd)).toBe(true);
    expect(isFlashcard(fc)).toBe(true);
    expect(isMatching(mt)).toBe(true);
    expect(isFillBlank(fb)).toBe(true);
    expect(isDragDrop(fc)).toBe(false);
    expect(isFlashcard(dd)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test -- src/data/types.test.ts`
Expected: FAIL — `isDragDrop` etc. not exported.

- [ ] **Step 3: Add the union + guards to `src/data/types.ts`**

Replace the existing `DrillItem` interface (the `export interface DrillItem { ... }` block) with the union below. `ContentKind` already includes all five values — leave it. `DragDropItem` keeps every current `DrillItem` field (incl. `thaiHint`, `hidePos`) plus the `kind` discriminant.

```typescript
/** Thai bridge text shown when the L1 toggle is on (display-only, never grades). */
export interface L1Helper {
  th: string;
}

/** Fields shared by every pool item. */
interface BaseContentItem {
  id: string;
  level: number;        // 1..5
  l1?: L1Helper;        // optional Thai helper (flashcard/matching-pair/fillblank). Dragdrop keeps thaiHint instead.
}

/** ① Flashcard — front/back recall, optional audio, self-graded practice. */
export interface FlashcardItem extends BaseContentItem {
  kind: 'flashcard';
  front: string;
  back: string;
  audio?: string;
  // speaking?: SpeakingCheck;  // RESERVED — pronunciation check, built later
}

/** A single match row. left = prompt (L2), right = answer slot. */
export interface MatchingPair {
  left: string;
  right: string;
  l1?: L1Helper;        // per-pair Thai
  leftImage?: string;   // RESERVED
  rightImage?: string;  // RESERVED
}

/** ② Matching — drag each prompt tile into its target slot. */
export interface MatchingItem extends BaseContentItem {
  kind: 'matching';
  pairs: MatchingPair[]; // >= 2
}

/** ③ Drag-drop — today's slot-fill engine, unchanged. Keeps thaiHint as its L1. */
export interface DragDropItem extends BaseContentItem {
  kind: 'dragdrop';
  drill: DrillType;
  thaiHint: string;        // existing meaning scaffold (dragdrop's L1 surface)
  slots: PosLabel[];
  answer: string[];        // same length as slots
  distractors?: string[];
  traps?: GrammarTrap[];
  hidePos?: boolean;       // difficulty: hide POS label/tint in slots (Task 9)
}

/** ④ Fill-blank — typed, strict trimmed match. */
export interface FillBlankItem extends BaseContentItem {
  kind: 'fillblank';
  template: string;        // exactly one "___" marks the blank
  answer: string;          // strict exact match (trimmed)
  alternates?: string[];   // optional extra accepted answers
}

export type ContentItem = FlashcardItem | MatchingItem | DragDropItem | FillBlankItem;

/** Back-compat: all existing dragdrop code refers to DrillItem. */
export type DrillItem = DragDropItem;

export const isDragDrop = (i: ContentItem): i is DragDropItem => i.kind === 'dragdrop';
export const isFlashcard = (i: ContentItem): i is FlashcardItem => i.kind === 'flashcard';
export const isMatching = (i: ContentItem): i is MatchingItem => i.kind === 'matching';
export const isFillBlank = (i: ContentItem): i is FillBlankItem => i.kind === 'fillblank';
```

Keep the existing `PosLabel`, `DrillType`, `ContentKind`, `GrammarTrap` declarations above this block (only `GrammarTrap` and `DrillType` are referenced by `DragDropItem`).

- [ ] **Step 4: Widen the pool type**

In `src/content/model.ts`, change the `ContentBundle.pool` type and the import:

```typescript
import type { DrillItem, DrillType, Species, PetStage, ContentKind, ContentItem } from '../data/types';
```
```typescript
export interface ContentBundle {
  pool: Record<string, ContentItem>;
  units: Unit[];
}
```

The pool-consuming helpers (`itemsForLesson`, `itemsForDrill`, `trayWords`, `tutorialItem`) currently assume `DrillItem`. Narrow them: `itemsForLesson` returns `ContentItem[]`; the dragdrop-only helpers (`trayWords`, `itemsForDrill`, `tutorialItem`) filter with `isDragDrop` and return `DrillItem[]`. Example for `trayWords` (adjust to its real signature):

```typescript
import { isDragDrop } from '../data/types';
// inside itemsForDrill / tutorialItem: Object.values(pool).filter(isDragDrop)
```

In `src/content/course.ts:27` change `pool: Record<string, DrillItem>;` → `pool: Record<string, ContentItem>;` and import `ContentItem` (drop the now-unused `DrillItem` import if TS flags it).

- [ ] **Step 5: Run tests + typecheck — verify green**

Run: `npm test -- src/data/types.test.ts` → PASS.
Run: `npm run build` → clean (fix any narrowing errors the union surfaces in model.ts/course.ts; these are the intended seams).

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/types.test.ts src/content/model.ts src/content/course.ts
git commit -m "feat(content): introduce discriminated ContentItem union + type guards"
```

---

## Task 2: Kind-aware `validateItem`

Replace the dragdrop-only `validateItem` (the P1 deferral seam at `src/content/validate.ts:5-12`) with an exhaustive switch over `item.kind`, adding the per-kind structural checks from spec §9.

**Files:**
- Modify: `src/content/validate.ts:5-12`
- Test: `src/content/validate.test.ts` (extend; create if absent)

- [ ] **Step 1: Write failing tests** in `src/content/validate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateContent } from './validate';
import type { ContentBundle } from './model';
import type { ContentItem } from '../data/types';

function bundle(item: ContentItem): ContentBundle {
  return {
    pool: { [item.id]: item },
    units: [{ id: 'u1', title: 'U', emoji: '📘', order: 0, lessons: [
      { id: 'l1', kind: item.kind, drill: 'pattern', level: 1, itemIds: [item.id], isCheckpoint: true },
    ] }],
  };
}

describe('kind-aware validateItem', () => {
  it('rejects flashcard missing back', () => {
    const r = validateContent(bundle({ id: 'f1', kind: 'flashcard', level: 1, front: 'cat', back: '' }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('f1'))).toBe(true);
  });
  it('rejects matching with <2 pairs', () => {
    const r = validateContent(bundle({ id: 'm1', kind: 'matching', level: 1, pairs: [{ left: 'a', right: 'b' }] }));
    expect(r.ok).toBe(false);
  });
  it('rejects fillblank without exactly one ___', () => {
    const r = validateContent(bundle({ id: 'b1', kind: 'fillblank', level: 1, template: 'no blank', answer: 'x' }));
    expect(r.ok).toBe(false);
  });
  it('accepts a valid fillblank', () => {
    const r = validateContent(bundle({ id: 'b2', kind: 'fillblank', level: 1, template: 'I ___ rice', answer: 'eat' }));
    expect(r.ok).toBe(true);
  });
  it('rejects empty l1.th when present', () => {
    const r = validateContent(bundle({ id: 'f2', kind: 'flashcard', level: 1, front: 'a', back: 'b', l1: { th: '' } }));
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify fail.** `npm test -- src/content/validate.test.ts` → FAIL.

- [ ] **Step 3: Replace `validateItem` in `src/content/validate.ts`** (keep the same `(itemId, item, push)` signature so `validateBundleShape` is untouched; widen the param type to `ContentItem`):

```typescript
import type { ContentItem } from '../data/types';

function validateItem(itemId: string, item: ContentItem, push: (m: string) => void): void {
  if (item.level < 1) push(`item ${itemId} level must be >= 1`);
  if (item.l1 && item.l1.th.trim() === '') push(`item ${itemId} l1.th is empty`);
  switch (item.kind) {
    case 'dragdrop':
      if (item.answer.length !== item.slots.length) push(`item ${itemId} answer/slots length mismatch`);
      for (const trap of item.traps ?? []) {
        if (trap.slot < 0 || trap.slot >= item.slots.length) push(`item ${itemId} trap slot out of range`);
      }
      break;
    case 'flashcard':
      if (item.front.trim() === '') push(`item ${itemId} flashcard front is empty`);
      if (item.back.trim() === '') push(`item ${itemId} flashcard back is empty`);
      break;
    case 'matching':
      if (item.pairs.length < 2) push(`item ${itemId} matching needs >= 2 pairs`);
      item.pairs.forEach((p, i) => {
        if (p.left.trim() === '' || p.right.trim() === '') push(`item ${itemId} pair ${i} incomplete`);
        if (p.l1 && p.l1.th.trim() === '') push(`item ${itemId} pair ${i} l1.th is empty`);
      });
      break;
    case 'fillblank': {
      const blanks = (item.template.match(/___/g) ?? []).length;
      if (blanks !== 1) push(`item ${itemId} fillblank template must have exactly one ___`);
      if (item.answer.trim() === '') push(`item ${itemId} fillblank answer is empty`);
      break;
    }
  }
}
```

Update the `import type { DrillItem }` line in validate.ts to `ContentItem` (or add it).

- [ ] **Step 4: Run — verify pass.** `npm test -- src/content/validate.test.ts` → PASS. Then full `npm test` → still green (existing dragdrop validation behavior unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/content/validate.ts src/content/validate.test.ts
git commit -m "feat(content): kind-aware per-item validation"
```

---

## Task 3: Stamp `kind` on legacy items in migration

Legacy pool items (seed + P1 course docs) have no `kind`. `bundleToDefaultCourse` must stamp `kind: 'dragdrop'` so they satisfy the discriminated union at runtime, independent of regenerating `seed.ts`.

**Files:**
- Modify: `src/content/migrate.ts`
- Test: `src/content/migrate.test.ts` (extend; create if absent)

- [ ] **Step 1: Write failing test** in `src/content/migrate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { bundleToDefaultCourse } from './migrate';
import { isDragDrop } from '../data/types';

describe('migrate stamps kind', () => {
  it('legacy items become dragdrop', () => {
    const legacy = {
      pool: { d1: { id: 'd1', drill: 'pattern', level: 1, thaiHint: 'แมว', slots: ['Pronoun'], answer: ['I'] } },
      units: [{ id: 'u1', title: 'U', emoji: '📘', order: 0, lessons: [
        { id: 'l1', drill: 'pattern', level: 1, itemIds: ['d1'], isCheckpoint: true },
      ] }],
    } as never;
    const course = bundleToDefaultCourse(legacy);
    expect(isDragDrop(course.pool.d1)).toBe(true);
    expect(course.pool.d1.kind).toBe('dragdrop');
  });
});
```

- [ ] **Step 2: Run — verify fail.** `npm test -- src/content/migrate.test.ts` → FAIL.

- [ ] **Step 3: Stamp kind in `bundleToDefaultCourse`** — map the pool before building the course:

```typescript
import { isDragDrop } from '../data/types';
import type { ContentItem } from '../data/types';

// inside bundleToDefaultCourse, where the pool is assembled:
const pool: Record<string, ContentItem> = {};
for (const [id, raw] of Object.entries(bundle.pool)) {
  pool[id] = (raw as ContentItem).kind ? (raw as ContentItem) : ({ ...(raw as object), kind: 'dragdrop' } as ContentItem);
}
// ...use `pool` in the returned Course
```

(Also default each `lesson.kind ??= 'dragdrop'` if migrate builds lessons — mirror the P1 default at `migrate.ts:19`.)

- [ ] **Step 4: Run — verify pass.** `npm test -- src/content/migrate.test.ts` → PASS, then full `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add src/content/migrate.ts src/content/migrate.test.ts
git commit -m "feat(content): stamp kind=dragdrop on legacy migrated items"
```

---

## Task 4: Course-select entry — Play ▶ → `pickCourse` (RESOLVED: always show select)

**Files:**
- Modify: `src/components/PetRoom.tsx:184` (the Play ▶ `PressButton`)
- Test: `src/components/PetRoom.test.tsx` (extend; create if absent)

- [ ] **Step 1: Write failing test** in `src/components/PetRoom.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PetRoom } from './PetRoom';
import { useGameStore } from '../state/gameStore';

describe('PetRoom Play button', () => {
  it('routes to course select', () => {
    render(<PetRoom />);
    fireEvent.click(screen.getByText(/Play/));
    expect(useGameStore.getState().screen).toBe('pickCourse');
  });
});
```

(If `PetRoom` needs a hatched pet to render Play, seed `useGameStore.setState` with a hatched pet in a `beforeEach` mirroring existing component tests.)

- [ ] **Step 2: Run — verify fail.** `npm test -- src/components/PetRoom.test.tsx` → FAIL (screen is `pickDrill`).

- [ ] **Step 3: Change the Play ▶ handler** at `src/components/PetRoom.tsx:184`:

```typescript
<PressButton
  onClick={() => setScreen('pickCourse')}
  className="min-h-12 flex-1 rounded-2xl border-b-4 border-emerald-800 bg-emerald-500 px-3 py-3 text-base font-extrabold text-white shadow active:translate-y-0.5 active:border-b-2"
>
  Play ▶
</PressButton>
```

- [ ] **Step 4: Run — verify pass.** `npm test -- src/components/PetRoom.test.tsx` → PASS. Full `npm test` green (`CourseSelect`→`selectCourse`→`pickDrill` flow already wired in P1).

- [ ] **Step 5: Commit**

```bash
git add src/components/PetRoom.tsx src/components/PetRoom.test.tsx
git commit -m "feat(journey): Play routes to course select"
```

---

## Task 5: L1 toggle state + display helper + toggle component

Persist a per-user `l1Mode` in `gameStore` (audio-settings pattern), bump persist `v13→v14`, add a pure `showL1` display rule and a reusable `L1Toggle` button.

**Files:**
- Modify: `src/state/gameStore.ts` (`l1Mode`, `setL1Mode`, `PersistedState`, `selectPersisted`, `partialize` keep, migrate, `PERSIST_VERSION`)
- Create: `src/content/l1.ts` (pure `showL1`)
- Create: `src/components/L1Toggle.tsx`
- Test: `src/content/l1.test.ts` (new)

- [ ] **Step 1: Write failing test** in `src/content/l1.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { showL1 } from './l1';

describe('showL1 display rule', () => {
  const helper = { th: 'แมว' };
  it('shows Thai only when enabled + TH + helper present', () => {
    expect(showL1({ l1Enabled: true }, 'TH', helper)).toBe('แมว');
  });
  it('hides when unit l1 disabled', () => {
    expect(showL1({ l1Enabled: false }, 'TH', helper)).toBeNull();
  });
  it('hides in ENG mode', () => {
    expect(showL1({ l1Enabled: true }, 'ENG', helper)).toBeNull();
  });
  it('hides when no helper', () => {
    expect(showL1({ l1Enabled: true }, 'TH', undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify fail.** `npm test -- src/content/l1.test.ts` → FAIL.

- [ ] **Step 3: Create `src/content/l1.ts`:**

```typescript
import type { L1Helper } from '../data/types';

export type L1Mode = 'TH' | 'ENG';

/** Spec §4 display rule: show Thai iff unit.l1Enabled && mode==='TH' && helper present. */
export function showL1(
  unit: { l1Enabled?: boolean },
  mode: L1Mode,
  helper: L1Helper | undefined,
): string | null {
  if (!unit.l1Enabled) return null;
  if (mode !== 'TH') return null;
  if (!helper || helper.th.trim() === '') return null;
  return helper.th;
}
```

- [ ] **Step 4: Run — verify pass.** `npm test -- src/content/l1.test.ts` → PASS.

- [ ] **Step 5: Add `l1Mode` to `gameStore`** — mirror the `audio` setting exactly:
  - In `GameState`: `l1Mode: L1Mode; setL1Mode: (m: L1Mode) => void;` (import `L1Mode` from `../content/l1`).
  - In fresh state: `l1Mode: 'TH',`.
  - Action: `setL1Mode: (l1Mode) => set({ l1Mode }),`.
  - `PersistedState` Pick: add `| 'l1Mode'`.
  - `selectPersisted`: add `l1Mode: s.l1Mode,`.
  - In `migrate`: backfill `l1Mode: (persisted as { l1Mode?: L1Mode }).l1Mode ?? 'TH'`.
  - Bump `export const PERSIST_VERSION = 14;`.

- [ ] **Step 6: Create `src/components/L1Toggle.tsx`:**

```typescript
import { useGameStore } from '../state/gameStore';

/** TH/ENG toggle. Render only when the unit's l1Enabled is true. */
export function L1Toggle() {
  const mode = useGameStore((s) => s.l1Mode);
  const setMode = useGameStore((s) => s.setL1Mode);
  return (
    <div role="group" aria-label="Language helper" className="flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-bold">
      {(['TH', 'ENG'] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={`rounded-full px-3 py-1 ${mode === m ? 'bg-sky-500 text-white' : 'text-slate-500'}`}
        >
          {m === 'TH' ? '🇹🇭 ไทย' : 'ENG'}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Run + build.** `npm test` green; `npm run build` clean (verify the persist migration compiles).

- [ ] **Step 8: Commit**

```bash
git add src/state/gameStore.ts src/content/l1.ts src/content/l1.test.ts src/components/L1Toggle.tsx
git commit -m "feat(l1): per-user TH/ENG toggle state, display rule, toggle component"
```

---

## Task 6: Flashcard screen

Front/back flip, optional 🔊 audio, self-grade Again/Got-it, **completion-based (no star penalty)**. L1 helper line under the card, gated by the unit + toggle.

**Files:**
- Create: `src/components/FlashcardScreen.tsx`
- Modify: `src/App.tsx` `screenKeyAndNode` (route `kind === 'flashcard'`)
- Test: `src/components/FlashcardScreen.test.tsx` (new)

- [ ] **Step 1: Write failing test:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlashcardScreen } from './FlashcardScreen';
import type { FlashcardItem } from '../data/types';

const items: FlashcardItem[] = [
  { id: 'f1', kind: 'flashcard', level: 1, front: 'cat', back: 'แมว' },
  { id: 'f2', kind: 'flashcard', level: 1, front: 'dog', back: 'หมา' },
];

describe('FlashcardScreen', () => {
  it('flips to reveal back then advances on Got it', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    expect(screen.getByText('cat')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    expect(screen.getByText('แมว')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.getByText('dog')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fail.** Component does not exist.

- [ ] **Step 3: Create `src/components/FlashcardScreen.tsx`** (reuse `finishRound` from gameStore for completion — full stars, no slip; reuse the `speak`/audio + thaiHint render pattern from `DrillScreen.tsx:178`):

```typescript
import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { showL1 } from '../content/l1';
import { L1Toggle } from './L1Toggle';
import type { FlashcardItem } from '../data/types';

export function FlashcardScreen({ items, unit }: { items: FlashcardItem[]; unit: { l1Enabled?: boolean } }) {
  const finishRound = useGameStore((s) => s.finishRound);
  const l1Mode = useGameStore((s) => s.l1Mode);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const item = items[index];
  const th = showL1(unit, l1Mode, item.l1);

  function grade() {
    // Practice: completion-based, full stars, no slip penalty (spec §7).
    if (index + 1 >= items.length) {
      finishRound({ drill: 'mixed', level: item.level, stars: 3, correctCount: items.length });
      return;
    }
    setIndex(index + 1);
    setFlipped(false);
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-6">
      {unit.l1Enabled && <div className="self-end"><L1Toggle /></div>}
      <button
        type="button"
        aria-label="flip card"
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-48 w-full max-w-sm items-center justify-center rounded-3xl border-2 border-slate-200 bg-white text-3xl font-extrabold shadow"
      >
        {flipped ? item.back : item.front}
      </button>
      {th && <p className="text-lg font-bold text-slate-600">{th}</p>}
      <div className="mt-auto flex w-full max-w-sm gap-3">
        <button type="button" onClick={grade} className="flex-1 rounded-2xl bg-slate-200 py-3 font-black">Again</button>
        <button type="button" onClick={grade} className="flex-1 rounded-2xl bg-emerald-500 py-3 font-black text-white">Got it</button>
      </div>
    </div>
  );
}
```

(Note: both Again and Got-it advance with full completion — flashcard is ungraded practice per spec §7. Audio 🔊 button: add the `DrillScreen.tsx:178` speaker pattern wired to `item.audio` when present — optional, gate on `item.audio`.)

- [ ] **Step 4: Route it in `src/App.tsx` `screenKeyAndNode`** — replace the `ComingSoon` fallthrough for flashcard. The function needs the active `unit` (for `l1Enabled`); thread it from the same place `kind`/`items` come from (the lesson's unit). Add:

```typescript
import { isFlashcard } from './data/types';
import { FlashcardScreen } from './components/FlashcardScreen';
// ...
if (kind === 'flashcard') return { key: 'flashcard', node: <FlashcardScreen items={items.filter(isFlashcard)} unit={unit} /> };
```

Extend `screenKeyAndNode`'s signature with `unit: { l1Enabled?: boolean }` and pass it from the caller (the active unit already resolved when computing `items`). If the caller lacks the unit handy, derive it from the active course + `currentLessonId`.

- [ ] **Step 5: Run — verify pass.** `npm test -- src/components/FlashcardScreen.test.tsx` → PASS. Full `npm test` green; `npm run build` clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/FlashcardScreen.tsx src/components/FlashcardScreen.test.tsx src/App.tsx
git commit -m "feat(activity): flashcard screen (flip, audio, completion-based)"
```

---

## Task 7: Matching screen

Drag prompt tiles (left) into target slots (right); correct when every prompt sits in its right slot; wrong pairs clear, keep correct (mirror drag-drop selective clear). Per-pair Thai on the prompt.

**Files:**
- Create: `src/components/MatchingScreen.tsx`
- Modify: `src/App.tsx` `screenKeyAndNode` (route `kind === 'matching'`)
- Test: `src/components/MatchingScreen.test.tsx` (new)

- [ ] **Step 1: Write failing test** (assert grading logic via a click-to-assign fallback so the test doesn't depend on dnd pointer simulation — expose a testable assign handler):

```typescript
import { describe, it, expect } from 'vitest';
import { gradeMatching } from './MatchingScreen';

describe('gradeMatching', () => {
  const pairs = [{ left: 'cat', right: 'แมว' }, { left: 'dog', right: 'หมา' }];
  it('all correct → complete', () => {
    expect(gradeMatching(pairs, { cat: 'แมว', dog: 'หมา' })).toEqual({ done: true, wrong: [] });
  });
  it('reports wrong prompts, keeps correct', () => {
    expect(gradeMatching(pairs, { cat: 'หมา', dog: 'หมา' })).toEqual({ done: false, wrong: ['cat'] });
  });
});
```

- [ ] **Step 2: Run — verify fail.** `gradeMatching` not exported.

- [ ] **Step 3: Create `src/components/MatchingScreen.tsx`** with an exported pure `gradeMatching` plus the dnd UI (reuse `@dnd-kit` `useDroppable`/`useDraggable` as `DrillScreen`/`SentenceSlots` do):

```typescript
import { useState } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { useGameStore } from '../state/gameStore';
import { showL1 } from '../content/l1';
import { L1Toggle } from './L1Toggle';
import type { MatchingItem, MatchingPair } from '../data/types';

/** Pure grader: assignment maps prompt(left) → chosen right. */
export function gradeMatching(pairs: MatchingPair[], assignment: Record<string, string | undefined>) {
  const wrong = pairs.filter((p) => assignment[p.left] !== undefined && assignment[p.left] !== p.right).map((p) => p.left);
  const done = pairs.every((p) => assignment[p.left] === p.right);
  return { done, wrong };
}

export function MatchingScreen({ items, unit }: { items: MatchingItem[]; unit: { l1Enabled?: boolean } }) {
  const finishRound = useGameStore((s) => s.finishRound);
  const l1Mode = useGameStore((s) => s.l1Mode);
  const [index, setIndex] = useState(0);
  const [assignment, setAssignment] = useState<Record<string, string | undefined>>({});
  const [mistakes, setMistakes] = useState(0);
  const item = items[index];

  function place(left: string, right: string) {
    const next = { ...assignment, [left]: right };
    const { done, wrong } = gradeMatching(item.pairs, next);
    if (wrong.length) {
      setMistakes((m) => m + 1);
      for (const w of wrong) next[w] = undefined; // clear wrong, keep correct
    }
    setAssignment(next);
    if (done) {
      if (index + 1 >= items.length) {
        finishRound({ drill: 'mixed', level: item.level, stars: mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1, correctCount: items.length });
      } else {
        setIndex(index + 1);
        setAssignment({});
        setMistakes(0);
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {unit.l1Enabled && <div className="self-end"><L1Toggle /></div>}
      <DndContext onDragEnd={(e) => { if (e.over) place(String(e.active.id), String(e.over.id)); }}>
        <div className="flex justify-around gap-4">
          <div className="flex flex-col gap-2">
            {item.pairs.map((p) => {
              const th = showL1(unit, l1Mode, p.l1);
              return assignment[p.left] === p.right ? null : (
                <PromptTile key={p.left} id={p.left} label={p.left} sub={th} />
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            {item.pairs.map((p) => <TargetSlot key={p.right} id={p.right} label={p.right} filledBy={Object.entries(assignment).find(([, r]) => r === p.right)?.[0]} />)}
          </div>
        </div>
      </DndContext>
    </div>
  );
}

function PromptTile({ id, label, sub }: { id: string; label: string; sub: string | null }) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id });
  return (
    <button ref={setNodeRef} {...listeners} {...attributes} type="button"
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className="rounded-xl border-2 border-slate-300 bg-white px-4 py-3 font-bold">
      {label}{sub && <span className="block text-xs text-slate-500">{sub}</span>}
    </button>
  );
}

function TargetSlot({ id, label, filledBy }: { id: string; label: string; filledBy?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} data-testid={`target-${id}`}
      className={`min-h-12 rounded-xl border-2 px-4 py-3 ${isOver ? 'border-emerald-500 bg-emerald-50' : filledBy ? 'border-emerald-400 bg-emerald-100' : 'border-dashed border-slate-300 bg-white'}`}>
      <span className="block text-xs opacity-70">{label}</span>
      {filledBy && <span className="font-bold">{filledBy}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Route it in `src/App.tsx`:**

```typescript
import { isMatching } from './data/types';
import { MatchingScreen } from './components/MatchingScreen';
// ...
if (kind === 'matching') return { key: 'matching', node: <MatchingScreen items={items.filter(isMatching)} unit={unit} /> };
```

- [ ] **Step 5: Run — verify pass.** `npm test -- src/components/MatchingScreen.test.tsx` → PASS. Full `npm test` green; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/MatchingScreen.tsx src/components/MatchingScreen.test.tsx src/App.tsx
git commit -m "feat(activity): matching screen (drag pairs, selective clear, per-pair L1)"
```

---

## Task 8: Fill-blank screen + grading/hints

Typed input, **strict trimmed exact** match against `answer ∪ alternates`; wrong → escalating hint **L1 → first-letter → length-dots → reveal**, no auto-advance.

**Files:**
- Create: `src/domain/fillblank.ts` (pure grade + hint ladder)
- Create: `src/components/FillBlankScreen.tsx`
- Modify: `src/App.tsx` `screenKeyAndNode`
- Test: `src/domain/fillblank.test.ts` (new)

- [ ] **Step 1: Write failing test** in `src/domain/fillblank.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { gradeFillBlank, hintAt } from './fillblank';

describe('gradeFillBlank', () => {
  it('strict trimmed match against answer', () => {
    expect(gradeFillBlank({ answer: 'eat' }, '  eat ')).toBe(true);
  });
  it('accepts alternates', () => {
    expect(gradeFillBlank({ answer: 'eat', alternates: ['eats'] }, 'eats')).toBe(true);
  });
  it('rejects wrong', () => {
    expect(gradeFillBlank({ answer: 'eat' }, 'drink')).toBe(false);
  });
});

describe('hintAt ladder', () => {
  const item = { answer: 'eat', l1: { th: 'กิน' } };
  it('0 → L1, 1 → first letter, 2 → length dots, 3+ → reveal', () => {
    expect(hintAt(item, 0)).toBe('กิน');
    expect(hintAt(item, 1)).toBe('e…');
    expect(hintAt(item, 2)).toBe('• • •');
    expect(hintAt(item, 3)).toBe('eat');
  });
  it('skips L1 step when no helper', () => {
    expect(hintAt({ answer: 'eat' }, 0)).toBe('e…');
  });
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Create `src/domain/fillblank.ts`:**

```typescript
import type { FillBlankItem } from '../data/types';

export function gradeFillBlank(item: Pick<FillBlankItem, 'answer' | 'alternates'>, input: string): boolean {
  const guess = input.trim();
  return guess === item.answer.trim() || (item.alternates ?? []).some((a) => a.trim() === guess);
}

/** Escalating hint. Step counts wrong attempts. L1 step is skipped when no helper. */
export function hintAt(item: Pick<FillBlankItem, 'answer' | 'l1'>, step: number): string {
  const ladder: string[] = [];
  if (item.l1 && item.l1.th.trim() !== '') ladder.push(item.l1.th);
  ladder.push(`${item.answer[0]}…`);
  ladder.push(item.answer.split('').map(() => '•').join(' '));
  ladder.push(item.answer);
  return ladder[Math.min(step, ladder.length - 1)];
}
```

- [ ] **Step 4: Run — verify pass.** `npm test -- src/domain/fillblank.test.ts` → PASS.

- [ ] **Step 5: Create `src/components/FillBlankScreen.tsx`:**

```typescript
import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { gradeFillBlank, hintAt } from '../domain/fillblank';
import { L1Toggle } from './L1Toggle';
import type { FillBlankItem } from '../data/types';

export function FillBlankScreen({ items, unit }: { items: FillBlankItem[]; unit: { l1Enabled?: boolean } }) {
  const finishRound = useGameStore((s) => s.finishRound);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [wrongCount, setWrongCount] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const item = items[index];
  const [a, b] = item.template.split('___');

  function submit() {
    if (gradeFillBlank(item, value)) {
      if (index + 1 >= items.length) {
        finishRound({ drill: 'mixed', level: item.level, stars: wrongCount === 0 ? 3 : wrongCount <= 2 ? 2 : 1, correctCount: items.length });
        return;
      }
      setIndex(index + 1); setValue(''); setWrongCount(0); setHint(null);
    } else {
      setHint(hintAt(item, wrongCount));
      setWrongCount((w) => w + 1);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-6">
      {unit.l1Enabled && <div className="self-end"><L1Toggle /></div>}
      <p className="text-2xl font-bold">{a}<span className="mx-1 border-b-4 border-slate-400 px-6">&nbsp;</span>{b}</p>
      <input
        aria-label="answer" value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="rounded-xl border-2 border-slate-300 px-4 py-2 text-center text-lg" />
      {hint && <p className="text-lg font-bold text-amber-600">{hint}</p>}
      <button type="button" onClick={submit} className="rounded-2xl bg-emerald-500 px-6 py-3 font-black text-white">Check</button>
    </div>
  );
}
```

- [ ] **Step 6: Route it in `src/App.tsx`:**

```typescript
import { isFillBlank } from './data/types';
import { FillBlankScreen } from './components/FillBlankScreen';
// ...
if (kind === 'fillblank') return { key: 'fillblank', node: <FillBlankScreen items={items.filter(isFillBlank)} unit={unit} /> };
```

After this task the `ComingSoon` branch in `screenKeyAndNode` should be unreachable for all four kinds; keep it as a defensive fallback.

- [ ] **Step 7: Run — verify pass.** Full `npm test` green; build clean.

- [ ] **Step 8: Commit**

```bash
git add src/domain/fillblank.ts src/domain/fillblank.test.ts src/components/FillBlankScreen.tsx src/App.tsx
git commit -m "feat(activity): fill-blank screen (strict match, escalating hints)"
```

---

## Task 9: Drag-drop `hidePos` difficulty

Thread `hidePos` (already on `DragDropItem`) from `DrillScreen` into `SentenceSlots` → hide the POS label span and skip the POS tint.

**Files:**
- Modify: `src/components/SentenceSlots.tsx` (`Slot` + the list component — accept `hidePos`)
- Modify: `src/components/DrillScreen.tsx` (pass `item.hidePos` down)
- Test: `src/components/SentenceSlots.test.tsx` (extend; create if absent)

- [ ] **Step 1: Write failing test:**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SentenceSlots } from './SentenceSlots';

function renderSlots(hidePos: boolean) {
  return render(
    <DndContext>
      <SentenceSlots slots={['Pronoun']} placed={[null]} current={0} onClear={() => {}} hidePos={hidePos} />
    </DndContext>,
  );
}

describe('SentenceSlots hidePos', () => {
  it('shows POS label when hidePos is false', () => {
    renderSlots(false);
    expect(screen.getByText('Pronoun')).toBeInTheDocument();
  });
  it('hides POS label when hidePos is true', () => {
    renderSlots(true);
    expect(screen.queryByText('Pronoun')).toBeNull();
  });
});
```

(Match the real `SentenceSlots` prop names — adjust the JSX above to its actual signature found at implementation time.)

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Thread `hidePos`** through `SentenceSlots` and `Slot`. In `Slot` (`SentenceSlots.tsx:19-55`):
  - Accept `hidePos?: boolean`.
  - Label span (line ~39): `{!hidePos && <span className="block text-xs opacity-70">{label}</span>}`.
  - Tint (line ~29): when filled, use `hidePos ? 'bg-white text-slate-900 border-slate-300' : posClasses(label)`.
  - In `DrillScreen.tsx`, pass `hidePos={item.hidePos}` to the slots component.

- [ ] **Step 4: Run — verify pass.** Full `npm test` green; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/SentenceSlots.tsx src/components/DrillScreen.tsx src/components/SentenceSlots.test.tsx
git commit -m "feat(dragdrop): hidePos difficulty hides POS label + tint"
```

---

## Task 10: Kind-aware food + scoring

Map the four content kinds to food groups and ensure stars are computed per round consistently across new screens. Today `DRILL_FOOD` is keyed by `DrillType`; add a `KIND_FOOD` mapping keyed by `ContentKind`.

**Files:**
- Modify: `src/data/food.ts` (add `KIND_FOOD`)
- Modify: `src/domain/scoring.ts` (helper used by new screens, if centralizing star calc)
- Test: `src/data/food.test.ts` (extend; create if absent)

- [ ] **Step 1: Write failing test** in `src/data/food.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { KIND_FOOD, FOOD_META } from './food';

describe('KIND_FOOD', () => {
  it('maps every content kind to a known food group', () => {
    for (const kind of ['flashcard', 'matching', 'dragdrop', 'fillblank'] as const) {
      expect(FOOD_META[KIND_FOOD[kind]]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Add `KIND_FOOD` to `src/data/food.ts`:**

```typescript
import type { ContentKind } from './types';

/** Each player-facing content kind feeds a food group (boss kinds reuse boss rewards). */
export const KIND_FOOD: Record<Exclude<ContentKind, 'boss'>, FoodGroup> = {
  flashcard: 'protein',
  matching: 'veggie',
  dragdrop: 'vitamin',
  fillblank: 'treat',
};
```

(Keep the existing `DRILL_FOOD` for dragdrop variants — it still drives `DrillScreen`'s reward. `KIND_FOOD` is the kind-level mapping the new screens use when reporting rewards.)

- [ ] **Step 4: (If centralizing) add a star helper to `scoring.ts`** so flashcard's completion rule and the others share one source. The new screens currently inline `mistakes===0?3:...`; optionally replace with `computeStars({ hints: 0, mistakes })` (already exists, `scoring.ts:7`) for the graded kinds and force `3` for flashcard. No behavior change required if inlined — this step is optional cleanup; if skipped, delete it from the task.

- [ ] **Step 5: Run — verify pass.** Full `npm test` green; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/data/food.ts src/data/food.test.ts
git commit -m "feat(scoring): map content kinds to food groups"
```

---

## Task 11: Admin item editor switches by `kind`

One `kind` dropdown swaps the form. Every kind shows an optional `l1.th` block. Flashcard/matching/fillblank get real forms; dragdrop keeps current fields + a `hidePos` checkbox; traps stay JSON.

**Files:**
- Modify: `src/components/admin/ItemEditor.tsx`
- Test: `src/components/admin/ItemEditor.test.tsx` (new)

- [ ] **Step 1: Write failing test:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemEditor } from './ItemEditor';
import type { ContentItem } from '../../data/types';

describe('ItemEditor by kind', () => {
  it('switching kind to flashcard shows front/back', () => {
    const onChange = vi.fn();
    const item: ContentItem = { id: 'f1', kind: 'flashcard', level: 1, front: 'cat', back: 'แมว' };
    render(<ItemEditor item={item} onChange={onChange} />);
    expect(screen.getByLabelText(/front/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/back/i)).toBeInTheDocument();
  });
  it('dragdrop shows hidePos checkbox', () => {
    const item: ContentItem = { id: 'd1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'แมว', slots: ['Pronoun'], answer: ['I'] };
    render(<ItemEditor item={item} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/hidePos/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Rewrite `src/components/admin/ItemEditor.tsx`** — widen prop to `ContentItem`, add a `kind` dropdown, render the right sub-form. Keep the existing dragdrop fields (from the current 33-line editor) and add `hidePos`. Common: `id`, `level`, `kind`, and an `l1.th` text input (writes `l1: th ? { th } : undefined`). Per kind:
  - **flashcard:** `front`, `back`, `audio` text inputs.
  - **matching:** a repeating pair editor (`left`, `right`, `th`) with add/remove pair buttons; serialize to `pairs: MatchingPair[]`.
  - **dragdrop:** existing `drill` select, `thaiHint`, `slots`(csv), `answer`(csv), `distractors`(csv) + new `hidePos` checkbox. Traps note stays ("Traps edited as JSON later").
  - **fillblank:** `template`, `answer`, `alternates`(csv).

Switching `kind` resets to a minimal valid item of that kind (so the discriminated union stays sound):

```typescript
function blankOf(kind: ContentItem['kind'], id: string, level: number): ContentItem {
  switch (kind) {
    case 'flashcard': return { id, kind, level, front: '', back: '' };
    case 'matching': return { id, kind, level, pairs: [{ left: '', right: '' }, { left: '', right: '' }] };
    case 'dragdrop': return { id, kind, level, drill: 'pattern', thaiHint: '', slots: [], answer: [] };
    case 'fillblank': return { id, kind, level, template: '___', answer: '' };
  }
}
```

- [ ] **Step 4: Run — verify pass.** `npm test -- src/components/admin/ItemEditor.test.tsx` → PASS. Full `npm test` green; build clean. Verify `PoolTab.updateItem` still saves the widened item (it spreads `pool[next.id] = next` — already kind-agnostic).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ItemEditor.tsx src/components/admin/ItemEditor.test.tsx
git commit -m "feat(admin): item editor switches form by content kind"
```

---

## Task 12: Admin journey tab — kind + level + count per node, unit `l1Enabled`

Per node: assign `kind` (drives which pool items are valid to pick) + `level`; the existing item-checkbox list filters to items whose `kind` matches the node. Add a unit-level `l1Enabled` checkbox.

**Files:**
- Modify: `src/components/admin/JourneyTab.tsx`
- Test: `src/components/admin/JourneyTab.test.tsx` (new)

- [ ] **Step 1: Write failing test:**

```typescript
import { describe, it, expect } from 'vitest';
import { eligibleItemIds } from './JourneyTab';
import type { ContentItem } from '../../data/types';

describe('eligibleItemIds', () => {
  it('filters pool to the node kind', () => {
    const pool: Record<string, ContentItem> = {
      d1: { id: 'd1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: '', slots: [], answer: [] },
      f1: { id: 'f1', kind: 'flashcard', level: 1, front: 'a', back: 'b' },
    };
    expect(eligibleItemIds(pool, 'flashcard')).toEqual(['f1']);
  });
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Add `eligibleItemIds` + a `kind` select + unit `l1Enabled` checkbox** to `JourneyTab.tsx`:

```typescript
import type { ContentItem, ContentKind } from '../../data/types';

export function eligibleItemIds(pool: Record<string, ContentItem>, kind: ContentKind): string[] {
  return Object.values(pool).filter((i) => i.kind === kind).map((i) => i.id);
}
```

In the lesson config block (`JourneyTab.tsx:56-69`), add a `kind` select that calls `patchLesson(u, l, { kind })`:

```typescript
<label>kind
  <select className="border px-1" value={selected.l.kind ?? 'dragdrop'}
    onChange={(e) => patchLesson(selected.u.id, selected.l.id, { kind: e.target.value as ContentKind })}>
    {['flashcard', 'matching', 'dragdrop', 'fillblank'].map((k) => <option key={k}>{k}</option>)}
  </select>
</label>
```

Replace the item-checkbox list (`JourneyTab.tsx:71-78`) `poolIds` source with `eligibleItemIds(bundle.pool, selected.l.kind ?? 'dragdrop')` so admins only assign items matching the node's kind.

Add the unit `l1Enabled` checkbox in the unit-level section:

```typescript
<label><input type="checkbox" checked={!!selected.u.l1Enabled}
  onChange={(e) => patchUnit(selected.u.id, { l1Enabled: e.target.checked })} /> L1 enabled (TH/ENG toggle)</label>
```

(If no `patchUnit` exists, add one mirroring `patchLesson` — merge a partial into the unit and bubble `onChange({ ...bundle, units })`.)

- [ ] **Step 4: Run — verify pass.** Full `npm test` green; build clean. Manually verify in `/#admin`: create a flashcard item in Pool, set a node's kind to flashcard, assign it, save, then play that node renders the FlashcardScreen.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/JourneyTab.tsx src/components/admin/JourneyTab.test.tsx
git commit -m "feat(admin): journey node kind+level+count, unit l1Enabled"
```

---

## Final phase verification (before P3 handoff)

- [ ] `npm test` — all green (P1 baseline 731 + new tests).
- [ ] `npm run build` — clean, no warnings.
- [ ] Manual smoke (guest play): Play ▶ → course select → unit map → each node kind renders its screen (flashcard flips + completes; matching grades + clears wrong; fill-blank strict + hints escalate; dragdrop unchanged, `hidePos` items hide POS).
- [ ] L1: a unit with `l1Enabled` shows the TH/ENG toggle; TH reveals helper text; ENG hides it; toggle persists across reload (gameStore v14).
- [ ] Admin: item editor switches by kind; journey tab assigns typed nodes; unit l1Enabled checkbox round-trips through save.
- [ ] Confirm `firebase.json` still modified-but-unstaged; nothing staged beyond the listed files; `seed.ts` untouched (or regenerated via `seed:export`, not by hand).
- [ ] Write the **P3 handoff** (gated/final bosses + Excel import + `seed.ts` regen with kind-tagged content + enforce `finalBoss` in `validateCourse`).

---

## Self-review against spec (gaps to watch during execution)

- **Audio on flashcard** (spec §5 🔊) is noted as optional in Task 6 — wire it if `item.audio` is present using the `DrillScreen.tsx:178` speaker pattern.
- **`screenKeyAndNode` needs the active `unit`** for `l1Enabled` — Tasks 6-8 thread it; confirm the caller resolves the unit from the active course + `currentLessonId`. If awkward, store the active unit's `l1Enabled` alongside `items` when the lesson starts.
- **Scoring centralization** (Task 10 Step 4) is optional — new screens inline star calc; fine for P2.
- **Excel import, gated/final bosses, seed regen, `finalBoss` enforcement** are explicitly **P3** — not in this plan.

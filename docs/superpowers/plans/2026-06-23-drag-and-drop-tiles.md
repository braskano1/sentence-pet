# Drag-and-Drop Tile Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tap-to-place with drag-to-place for sentence tiles using @dnd-kit, keeping all domain/store logic and round behavior unchanged.

**Architecture:** Drop-resolution is made pure and exported (`parseDndId`, `placeTile` in `src/domain/placement.ts`) so it is unit-tested without simulating drags (jsdom has zero-size layout, which breaks @dnd-kit's geometry sensors). `DrillScreen` wraps the screen in a `DndContext`, tiles become draggables, slots become droppables, and `onDragEnd` calls the pure helpers. Tap-to-clear a filled slot is kept. Domain, scoring, store, and config are untouched — the existing 44 tests stay green.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand + Vitest; **new:** `@dnd-kit/core`.

**Working dir:** `D:\ai_projects\AI_design_thinking\sentence-pet` (git repo, branch off `main`). All paths below are relative to it.

---

### Task 1: Add @dnd-kit and confirm baseline green

**Files:**
- Modify: `package.json` (dependency added by npm)

- [ ] **Step 1: Confirm clean baseline**

Run: `npm run test`
Expected: `Tests  44 passed (44)`.

- [ ] **Step 2: Install @dnd-kit/core**

Run: `npm install @dnd-kit/core`
Expected: installs. A React-19 peer-dependency **warning** is acceptable; an install **error** is not. If it errors, retry with a React-19-compatible version: `npm install @dnd-kit/core@^6.3.1` (or latest that resolves), and note the version used.

- [ ] **Step 3: Confirm still green after install**

Run: `npm run test && npm run build`
Expected: 44 tests pass, build clean.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @dnd-kit/core for drag-and-drop tiles"
```

---

### Task 2: Pure drop-resolution helpers (`placement.ts`)

These two pure functions hold ALL the placement logic. Draggable ids are `tile-{i}` (tile index — tiles can contain duplicate words, so identity is by index). Droppable ids are `slot-{i}`.

**Files:**
- Create: `src/domain/placement.ts`
- Test: `src/domain/placement.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/placement.test.ts
import { describe, expect, it } from 'vitest';
import { parseDndId, placeTile, type PlacementState } from './placement';

describe('parseDndId', () => {
  it('parses a tile id', () => {
    expect(parseDndId('tile-3')).toEqual({ kind: 'tile', index: 3 });
  });
  it('parses a slot id', () => {
    expect(parseDndId('slot-0')).toEqual({ kind: 'slot', index: 0 });
  });
  it('returns null for an unknown id', () => {
    expect(parseDndId('nope')).toBeNull();
  });
});

describe('placeTile', () => {
  const tiles = ['I', 'run'];
  const fresh = (): PlacementState => ({ placed: [null, null], used: [false, false] });

  it('places the dragged tile into the chosen slot and marks it used', () => {
    const next = placeTile(fresh(), tiles, 1, 0); // tile "run" -> slot 0
    expect(next.placed).toEqual(['run', null]);
    expect(next.used).toEqual([false, true]);
  });

  it('ignores a drop onto an already-filled slot (returns same state)', () => {
    const state: PlacementState = { placed: ['I', null], used: [true, false] };
    const next = placeTile(state, tiles, 1, 0); // slot 0 occupied
    expect(next).toBe(state);
  });

  it('ignores a tile that is already used (returns same state)', () => {
    const state: PlacementState = { placed: ['I', null], used: [true, false] };
    const next = placeTile(state, tiles, 0, 1); // tile 0 already used
    expect(next).toBe(state);
  });

  it('handles duplicate words by tile index', () => {
    const dupTiles = ['the', 'the', 'cat'];
    const state: PlacementState = { placed: [null, null, null], used: [false, false, false] };
    const next = placeTile(state, dupTiles, 1, 2); // second "the" -> slot 2
    expect(next.placed).toEqual([null, null, 'the']);
    expect(next.used).toEqual([false, true, false]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/placement.test.ts`
Expected: FAIL — `placement.ts` does not exist / exports missing.

- [ ] **Step 3: Write the implementation**

```ts
// src/domain/placement.ts

export interface PlacementState {
  placed: (string | null)[];
  used: boolean[];
}

export type DndId = { kind: 'tile' | 'slot'; index: number };

/** Parse a draggable/droppable id like "tile-3" or "slot-0". */
export function parseDndId(id: string): DndId | null {
  const m = /^(tile|slot)-(\d+)$/.exec(id);
  if (!m) return null;
  return { kind: m[1] as 'tile' | 'slot', index: Number(m[2]) };
}

/**
 * Place the tile at `tileIndex` into `slotIndex`.
 * No-op (returns the SAME state object) if the slot is filled or the tile is used,
 * so callers can detect "nothing changed" by reference equality.
 */
export function placeTile(
  state: PlacementState,
  tiles: string[],
  tileIndex: number,
  slotIndex: number,
): PlacementState {
  if (state.placed[slotIndex] !== null) return state;
  if (state.used[tileIndex]) return state;
  const placed = [...state.placed];
  const used = [...state.used];
  placed[slotIndex] = tiles[tileIndex];
  used[tileIndex] = true;
  return { placed, used };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/placement.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/placement.ts src/domain/placement.test.ts
git commit -m "feat: pure drop-resolution helpers (parseDndId, placeTile)"
```

---

### Task 3: Make tray tiles draggable

`WordTray` currently calls `onPickWord` on click. Replace with `useDraggable` tiles. Tap-to-place is gone, so `onPickWord` is removed. The parent now needs the tile's **index** for drag identity, so the tray no longer pre-filters used tiles — it renders all tiles and hides used ones via a `used` prop (so indices stay stable and match the parent's `tiles`/`used` arrays).

**Files:**
- Modify: `src/components/WordTray.tsx`
- Test: `src/components/WordTray.test.tsx` (rewrite)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/WordTray.test.tsx
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { describe, expect, it } from 'vitest';
import { WordTray } from './WordTray';

function renderTray(tiles: string[], used: boolean[]) {
  return render(
    <DndContext>
      <WordTray tiles={tiles} used={used} />
    </DndContext>,
  );
}

describe('WordTray', () => {
  it('renders a draggable button for each unused tile', () => {
    renderTray(['I', 'run'], [false, false]);
    expect(screen.getByRole('button', { name: 'I' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'run' })).toBeInTheDocument();
  });

  it('does not render tiles already used', () => {
    renderTray(['I', 'run'], [true, false]);
    expect(screen.queryByRole('button', { name: 'I' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'run' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/WordTray.test.tsx`
Expected: FAIL — `WordTray` still expects `onPickWord`/`tiles` only; `used` prop unused, type error or assertion fail.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/WordTray.tsx
import { useDraggable } from '@dnd-kit/core';

interface Props {
  tiles: string[];
  used: boolean[];
}

function Tile({ word, index }: { word: string; index: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tile-${index}` });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`min-h-12 touch-none px-5 py-3 rounded-xl bg-indigo-500 text-white text-lg font-semibold shadow active:scale-95 ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      {word}
    </button>
  );
}

export function WordTray({ tiles, used }: Props) {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {tiles.map((word, i) =>
        used[i] ? null : <Tile key={`tile-${i}`} word={word} index={i} />,
      )}
    </div>
  );
}
```

Note: `touch-none` (Tailwind `touch-action: none`) is required so the browser does not scroll/zoom instead of starting the drag on touch devices.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/WordTray.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/WordTray.tsx src/components/WordTray.test.tsx
git commit -m "feat: tray tiles are draggable (useDraggable)"
```

---

### Task 4: Make slots droppable (keep tap-to-clear)

`SentenceSlots` keeps its tap-to-clear button behavior and gains a `useDroppable` wrapper per slot, with a highlight when a tile hovers an empty slot.

**Files:**
- Modify: `src/components/SentenceSlots.tsx`
- Test: `src/components/SentenceSlots.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SentenceSlots.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { describe, expect, it, vi } from 'vitest';
import { SentenceSlots } from './SentenceSlots';

describe('SentenceSlots', () => {
  it('capitalizes the first placed word for display', () => {
    render(
      <DndContext>
        <SentenceSlots slots={['Pronoun', 'Verb']} placed={['i', 'run']} onClearSlot={() => {}} />
      </DndContext>,
    );
    expect(screen.getByText('I')).toBeInTheDocument(); // first slot capitalized
    expect(screen.getByText('run')).toBeInTheDocument();
  });

  it('calls onClearSlot when a filled slot is tapped', async () => {
    const onClearSlot = vi.fn();
    render(
      <DndContext>
        <SentenceSlots slots={['Pronoun', 'Verb']} placed={['i', null]} onClearSlot={onClearSlot} />
      </DndContext>,
    );
    await userEvent.click(screen.getByText('I'));
    expect(onClearSlot).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/SentenceSlots.test.tsx`
Expected: FAIL — current `SentenceSlots` renders fine but is not wrapped for droppable; this test passes only after the droppable refactor compiles. (If it already passes, still proceed — the refactor in Step 3 must keep it green.)

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/SentenceSlots.tsx
import { useDroppable } from '@dnd-kit/core';
import type { PosLabel } from '../data/types';
import { capitalizeFirst } from '../domain/sentence';

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
  index,
  label,
  word,
  onClear,
}: {
  index: number;
  label: PosLabel;
  word: string | null;
  onClear: (i: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
  const empty = word === null;
  return (
    <button
      ref={setNodeRef}
      onClick={() => !empty && onClear(index)}
      className={`min-h-12 min-w-20 px-4 py-3 rounded-xl border-2 border-dashed text-lg font-semibold ${
        isOver && empty ? 'border-emerald-500 bg-emerald-50' : 'border-slate-400 bg-white'
      }`}
    >
      <span className="block text-xs text-slate-400">{label}</span>
      <span className="block text-slate-900">{empty ? ' ' : displayToken(word, index)}</span>
    </button>
  );
}

export function SentenceSlots({ slots, placed, onClearSlot }: Props) {
  const allFilled = placed.every((p) => p !== null);
  return (
    <div className="flex flex-wrap gap-2 items-end justify-center">
      {slots.map((label, i) => (
        <Slot key={i} index={i} label={label} word={placed[i]} onClear={onClearSlot} />
      ))}
      {allFilled && (
        <span className="self-end pb-3 text-2xl font-semibold text-slate-900">.</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/SentenceSlots.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SentenceSlots.tsx src/components/SentenceSlots.test.tsx
git commit -m "feat: slots are droppable with drag-over highlight"
```

---

### Task 5: Wire DrillScreen — DndContext, sensors, onDragEnd, DragOverlay

Replace `handlePick`/tap-place with drag wiring. `placeTile` decides placement; when all slots fill, the existing `evaluate()` runs unchanged.

**Files:**
- Modify: `src/components/DrillScreen.tsx`
- Test: `src/components/DrillScreen.test.tsx` (rewrite)

- [ ] **Step 1: Write the implementation**

```tsx
// src/components/DrillScreen.tsx
import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { itemsForLevel } from '../data/wordBank';
import { isPlacementCorrect, shuffle } from '../domain/check';
import { parseDndId, placeTile } from '../domain/placement';
import { computeStars } from '../domain/scoring';
import { useGameStore } from '../state/gameStore';
import { SentenceSlots } from './SentenceSlots';
import { WordTray } from './WordTray';

export function DrillScreen({ level }: { level: number }) {
  const items = useMemo(() => itemsForLevel(level), [level]);
  const finishRound = useGameStore((s) => s.finishRound);

  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<(string | null)[]>(() => items[0].slots.map(() => null));
  const [used, setUsed] = useState<boolean[]>(() => items[0].answer.map(() => false));
  const [tiles, setTiles] = useState<string[]>(() => shuffle(items[0].answer));
  const [mistakes, setMistakes] = useState(0);
  const [activeWord, setActiveWord] = useState<string | null>(null);

  const item = items[index];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function loadItem(i: number) {
    setPlaced(items[i].slots.map(() => null));
    setUsed(items[i].answer.map(() => false));
    setTiles(shuffle(items[i].answer));
  }

  function handleClear(slotIndex: number) {
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

  function onDragStart(e: DragStartEvent) {
    const id = parseDndId(String(e.active.id));
    if (id?.kind === 'tile') setActiveWord(tiles[id.index]);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveWord(null);
    if (!e.over) return;
    const from = parseDndId(String(e.active.id));
    const to = parseDndId(String(e.over.id));
    if (from?.kind !== 'tile' || to?.kind !== 'slot') return;
    const next = placeTile({ placed, used }, tiles, from.index, to.index);
    if (next.placed === placed) return; // no-op (slot filled / tile used)
    setPlaced(next.placed);
    setUsed(next.used);
    if (next.placed.every((p) => p !== null)) evaluate(next.placed);
  }

  function evaluate(filled: (string | null)[]) {
    if (isPlacementCorrect(filled, item.answer)) {
      const last = index === items.length - 1;
      if (last) {
        finishRound({
          level,
          stars: computeStars({ hints: 0, mistakes }),
          correctCount: items.length,
        });
      } else {
        const ni = index + 1;
        setIndex(ni);
        loadItem(ni);
      }
    } else {
      setMistakes((m) => m + 1);
      loadItem(index); // reshuffle + clear to retry
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full flex-col bg-slate-100 p-4">
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-sm text-slate-500">Sentence {index + 1} of {items.length}</p>
          <p className="text-2xl text-slate-700">{item.thaiHint}</p>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} />
        </div>
        <div className="pb-2">
          <WordTray tiles={tiles} used={used} />
        </div>
      </div>
      <DragOverlay>
        {activeWord ? (
          <div className="min-h-12 px-5 py-3 rounded-xl bg-indigo-600 text-white text-lg font-semibold shadow">
            {activeWord}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Rewrite the DrillScreen test**

Drag placement is covered by `placement.test.ts` (pure). jsdom cannot resolve @dnd-kit geometry, so this test covers render + tap-clear only. Replace the file contents:

```tsx
// src/components/DrillScreen.test.tsx
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { DrillScreen } from './DrillScreen';
import { useGameStore } from '../state/gameStore';

describe('DrillScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders the Thai hint and the POS slots for the first item', () => {
    render(<DrillScreen level={1} />);
    expect(screen.getByText(/Sentence 1 of 5/)).toBeInTheDocument();
    // level-1 frame is Pronoun + Verb
    expect(screen.getAllByText('Pronoun').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Verb').length).toBeGreaterThan(0);
  });

  it('renders a draggable tile for each answer word', () => {
    render(<DrillScreen level={1} />);
    // every tile is a button inside the tray; at least the two answer words exist
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('mounts inside a DndContext without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <DrillScreen level={2} />
        </DndContext>,
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the full suite**

Run: `npm run test`
Expected: all pass (44 original − the old click-driven DrillScreen/WordTray assertions that were replaced + the new placement/component tests). No failures.

- [ ] **Step 4: Type-check / build**

Run: `npm run build`
Expected: clean (no TS errors).

- [ ] **Step 5: Commit**

```bash
git add src/components/DrillScreen.tsx src/components/DrillScreen.test.tsx
git commit -m "feat: drag-and-drop tile placement in DrillScreen"
```

---

### Task 6: Manual verification + doc sync

**Files:**
- Modify: `GAME_DESIGN.md` (repo copy — re-add it; it was missing at handoff) and the H: Drive copy `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md`

- [ ] **Step 1: Manual e2e on a touch viewport**

Run: `npm run dev` → open http://localhost:5173/ → DevTools device-toolbar, phone-portrait (e.g. iPhone 12).
Verify: hatch → Play → **drag** a tile into a slot (touch-emulation), it lands; drag fills all → auto-evaluates; wrong answer reshuffles; **tap** a filled slot returns the tile; round of 5 → reward. Confirm no page scroll fights the drag.

- [ ] **Step 2: Update the design doc (both copies, identical edit)**

In `GAME_DESIGN.md`, change §2 and §10 to record drag-to-place. Concretely:
- §2 first bullet: replace "Slot-fill, tap-to-place." with "Slot-fill, **drag-to-place** (drag a word tile onto its slot; tap a filled slot to clear it)."
- §10 "Match-mode normalization" bullet: replace "tap-tiles only (no typing)" with "drag-tiles only (no typing); tap a filled slot to clear".

Make the SAME edit in the repo copy and the H: Drive copy so they stay in sync.

- [ ] **Step 3: Final gate**

Run: `npm run test && npm run build`
Expected: green + clean.

- [ ] **Step 4: Commit**

```bash
git add GAME_DESIGN.md
git commit -m "docs: record drag-to-place decision (supersedes tap-to-place §2/§10)"
```

- [ ] **Step 5: Branch wrap-up**

Surface the branch state to the reviewer (use superpowers:finishing-a-development-branch to choose merge/PR). Do not merge without review.

---

## Notes for the implementer

- **Do NOT touch** `src/domain/{check,scoring,sentence,xp,pet}.ts`, `src/state/gameStore.ts`, or `src/config/gameConfig.ts` — placement is UI-only.
- **`touch-none` on draggable tiles is mandatory** — without `touch-action: none`, mobile browsers scroll instead of dragging.
- The `.vitest-localstorage*` setup in `vite.config.ts` must stay (Node 25 localStorage shim for zustand persist under vitest). Don't revert it.
- @dnd-kit is hard to integration-test in jsdom (zero-size layout). That is intentional here: placement logic lives in pure `placement.ts` which is fully unit-tested; the DnD wiring is verified by the Task 6 manual e2e.

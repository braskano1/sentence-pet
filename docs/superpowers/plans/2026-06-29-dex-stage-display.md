# Pet Dex Stage Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Pet Dex render one card per evolution *line* — card art = the latest stage the player has caught, undiscovered lines silhouette the base form, and the detail overlay shows every stage at its own art.

**Architecture:** Three pure helpers added to `src/domain/dex.ts` (stage-from-chain-position, latest-unlocked-in-chain, group-defs-into-lines). `DexGrid` switches from one-card-per-def (hardcoded `adult` art) to one-card-per-line driven by those helpers. `DexDetail` renders each chain node at its own computed stage instead of hardcoded `adult`. No state, persistence, or schema changes — `caughtDefIds` is the unlock source of truth (caught-as-proxy for "seen or caught").

**Tech Stack:** React + TypeScript + Zustand + Vitest + Testing Library. Sprites resolve through `spriteSrc(element, stage, mood, def)` in `src/config/sprites.ts`.

**Decisions (locked with the user):**
- Q1 grid granularity → **one card per evolution line**.
- Q2 "seen or caught" → **caught set proxy** (`caughtDefIds`); no new `seenDefIds`, no `PERSIST_VERSION` bump.
- Q3 detail overlay uncaught nodes → **own-stage silhouette** (shows the line's shape).
- Q4 counter → **per-creature** "Caught X / Y" (count enabled defs, not lines).

**Stage-mapping rule (refinement over the brainstorm doc):** map a node by its position in its chain *and the chain length*, so the final node always reads as the mature `adult` form and a lone creature shows `adult` (not `baby`):
- chain length ≤ 1 → `adult`
- index 0 → `baby`
- index === length − 1 → `adult`
- otherwise → `young`

This keeps the 4 single-node builtin defs rendering `adult` exactly as today, so the existing `DexGrid`/`DexDetail` tests stay green; multi-stage behavior is exercised by new tests with authored chains.

**Working directory / tooling (carry-forward hazards):**
- Use the **Bash** tool with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` for every git/test/build command — the PowerShell tool's cwd resolves to the wrong project.
- Verify gate: `npx vitest run`, `npx tsc -b` (NOT `--noEmit`), `npx vite build`. A Windows "Worker exited unexpectedly" vitest flake → just re-run.
- Stage **explicit files** in commits; never `git add -A` (concurrent-session contamination hazard).
- **Append** to `*.test.ts(x)` files; never overwrite — prior phases lost tests to clobbering.
- `caughtDefIds` must be read via `useShallow` + `useMemo(() => new Set(caughtDefIds), [caughtDefIds])` (a fresh `new Set` each render causes an infinite re-render loop).

**Branch:** create `dex-stage-display` off `main` before Task 1 (see Task 0).

---

### Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the working branch**

Run:
```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git checkout main && git pull && git checkout -b dex-stage-display
```
Expected: `Switched to a new branch 'dex-stage-display'`.

- [ ] **Step 2: Confirm a clean baseline**

Run:
```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/domain/dex.test.ts src/components/DexGrid.test.tsx src/components/DexDetail.test.tsx
```
Expected: all existing dex tests PASS (baseline green before changes).

---

### Task 1: `stageForChainPosition` helper

Maps a node's position in its chain to the sprite stage, per the stage-mapping rule above.

**Files:**
- Modify: `src/domain/dex.ts`
- Test: `src/domain/dex.test.ts` (append)

- [ ] **Step 1: Write the failing test (append to `src/domain/dex.test.ts`)**

Add this import to the existing import of `./dex` (change the existing line to include the new symbols), then append the `describe` block:

```ts
import { addCaught, evolutionChain, stageForChainPosition } from './dex';
```

```ts
describe('stageForChainPosition', () => {
  it('maps a lone creature to its mature adult form', () => {
    expect(stageForChainPosition(0, 1)).toBe('adult');
  });
  it('maps a 2-stage line to baby then adult', () => {
    expect(stageForChainPosition(0, 2)).toBe('baby');
    expect(stageForChainPosition(1, 2)).toBe('adult');
  });
  it('maps a 3-stage line to baby, young, adult', () => {
    expect(stageForChainPosition(0, 3)).toBe('baby');
    expect(stageForChainPosition(1, 3)).toBe('young');
    expect(stageForChainPosition(2, 3)).toBe('adult');
  });
  it('clamps interior stages of a long chain to young and the tip to adult', () => {
    expect(stageForChainPosition(1, 4)).toBe('young');
    expect(stageForChainPosition(2, 4)).toBe('young');
    expect(stageForChainPosition(3, 4)).toBe('adult');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/domain/dex.test.ts -t stageForChainPosition`
Expected: FAIL — `stageForChainPosition is not a function` / import error.

- [ ] **Step 3: Implement the helper (append to `src/domain/dex.ts`)**

Add the import at the top (the file currently imports only the `PetDef` type):
```ts
import type { PetDef, PetStage } from '../data/types';
```

Append:
```ts
/** Sprite stages that have per-species art (egg is generic). */
export type SpriteStage = Exclude<PetStage, 'egg'>; // 'baby' | 'young' | 'adult'

/**
 * The sprite stage for a node at `index` in a chain of `length`. The tip always
 * reads as the mature `adult` form and a lone creature is `adult`; the root is
 * `baby`; any interior node is `young`. Pure; the source of truth for dex art
 * stage (more reliable than the optional, author-supplied `evolutionStage`).
 */
export function stageForChainPosition(index: number, length: number): SpriteStage {
  if (length <= 1) return 'adult';
  if (index <= 0) return 'baby';
  if (index >= length - 1) return 'adult';
  return 'young';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/domain/dex.test.ts -t stageForChainPosition`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/domain/dex.ts src/domain/dex.test.ts && git commit -m "feat(dex): add stageForChainPosition helper"
```

---

### Task 2: `latestUnlockedInChain` helper

Given an ordered chain and the unlocked set, returns the highest-index unlocked node (or null).

**Files:**
- Modify: `src/domain/dex.ts`
- Test: `src/domain/dex.test.ts` (append)

- [ ] **Step 1: Write the failing test (append to `src/domain/dex.test.ts`)**

Extend the `./dex` import to add `latestUnlockedInChain`, then append:

```ts
describe('latestUnlockedInChain', () => {
  const a = def('a', { evolvesToId: 'b' });
  const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
  const c = def('c', { evolvesFromId: 'b' });
  const chain = [a, b, c];

  it('returns null when nothing is unlocked', () => {
    expect(latestUnlockedInChain(chain, new Set())).toBeNull();
  });
  it('returns the highest-index unlocked node', () => {
    const r = latestUnlockedInChain(chain, new Set(['a', 'b']));
    expect(r).not.toBeNull();
    expect(r!.def.id).toBe('b');
    expect(r!.index).toBe(1);
  });
  it('returns the tip when the whole chain is unlocked', () => {
    const r = latestUnlockedInChain(chain, new Set(['a', 'b', 'c']));
    expect(r!.def.id).toBe('c');
    expect(r!.index).toBe(2);
  });
  it('handles an unlock that skips earlier stages', () => {
    const r = latestUnlockedInChain(chain, new Set(['c']));
    expect(r!.def.id).toBe('c');
    expect(r!.index).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/domain/dex.test.ts -t latestUnlockedInChain`
Expected: FAIL — `latestUnlockedInChain is not a function`.

- [ ] **Step 3: Implement the helper (append to `src/domain/dex.ts`)**

```ts
/** A node's resolved position within its chain. */
export interface ChainUnlock {
  def: PetDef;
  index: number;
}

/**
 * The highest-index node in `chain` present in `unlocked`, or null if none.
 * Drives the grid card's "latest stage seen/caught" art.
 */
export function latestUnlockedInChain(
  chain: readonly PetDef[],
  unlocked: ReadonlySet<string>,
): ChainUnlock | null {
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    if (unlocked.has(chain[i].id)) return { def: chain[i], index: i };
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/domain/dex.test.ts -t latestUnlockedInChain`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/domain/dex.ts src/domain/dex.test.ts && git commit -m "feat(dex): add latestUnlockedInChain helper"
```

---

### Task 3: `dexLines` helper

Groups a flat def list into one ordered chain per evolution line (deduped by root), sorted by the root's `(gen, dexNo)`. Walks chains over the **full** catalog so a disabled mid/late stage does not truncate a line's shape (visibility gating by `enabled` happens in the component).

**Files:**
- Modify: `src/domain/dex.ts`
- Test: `src/domain/dex.test.ts` (append)

- [ ] **Step 1: Write the failing test (append to `src/domain/dex.test.ts`)**

Extend the `./dex` import to add `dexLines`, then append:

```ts
describe('dexLines', () => {
  it('collapses a 3-stage chain into a single line', () => {
    const a = def('a', { evolvesToId: 'b' });
    const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { evolvesFromId: 'b' });
    const lines = dexLines([a, b, c]);
    expect(lines.length).toBe(1);
    expect(lines[0].map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns one line per lone def', () => {
    const a = def('a', { dexNo: 1 });
    const b = def('b', { dexNo: 2 });
    expect(dexLines([a, b]).length).toBe(2);
  });

  it('dedupes a line regardless of which stage appears first in the input', () => {
    const a = def('a', { dexNo: 1, evolvesToId: 'b' });
    const b = def('b', { dexNo: 2, evolvesFromId: 'a' });
    // mid-stage listed first
    const lines = dexLines([b, a]);
    expect(lines.length).toBe(1);
    expect(lines[0].map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('sorts lines by the root gen then dexNo', () => {
    const g2 = def('g2', { gen: 2, dexNo: 1 });
    const g1b = def('g1b', { gen: 1, dexNo: 2 });
    const g1a = def('g1a', { gen: 1, dexNo: 1 });
    const lines = dexLines([g2, g1b, g1a]);
    expect(lines.map((l) => l[0].id)).toEqual(['g1a', 'g1b', 'g2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/domain/dex.test.ts -t dexLines`
Expected: FAIL — `dexLines is not a function`.

- [ ] **Step 3: Implement the helper (append to `src/domain/dex.ts`)**

```ts
/**
 * Group defs into one ordered evolution chain per line, deduped by root and
 * sorted by the root's (gen, dexNo). Chains are walked over the full `defs`
 * list, so a disabled mid/late stage does not truncate a line; callers gate
 * line *visibility* (e.g. by `root.enabled`) themselves.
 */
export function dexLines(defs: readonly PetDef[]): PetDef[][] {
  const seenRoots = new Set<string>();
  const lines: PetDef[][] = [];
  for (const d of defs) {
    const chain = evolutionChain(d, defs);
    const root = chain[0];
    if (seenRoots.has(root.id)) continue;
    seenRoots.add(root.id);
    lines.push(chain);
  }
  return lines.sort((a, b) => a[0].gen - b[0].gen || a[0].dexNo - b[0].dexNo);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/domain/dex.test.ts -t dexLines`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/domain/dex.ts src/domain/dex.test.ts && git commit -m "feat(dex): add dexLines grouping helper"
```

---

### Task 4: `DexGrid` — one card per line

Render one card per evolution line; art = latest unlocked stage; undiscovered → base-form silhouette; counter stays per-creature. A stage pill labels the shown stage on caught cards.

**Files:**
- Modify: `src/components/DexGrid.tsx`
- Test: `src/components/DexGrid.test.tsx` (append)

- [ ] **Step 1: Write the failing tests (append to `src/components/DexGrid.test.tsx`)**

Append this `describe` (the existing imports of `setActivePetDefs`, `BUILTIN_PET_DEFS`, `useGameStore`, `act`, etc. are already present at the top of the file):

```ts
describe('DexGrid per-line', () => {
  // A 3-stage authored line (clone builtin stat bands so the defs are valid).
  const bands = BUILTIN_PET_DEFS[0].statBands;
  const baby = { id: 'ln-baby', name: 'Sprig', gen: 3, dexNo: 1, types: ['leaf'], element: 'leaf' as const, statBands: bands, enabled: true, evolvesToId: 'ln-young' };
  const young = { id: 'ln-young', name: 'Sapling', gen: 3, dexNo: 2, types: ['leaf'], element: 'leaf' as const, statBands: bands, enabled: true, evolvesFromId: 'ln-baby', evolvesToId: 'ln-adult' };
  const adult = { id: 'ln-adult', name: 'Timberon', gen: 3, dexNo: 3, types: ['leaf'], element: 'leaf' as const, statBands: bands, enabled: true, evolvesFromId: 'ln-young' };

  it('collapses a 3-stage line into ONE card showing the latest caught stage', () => {
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, baby, young, adult]);
      useGameStore.setState({ caughtDefIds: ['ln-baby', 'ln-young'] });
    });
    render(<DexGrid />);
    // The card shows the young stage's name, not the baby root or the adult tip.
    expect(screen.getByText('Sapling')).toBeInTheDocument();
    expect(screen.queryByText('Sprig')).not.toBeInTheDocument();
    expect(screen.queryByText('Timberon')).not.toBeInTheDocument();
    // The shown stage is labelled.
    expect(screen.getByText('Young')).toBeInTheDocument();
  });

  it('shows the tip stage label once the line is fully caught', () => {
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, baby, young, adult]);
      useGameStore.setState({ caughtDefIds: ['ln-baby', 'ln-young', 'ln-adult'] });
    });
    render(<DexGrid />);
    expect(screen.getByText('Timberon')).toBeInTheDocument();
    expect(screen.getByText('Adult')).toBeInTheDocument();
  });

  it('shows ??? with no stage label for an undiscovered line', () => {
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, baby, young, adult]);
      useGameStore.setState({ caughtDefIds: [] });
    });
    render(<DexGrid />);
    // The authored line is undiscovered -> ??? and its card carries no stage pill.
    // (4 builtins are also undiscovered except the caught starter.)
    expect(screen.getAllByText('???').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Sapling')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/DexGrid.test.tsx -t "per-line"`
Expected: FAIL — current grid renders one card per def (three separate cards "Sprig"/"Sapling"/"Timberon") and has no "Young"/"Adult" stage label.

- [ ] **Step 3: Rewrite `DexGrid.tsx`**

Replace the entire contents of `src/components/DexGrid.tsx` with:

```tsx
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useGameStore } from '../state/gameStore';
import { usePetDefs } from '../state/usePetDefs';
import { spriteSrc } from '../config/sprites';
import { formatDexNo, STAGE_NAME } from '../config/petDisplay';
import { dexLines, latestUnlockedInChain, stageForChainPosition } from '../domain/dex';
import { PressButton } from './PressButton';
import { DexDetail } from './DexDetail';
import type { PetDef } from '../data/types';

/** The dex catalog: one card per evolution line. Card art is the latest stage the
 *  player has caught in that line; undiscovered lines show the base-form silhouette. */
export function DexGrid() {
  const caughtDefIds = useGameStore(useShallow((s) => s.caughtDefIds));
  const caught = useMemo(() => new Set(caughtDefIds), [caughtDefIds]);
  const [selected, setSelected] = useState<PetDef | null>(null);

  // Reactive catalog: re-renders when hydratePetDefs swaps the registry post-mount.
  const allDefs = usePetDefs();

  // One card per line; gate visibility by the root's enabled flag (chains are
  // walked over the full catalog so a disabled later stage doesn't truncate shape).
  const lines = useMemo(
    () => dexLines(allDefs).filter((line) => line[0].enabled),
    [allDefs],
  );
  // Collection count stays per-creature: enabled defs caught / total enabled.
  const enabledDefs = useMemo(() => allDefs.filter((d) => d.enabled), [allDefs]);
  const caughtCount = enabledDefs.filter((d) => caught.has(d.id)).length;

  return (
    <div className="relative">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-amber-900/60">
        Caught {caughtCount} / {enabledDefs.length}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {lines.map((chain) => {
          const root = chain[0];
          const latest = latestUnlockedInChain(chain, caught);
          const shown = latest ?? { def: root, index: 0 };
          const stage = stageForChainPosition(shown.index, chain.length);
          const isCaught = latest !== null;
          return (
            <PressButton
              key={root.id}
              onClick={() => setSelected(root)}
              aria-label={isCaught ? shown.def.name : `Undiscovered ${formatDexNo(root.dexNo)}`}
              className="relative flex flex-col items-center rounded-xl bg-white/70 p-2"
            >
              {isCaught && (
                <span className="absolute right-1 top-1 rounded bg-amber-200 px-1 text-[8px] font-extrabold uppercase tracking-wide text-amber-800">
                  {STAGE_NAME[stage]}
                </span>
              )}
              <img
                src={spriteSrc(shown.def.element, stage, 'happy', shown.def)}
                alt=""
                aria-hidden
                className="h-14 w-14 object-contain"
                style={isCaught ? undefined : { filter: 'brightness(0)' }}
              />
              <span className="mt-0.5 text-[10px] font-bold text-amber-900/60">{formatDexNo(root.dexNo)}</span>
              <span className="text-[11px] font-extrabold text-amber-950">{isCaught ? shown.def.name : '???'}</span>
            </PressButton>
          );
        })}
      </div>
      {selected && (
        <DexDetail def={selected} defs={allDefs} caught={caught} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
```

Note: `defs={allDefs}` (full catalog, not enabled-only) is passed to `DexDetail` so its chain walk shows every stage of the line (Task 5 relies on this).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/DexGrid.test.tsx`
Expected: PASS — the new `per-line` tests plus all four pre-existing `DexGrid` tests (builtins are single-node lines → still 4 cards, "Caught 1/4", three "???", swap → "Caught 1/5").

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/DexGrid.tsx src/components/DexGrid.test.tsx && git commit -m "feat(dex): collapse grid to one card per line with latest-stage art"
```

---

### Task 5: `DexDetail` — per-stage chain art

Render each chain node at its own stage instead of hardcoded `adult`; caught → full art, uncaught → own-stage silhouette.

**Files:**
- Modify: `src/components/DexDetail.tsx`
- Test: `src/components/DexDetail.test.tsx` (append)

- [ ] **Step 1: Write the failing test (append to `src/components/DexDetail.test.tsx`)**

Append:

```ts
describe('DexDetail per-stage art', () => {
  it('renders every stage of the chain with correct caught/uncaught alt text', () => {
    const a = def('a', { name: 'Alpha', dexNo: 1, evolvesToId: 'b' });
    const b = def('b', { name: 'Beta', dexNo: 2, evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { name: 'Gamma', dexNo: 3, evolvesFromId: 'b' });
    render(<DexDetail def={a} defs={[a, b, c]} caught={new Set(['a', 'b'])} onClose={() => {}} />);
    // Caught nodes use the def name as alt; the uncaught tip uses 'Undiscovered'.
    expect(screen.getByAltText('Alpha')).toBeInTheDocument();
    expect(screen.getByAltText('Beta')).toBeInTheDocument();
    expect(screen.getByAltText('Undiscovered')).toBeInTheDocument();
    // All three stage sprites render.
    expect(screen.getAllByRole('img').length).toBe(3);
  });

  it('shows different sprite art per stage (not three identical adult sprites)', () => {
    const a = def('a', { name: 'Alpha', dexNo: 1, evolvesToId: 'b' });
    const b = def('b', { name: 'Beta', dexNo: 2, evolvesFromId: 'a' });
    render(<DexDetail def={a} defs={[a, b]} caught={new Set(['a', 'b'])} onClose={() => {}} />);
    const imgs = screen.getAllByRole('img') as HTMLImageElement[];
    expect(imgs.length).toBe(2);
    // baby (root) vs adult (tip) resolve to distinct sprite sources.
    expect(imgs[0].src).not.toBe(imgs[1].src);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/DexDetail.test.tsx -t "per-stage art"`
Expected: FAIL — the second test fails because both nodes currently render the hardcoded `adult` sprite (identical `src`).

- [ ] **Step 3: Update `DexDetail.tsx`**

Change the `ChainNode` signature and its `img` to take a `stage`, and pass the computed stage from the chain map. Apply these two edits.

Edit A — replace the `ChainNode` function (lines 9-23) with:
```tsx
/** One chain node at its own stage: full art + name if caught, silhouette + ??? if not. */
function ChainNode({ def, caught, stage }: { def: PetDef; caught: boolean; stage: SpriteStage }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={spriteSrc(def.element, stage, 'happy', def)}
        alt={caught ? def.name : 'Undiscovered'}
        className="h-16 w-16 object-contain"
        style={caught ? undefined : { filter: 'brightness(0)' }}
      />
      <span className="text-[10px] font-bold text-amber-900/60">{formatDexNo(def.dexNo)}</span>
      <span className="text-xs font-extrabold text-amber-950">{caught ? def.name : '???'}</span>
    </div>
  );
}
```

Edit B — update the import of `../domain/dex` (currently `import { evolutionChain } from '../domain/dex';`) to:
```tsx
import { evolutionChain, stageForChainPosition, type SpriteStage } from '../domain/dex';
```

Edit C — in the chain map (lines 61-66), pass the stage. Replace:
```tsx
          {chain.map((d, i) => (
            <div key={d.id} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true" className="text-amber-900/40">→</span>}
              <ChainNode def={d} caught={caught.has(d.id)} />
            </div>
          ))}
```
with:
```tsx
          {chain.map((d, i) => (
            <div key={d.id} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true" className="text-amber-900/40">→</span>}
              <ChainNode def={d} caught={caught.has(d.id)} stage={stageForChainPosition(i, chain.length)} />
            </div>
          ))}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/DexDetail.test.tsx`
Expected: PASS — new `per-stage art` tests plus the three pre-existing `DexDetail` tests.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/DexDetail.tsx src/components/DexDetail.test.tsx && git commit -m "feat(dex): render each chain node at its own stage art"
```

---

### Task 6: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run`
Expected: all suites PASS. (On a Windows "Worker exited unexpectedly" flake, re-run the same command.)

- [ ] **Step 2: Typecheck**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b`
Expected: no errors (exit 0).

- [ ] **Step 3: Production build**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vite build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke note (no commit)**

Builtin defs have no chains, so a multi-stage line must be authored in live Firestore to see collapsing in the running app: `npm run emulators`, open the admin PetsTab, author a 2–3 stage leaf line, catch the baby + young in play, then open Collection → Dex. Verify: one card for the line shows the *young* sprite with a "Young" pill; tapping it shows baby (full) → young (full) → adult (silhouette). Record the result in the PR description.

---

## Notes for the reviewer

- **No `PERSIST_VERSION` bump** — Q2 chose caught-as-proxy; `caughtDefIds` is unchanged.
- **Backward compatibility** — the stage-mapping rule returns `adult` for single-node lines, so the 4 builtin defs render exactly as before; that is why the pre-existing `DexGrid`/`DexDetail` tests survive untouched.
- **Stage-1-silhouette (req 3)** is verified at the pure-helper level (`stageForChainPosition(0, length>1) === 'baby'`); the components only wire it. The grid silhouette uses `chain[0]` at its computed stage; the detail silhouettes each uncaught node at its own stage (Q3).
- **Future "seen" set (Q2 option B)** — if added later, the display layer should read a unified `unlocked = seen ∪ caught` set; only the `Set` construction in `DexGrid`/`DexDetail` would change, not the helpers.

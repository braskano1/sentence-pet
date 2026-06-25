# Level-select — Design Spec

**Date:** 2026-06-25
**Slice:** Phase 2 — Level-select UI
**Status:** Approved (brainstorming), ready for plan.

## Problem

`App.tsx` hardcodes `level={1}` for every drill, so only each drill's L1 is reachable in-app. Already-authored content is unplayable: **Pattern L2** (S+V+O ×5) and **Grammar L2** (enforce ×5). One small UI/state slice unlocks playtesting of all higher rungs — present and future.

## Decisions (locked in brainstorming)

1. **Progression: free-pick.** Player picks any authored level for a drill, anytime. No saved progress, no gated unlock. (Gated unlock — clear L_n at a star threshold to unlock L_{n+1}, per GAME_DESIGN §5/§6 — is explicitly deferred; it would need persisted per-drill progress.)
2. **UI placement: level chips on the drill card.** Each `DrillPicker` card shows a row of level chips derived from authored content. Tap a chip to start that drill at that level. No new screen/route.
3. **No persist version bump.** `selectedLevel` is a new transient-style field. Existing saves (zustand persist `sentence-pet`, version 2) lack it; the default shallow-merge restores the initial-state default (`1`). Version stays **2**; `migrate` is untouched.

## Authored content (current)

| Drill       | Levels authored |
|-------------|-----------------|
| pattern     | L1, L2          |
| grammar     | L1, L2          |
| wordChoice  | L1              |
| mixed       | L1              |

The UI must derive available levels from data — never offer a level with zero items (would produce an empty round).

## Components

### 1. `levelsFor(drill)` — `src/data/wordBank.ts`

New pure helper, sibling to `itemsFor`.

```ts
export function levelsFor(drill: DrillType): number[] {
  return [...new Set(WORD_BANK.filter((i) => i.drill === drill).map((i) => i.level))]
    .sort((a, b) => a - b);
}
```

- Returns sorted, unique, ascending levels.
- Drill with no items → `[]`.
- Single source of truth: add authored items, levels appear automatically.

### 2. Store — `src/state/gameStore.ts`

- Add field `selectedLevel: number`, initial `1`. Add to `GameState` interface, initial state, and `resetForTest` (resets to `1`).
- Change action signature: `startDrill: (drill: DrillType, level: number) => void`.
  ```ts
  startDrill: (drill, level) => set({ selectedDrill: drill, selectedLevel: level, screen: 'drill' }),
  ```
- **No persist change.** version stays `2`. `migrate` untouched. On load of a pre-`selectedLevel` save, zustand's default merge keeps the initial-state `selectedLevel: 1`.

### 3. `DrillPicker.tsx`

- The card stops being one big `<button>`; it becomes a container `<div>` holding: emoji + title + "Earns {label}" (unchanged), then a **chip row**.
- Chip row maps `levelsFor(drill)` → one `<button>` per level, label `L{n}`, `onClick={() => startDrill(drill, level)}`.
- Tap target ≥ 44px (`min-h-11` or larger) for mobile. Chips visually distinct, horizontally laid out, wrap if needed.
- Single-level drills render one chip (`L1`) — same start path, no special case.

### 4. `App.tsx`

- Read `selectedLevel` from store: `const level = useGameStore((s) => s.selectedLevel)`.
- Thread it: `case 'drill': return { ..., node: <DrillScreen drill={drill} level={level} /> }`.
- Remove the hardcoded `level={1}`.

## Data flow

```
DrillPicker chip tap
  → startDrill(drill, level)
  → store { selectedDrill, selectedLevel, screen:'drill' }
  → App reads selectedDrill + selectedLevel
  → <DrillScreen drill level />
  → itemsFor(drill, level) builds the round
```

## Testing

Convention (carry forward): real logic in pure modules, unit-tested exhaustively; component tests render-only (jsdom can't drive @dnd-kit drag or framer-motion). Mock `canvas-confetti` in any test transitively importing `celebrate.ts`.

- **`levelsFor` unit** (`wordBank.test.ts` or sibling): pattern→`[1,2]`, grammar→`[1,2]`, wordChoice→`[1]`, mixed→`[1]`; sorted ascending; unique; unknown drill → `[]`.
- **Store unit**: `startDrill('grammar', 2)` sets `selectedLevel:2` + `selectedDrill:'grammar'` + `screen:'drill'`. `resetForTest` restores `selectedLevel:1`.
- **DrillPicker render-only**: mounts without throwing; shows expected chip labels (static text). Pattern card shows `L1` and `L2`; mixed card shows only `L1`.
- **Existing 116 tests stay green.** `DrillScreen.test.tsx` already passes explicit `level={1}` — unaffected. Audit all `startDrill(` call sites and update to the 2-arg signature.

## Error / edge handling

- Empty level never offered (chips come from `levelsFor`, which only yields authored levels).
- Old persisted save lacking `selectedLevel` → default `1` via shallow-merge; first round is L1 until the player taps a chip.
- New drills/levels need no UI change — chips derive from data.

## Out of scope (YAGNI)

Gated unlock / mastery thresholds; persisted per-drill progress; persist version bump; L3–L5 authoring; Free Play; Collection; world map. Each is its own later slice.

## Touch points summary

- `src/data/wordBank.ts` — add `levelsFor`.
- `src/state/gameStore.ts` — `selectedLevel` field + `startDrill` signature.
- `src/components/DrillPicker.tsx` — chip row.
- `src/App.tsx` — thread `selectedLevel`, drop `level={1}`.
- Tests for the above.
- `GAME_DESIGN.md` (both copies) — add "Level-select (shipped)" note in §12 when landed.

## Verify

`npm test -- --run` green, `npx tsc -b` clean (NOT `tsc --noEmit` — no-op here), `npm run build` clean. Manual phone-e2e: tap each drill's L2 chip where it exists → correct round loads.

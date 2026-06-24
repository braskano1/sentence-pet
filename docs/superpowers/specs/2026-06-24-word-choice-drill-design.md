# Word-Choice Drill — Design Spec

**Date:** 2026-06-24
**Phase:** 2, Slice D (drill #2)
**Status:** approved, ready for plan

## Goal

Ship the second of four drills — **Word-Choice** (yields 🥦 veggie food). Activates the
dormant balanced-diet hook: `Health = min(4 bars)` (`domain/pet.ts:health`) only becomes
meaningful once a second drill feeds a second bar. Until now only Pattern → protein exists,
so Health tracked protein alone.

Builds on the drag-and-drop + per-sentence-feedback + motion foundation already merged to
`main` — Word-Choice inherits all of it.

## 1. Mechanic — salted tray, full sentence

Same build-the-sentence flow as the Pattern drill, with one change: the word tray is
**salted with distractor tiles**. Tray = `shuffle(answer + distractors)`.

- Kid drags tiles into POS slots exactly as in Pattern.
- A wrong (distractor) tile placed into a slot fails the existing exact-match check
  (`domain/check.ts:isPlacementCorrect`) once all slots are filled → red shake → retry.
- Distractors left unused in the tray are fine — evaluation fires when every **slot** is
  filled (`placed.every(p => p !== null)`), not when the tray is empty.

**Engine reuse:** `placement.ts`, `round.ts`, `check.ts`, `useRoundFeedback.ts`,
`SentenceSlots`, `WordTray`, `DragOverlay` are all reused unchanged. The only structural
change in `DrillScreen` is that the `tiles` and `used` arrays become length **M**
(answer + distractors) instead of length **N** (answer): `used` initializes from `tiles`,
not from `answer`.

**Distractor count:** 2 per Word-Choice item for the shipped levels. Distractors are
authored per item in the word bank — plausible pre-A1 wrong words (wrong verb conjugation,
wrong pronoun), e.g. answer `['I','run']` + distractors `['runs','am']`.

## 2. Data model

### `src/data/types.ts`
- `export type DrillType = 'pattern' | 'wordChoice';` (extensible to `grammar` | `mixed` later)
- `export type FoodGroup = keyof NutritionBars;` (`protein` | `veggie` | `vitamin` | `treat`)
- `Screen` gains `'pickDrill'`.
- `DrillItem` gains:
  - `drill: DrillType`
  - `distractors?: string[]` (omitted/empty for Pattern)

### `src/data/food.ts` (new — pure data)
- `DRILL_FOOD: Record<DrillType, FoodGroup>` → `{ pattern: 'protein', wordChoice: 'veggie' }`
  (grammar→vitamin, mixed→treat reserved for later but only the two shipped keys required).
- `FOOD_META: Record<FoodGroup, { emoji: string; label: string; color: string }>` —
  protein 🥩 orange, veggie 🥦 green, vitamin 💊, treat 🍰. Single source for emoji/label/
  bar color reused by `StatBars`, `PetRoom`, `DrillPicker`, `RewardScreen`.

### `src/data/wordBank.ts`
- Existing items tagged `drill: 'pattern'`.
- Add **5 Word-Choice L1 items** mirroring the 5 Pattern L1 sentences, each `drill: 'wordChoice'`
  with `distractors` of length 2.
- `itemsFor(drill: DrillType, level: number): DrillItem[]` replaces `itemsForLevel` (filter by
  both `drill` and `level`).
- `trayWords(item: DrillItem): string[]` — pure, returns `answer.concat(distractors ?? [])`.
  Component shuffles the result (shuffle stays non-pure in the component, matching the
  existing Pattern pattern).

Word-Choice ships the **L1 round only** (5 sentences), parity with how Pattern launches today
(`level={1}`). L2+ deferred.

## 3. Store — `src/state/gameStore.ts`

- `inventory: Record<FoodGroup, number>` initialized all `0` (replaces `{ protein: number }`).
- `selectedDrill: DrillType` (default `'pattern'`).
- `startDrill(drill: DrillType)` → sets `selectedDrill` and `screen: 'drill'`.
- `finishRound` signature gains `drill`: routes food by
  `const group = DRILL_FOOD[drill]; inventory[group] += correctCount`.
  `lastReward` gains `group: FoodGroup` so the reward screen shows the right food emoji.
- `feedAll` → `feed(group: FoodGroup)`: `bars = feedBar(bars, group, inventory[group])`,
  then zero `inventory[group]`. `feedBar` (`domain/pet.ts`) is already group-generic.
- `resetForTest` resets inventory to all-zero and `selectedDrill` to `'pattern'`.

`decayBars` / `health` already operate over all 4 bars — no change.

## 4. Screens

### New `src/components/DrillPicker.tsx` (`screen: 'pickDrill'`)
- Three-zone mobile layout (per §9a). Two large cards: **Pattern 🥩** and **Word-Choice 🥦**,
  each ≥48px tap target, tap → `startDrill('pattern' | 'wordChoice')`.
- Back control → `setScreen('petRoom')`.
- Cards driven by `FOOD_META` for emoji/color so future drills slot in by data.

### `src/components/PetRoom.tsx`
- "Play ▶" → `setScreen('pickDrill')` (was `'drill'`).
- Feed area: render **one button per food group with `inventory[group] > 0`**
  (`Feed {emoji} ({n})`), each fires `feed(group)` + `feedTrigger` bounce. When inventory is
  all-empty, show no feed buttons (or a faint "play to earn food" hint). Play button always present.

### `src/components/StatBars.tsx`
- Render all **4 nutrition bars** (protein/veggie/vitamin/treat) via `FOOD_META`, plus
  Health (`health(bars)`) and Happiness. Existing `barColor` warn-coloring applies per bar.

### `src/App.tsx`
- `screenKeyAndNode`: add `case 'pickDrill': return { key: 'pickDrill', node: <DrillPicker/> }`.
- `case 'drill'`: `<DrillScreen drill={selectedDrill} level={1} />` (read `selectedDrill`
  from store in `CurrentScreen`).

### `src/components/DrillScreen.tsx`
- Add `drill: DrillType` prop.
- Tiles/used built from `trayWords(item)` (length M); `used` initializes from tiles.
- `finishRound({ level, stars, correctCount })` → `finishRound({ drill, level, stars, correctCount })`.
- `loadItem` rebuilds tiles via `shuffle(trayWords(items[i]))` and `used` to match length.

### `src/components/RewardScreen.tsx`
- Show `lastReward.group` food emoji (via `FOOD_META`) instead of a hardcoded food icon.

## 5. Testing

Convention (carried from prior slices): real logic in **pure modules**, tested exhaustively;
component tests are **render-only** (mount-without-throwing + static text); never assert
animated style values; mock `canvas-confetti` anywhere `celebrate.ts` is transitively imported.

Pure:
- `food.test.ts` — `DRILL_FOOD` maps pattern→protein, wordChoice→veggie; `FOOD_META` has all 4 groups.
- `wordBank.test.ts` — `itemsFor('wordChoice', 1)` returns 5 items, each with 2 distractors;
  `itemsFor('pattern', 1)` unaffected; `trayWords` includes distractors and equals answer when none.
- `gameStore.test.ts` — `finishRound({drill:'wordChoice',...})` increments `veggie`, not `protein`;
  `finishRound({drill:'pattern',...})` increments `protein`; `feed('veggie')` raises veggie bar +
  zeros veggie inventory, leaves protein untouched; `startDrill` sets `selectedDrill` + screen.
- `round.test.ts` — a `filled` array containing a distractor word → `{ type: 'retry' }`.

Render-only:
- `DrillScreen.test.tsx` — mounts with `drill='wordChoice'`, shows Thai hint + tray.
- `DrillPicker.test.tsx` — mounts, both drill cards present.
- `StatBars.test.tsx` — mounts, shows all 4 bar labels.
- `PetRoom.test.tsx` — mounts; with veggie inventory > 0, a veggie feed button renders.

## 6. Out of scope

- Word-Choice L2–L5 (only L1 round ships).
- Grammar / Mixed drills (the `DrillType` union + `DRILL_FOOD` are pre-shaped for them, but no
  data/UI built).
- Shop / spending coins.
- Distractor difficulty dial ramping (§4 dial 0→several across levels) — fixed at 2 for L1.
- AI-generated word banks / Thai hints (Firebase phase).

## 7. Touch-points summary

| File | Change |
|---|---|
| `data/types.ts` | `DrillType`, `FoodGroup`, `Screen+='pickDrill'`, `DrillItem` fields |
| `data/food.ts` | NEW — `DRILL_FOOD`, `FOOD_META` |
| `data/wordBank.ts` | tag pattern items, +5 word-choice items, `itemsFor`, `trayWords` |
| `state/gameStore.ts` | inventory record, `selectedDrill`, `startDrill`, `finishRound(drill)`, `feed(group)` |
| `components/DrillScreen.tsx` | `drill` prop, tray from `trayWords`, route finishRound |
| `components/DrillPicker.tsx` | NEW — picker screen |
| `components/PetRoom.tsx` | Play→pickDrill, per-group feed buttons |
| `components/StatBars.tsx` | all 4 bars via FOOD_META |
| `components/RewardScreen.tsx` | show earned food group emoji |
| `App.tsx` | pickDrill case, pass `drill` to DrillScreen |

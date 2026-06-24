# Grammar Drill — Design Spec

**Date:** 2026-06-25
**Drill:** #3 of 4 (💊 vitamin food). Plugs into the generic 4-drill/4-food plumbing shipped with Word-Choice (Slice D).
**Status:** approved (brainstorming). Next: implementation plan.

## 1. Goal

Add the **Grammar drill** to Sentence Pet. It reuses the Word-Choice drag-tile substrate (salted tray, pick the right tile) but introduces the game's third difficulty dial — **grammar strictness** (`GAME_DESIGN.md` §4 dial 3) — which is the genuinely new mechanic:

- **Early levels (flag mode):** a grammatically near-miss answer is **accepted** — the round passes and food drops — but a gentle Thai tip is shown and it costs a star.
- **Later levels (enforce mode):** the same near-miss is **rejected** — the kid must retry, exactly like any wrong tile.

The drill yields **💊 vitamin** food, feeding the vitamin nutrition bar that is currently always-empty (so `Health = min(4 bars)` stays pinned low until Grammar exists).

## 2. Scope

**In scope (this slice):**
- Error family: **subject–verb agreement only** (e.g. `he eats`, not `he eat`), on the existing **S+V** sentence frames.
- Two levels: **L1 = flag mode**, **L2 = enforce mode** — same frames, only the strictness dial ramps. This exercises *both* ends of the dial end-to-end so neither half ships as dead code.
- 5 items per level (round shape = 5 sentences, per §10/§12).

**Out of scope (deferred):**
- Article and plural error families (`a book` vs `book`, `cat` vs `cats`) — need S+V+O object frames with countability. Later slice.
- Grammar L3–L5; the full 4×5 level matrix.
- Mixed mode (drill #4, 🍰 treat) — built after all three skill drills exist.

## 3. Architecture — Approach A (general grader)

A single pure grader, `gradePlacement`, becomes the correctness engine at the live call site (`resolveRound`) for **all three** drills. `isPlacementCorrect` stays exactly as it is — its exact-sequence match is the trap-less special case of the grader — so existing Pattern / Word-Choice paths and tests are untouched; a test proves the two agree on trap-less items. This keeps the grader a pure function of `(placed, item)` with no partial-shape coupling.

### Module map

| File | Change |
|---|---|
| `src/domain/grade.ts` | **NEW.** Pure `gradePlacement(placed, item) → Grade`. The only new engine; the unified call site (`resolveRound`) routes every drill through it. |
| `src/domain/check.ts` | **No change.** `isPlacementCorrect` retained as-is (exact-sequence match); equivalence to `gradePlacement` on trap-less items proven by test. `shuffle` unchanged. |
| `src/domain/round.ts` | `resolveRound` switches to `gradePlacement`; gains a flagged-accept branch (advance/finish while docking a star and carrying tips). |
| `src/data/types.ts` | `DrillType` += `'grammar'`. `DrillItem` += `traps?: GrammarTrap[]`, `strictness?: 'flag' \| 'enforce'`. New `GrammarTrap` interface. |
| `src/data/wordBank.ts` | Grammar L1 (flag) + L2 (enforce) items. `trayWords` includes trap words. |
| `src/data/food.ts` | `DRILL_FOOD.grammar = 'vitamin'` (one line). `FOOD_META.vitamin` already exists. |
| `src/components/DrillScreen.tsx` | Wire the flagged-accept result into feedback + star dock. |
| `src/components/useRoundFeedback.ts` | New `'flag'` feedback state (soft tip toast, distinct from the `'wrong'` shake). |
| `src/state/gameStore.ts` | **No change.** See §7. |

### Why A (vs alternatives)

- **B — grammar-only validator, branch in DrillScreen:** smaller blast radius but two parallel correctness paths to keep in sync — the divergence the generic plumbing work removed. Rejected.
- **C — engine reads level numbers for strictness:** couples the pure grader to level semantics, harder to unit-test. Rejected. Strictness travels as data on the item instead.

## 4. Grader contract

```ts
export type GradeStatus = 'ideal' | 'flagged' | 'wrong';
export interface Grade {
  status: GradeStatus;
  passes: boolean;   // may the round advance/finish on this placement?
  flags: string[];   // tip strings for any flagged near-miss tiles (display order = slot order)
}

export function gradePlacement(placed: (string | null)[], item: DrillItem): Grade;
```

Per-slot evaluation (`i` from `0`):
1. `placed[i] === item.answer[i]` → slot ok.
2. else a trap exists with `slot === i && word === placed[i]` → slot **flagged**, collect its `tip`.
3. else → slot **wrong**.

Aggregate:

| any slot wrong | any slot flagged | `item.strictness` | `status` | `passes` |
|:---:|:---:|:---:|:---:|:---:|
| yes | — | — | `wrong` | `false` |
| no | yes | `'flag'` | `flagged` | **`true`** |
| no | yes | `'enforce'` | `flagged` | **`false`** |
| no | no | — | `ideal` | `true` |

- A `null` (unfilled) slot counts as **wrong** (placement isn't complete). `resolveRound` only calls the grader once all slots are filled, but the grader must handle `null` defensively for unit testing.
- Pattern / Word-Choice items carry no `traps` and no `strictness` → only `ideal` or `wrong` is ever produced → byte-for-byte the current exact-match behaviour.

## 5. Data — agreement on S+V frames

```ts
export interface GrammarTrap {
  slot: number;   // index into slots[]/answer[] the trap word belongs to
  word: string;   // the tempting near-miss tile (must differ from every answer word)
  tip: string;    // gentle Thai-scaffolded nudge shown on a flagged accept
}
```

L1 (flag) and L2 (enforce) share the S+V agreement frames; only `strictness` differs. Example items:

```ts
// Grammar · L1 · flag mode
{ id: 'gr-l1-1', drill: 'grammar', level: 1, strictness: 'flag',
  thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }] },
// Grammar · L2 · enforce mode (same frame family, dial ramped)
{ id: 'gr-l2-1', drill: 'grammar', level: 2, strictness: 'enforce',
  thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }] },
```

- 5 items per level, drawn from the third-person-singular pronouns where agreement bites (`he`, `she`, plus contrast subjects like `they`/`we`/`I` whose verb is the bare form — the trap is always the *wrong* form for that subject).
- **Authoring invariant (test-enforced):** no tile value — answer word, distractor, or trap word — may duplicate another tile in the same item. Agreement traps satisfy this (`eat` ≠ `eats`). `wordBank.test.ts` extends its existing guard to include `traps[].word`.
- `trayWords(item)` returns `[...answer, ...(distractors ?? []), ...(traps ?? []).map(t => t.word)]`. The component shuffles.

## 6. Round resolution + UI

### `resolveRound`

```ts
const grade = gradePlacement(filled, item);
if (!grade.passes) return { type: 'retry' };            // wrong, or enforce-mode near-miss
const flagged = grade.status === 'flagged';             // flag-mode accept
// flagged accept counts as ONE slip toward stars (same weight as a mistake)
const slips = mistakes + (flagged ? 1 : 0);
if (index === total - 1) return { type: 'finish', stars: computeStars({ hints: 0, mistakes: slips }), flags: grade.flags };
return { type: 'advance', nextIndex: index + 1, flags: grade.flags };
```

- `RoundAction` `advance` and `finish` variants gain an optional `flags: string[]`.
- The `retry` path is unchanged (still bumps `mistakes` in `applyAction`).
- A flagged accept on a **non-final** sentence must also bump the persistent `mistakes` state in `applyAction` so a later sentence's star math stays correct.

### Feedback

`useRoundFeedback` gains a `'flag'` state alongside `'correct'`/`'wrong'`:
- Visual: a **soft accept** — the ✓ check still plays (the round passed), plus a brief tip toast rendering `flags` (the Thai nudge). No red ✗, no shake.
- `DrillScreen.evaluate` chooses `play('flag', …)` when `action.flags?.length`, else `play('correct'|'wrong', …)` as today.
- Per the animation convention, component tests assert the tip *text* renders, never animated style values.

## 7. Persistence

**No store change, no persist version bump.**
- `inventory.vitamin` already exists in `NutritionBars`; the version-2 `migrate` already backfills any missing food group.
- `selectedDrill` stores a `DrillType` string; widening the union to include `'grammar'` does not change the persisted shape, and the migrate already defaults `selectedDrill`.
- `finishRound` routes food via `DRILL_FOOD[drill]`, which now resolves `'grammar' → 'vitamin'` with no code change.

## 8. What ships free (data-driven, no new logic)

Keyed off `food.ts` / `FOOD_GROUPS` already:
- DrillPicker grammar card (`screen: 'pickDrill'`).
- Vitamin bar in `StatBars` (all 4 bars already rendered).
- Per-group vitamin feed button in `PetRoom` (colour from `FOOD_META.vitamin`).
- Food routing in `finishRound`; reward emoji in `RewardScreen`.

## 9. Testing

Pure logic exhaustively unit-tested; components render-only (jsdom can't drive @dnd-kit / framer-motion).

- **`grade.test.ts` (new):** full truth table — `ideal`; `flagged` under `flag` (passes) and under `enforce` (fails); `wrong`; multi-trap item; unfilled (`null`) slot → wrong; Pattern/WC item (no traps) → only ideal/wrong.
- **`check.test.ts`:** unchanged. A new equivalence test asserts `isPlacementCorrect(placed, item.answer)` agrees with `gradePlacement(placed, item).status === 'ideal'` for trap-less items.
- **`round.test.ts`:** flagged accept advances and docks one star; flagged accept on the final sentence finishes with the docked star count; enforce-mode near-miss returns `retry`; wrong returns `retry`.
- **`wordBank.test.ts`:** trap-word ≠ any answer word (extended invariant); `trayWords` includes trap words; grammar items exist for L1 (`flag`) and L2 (`enforce`).
- **Component (render-only):** `DrillScreen` mounts for `drill='grammar'` without throwing; flag-mode tip text renders on a flagged accept.

Green bar before merge: `npm test -- --run`, `npm run build`, `npx tsc --noEmit` all clean (mock `canvas-confetti` in any test transitively importing `effects/celebrate.ts`).

## 10. Docs to sync

`GAME_DESIGN.md` lives in both the repo root and `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md`. The strictness dial (§4/§12) is now concretely realised as flag/enforce; add a short note there when the slice merges, and sync both copies.

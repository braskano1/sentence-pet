# Mixed Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mixed mode (drill #4, the "boss") as a pure-data slice that combines all three difficulty dials (S+V+O pattern + a distractor + a subject–verb agreement trap, graded enforce) and yields 🍰 treat food, making the last nutrition bar live.

**Architecture:** No new domain module. The existing grader (`gradePlacement`), tray builder (`trayWords`), round resolver, and all UI are already generic over `DrillType` / `FOOD_GROUPS`. Mixed is delivered by widening the `DrillType` union, adding the `mixed → treat` food mapping, authoring 5 data items, and adding one drill-picker entry.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist) + Vitest. Typecheck with `npx tsc -b` (NOT `tsc --noEmit` — root tsconfig has `files: []`, so `--noEmit` is a no-op).

**Pre-flight:** Work on branch `mixed-mode` (already created off `main`, spec committed at `1d9e0dc`). Build dir: `D:\ai_projects\AI_design_thinking\sentence-pet`. Run all commands from there. Verify `git branch --show-current` is `mixed-mode` before each commit (detached-HEAD trap after any `git checkout`/`git show`).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/data/types.ts` | `DrillType` union | add `'mixed'` |
| `src/data/food.ts` | drill→food mapping | add `mixed: 'treat'` (compiler-forced) |
| `src/data/food.test.ts` | food mapping tests | assert `DRILL_FOOD.mixed === 'treat'` |
| `src/data/wordBank.ts` | item content | append 5 Mixed L1 items |
| `src/data/wordBank.test.ts` | content invariants | add Mixed count/shape assertions |
| `src/domain/grade.test.ts` | grader coverage | add a Mixed-item regression test |
| `src/components/DrillPicker.tsx` | drill menu | add `{ drill: 'mixed', title: 'Mixed' }` |
| `src/components/DrillPicker.test.tsx` | render test | assert the Mixed card renders |

No persist version bump (widening `DrillType` does not change persisted shape). No change to `grade.ts` / `round.ts` / `check.ts`.

---

## Task 1: Widen DrillType and map mixed → treat

Adding `'mixed'` to `DrillType` makes `DRILL_FOOD: Record<DrillType, FoodGroup>` a compile error until the `mixed` entry exists, so both edits land together.

**Files:**
- Modify: `src/data/types.ts:3`
- Modify: `src/data/food.ts:4-8`
- Test: `src/data/food.test.ts:5-9`

- [ ] **Step 1: Write the failing test**

In `src/data/food.test.ts`, add one assertion inside the existing `'maps each drill to its food group'` test (after the `grammar` line):

```ts
    expect(DRILL_FOOD.mixed).toBe('treat');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/data/food.test.ts`
Expected: FAIL — TS error `Property 'mixed' does not exist on type` (the union does not yet include `'mixed'`).

- [ ] **Step 3: Widen the union**

In `src/data/types.ts` line 3, change:

```ts
export type DrillType = 'pattern' | 'wordChoice' | 'grammar';
```
to:
```ts
export type DrillType = 'pattern' | 'wordChoice' | 'grammar' | 'mixed';
```

- [ ] **Step 4: Add the food mapping**

In `src/data/food.ts`, change the `DRILL_FOOD` object:

```ts
export const DRILL_FOOD: Record<DrillType, FoodGroup> = {
  pattern: 'protein',
  wordChoice: 'veggie',
  grammar: 'vitamin',
  mixed: 'treat',
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --run src/data/food.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: clean (no output, exit 0). Confirms no other `DrillType`-keyed site broke.

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts src/data/food.ts src/data/food.test.ts
git commit -m "feat: add 'mixed' DrillType mapped to treat food"
```

---

## Task 2: Author the 5 Mixed L1 items

S+V+O, `strictness:'enforce'`, 1 agreement trap (verb slot) + 1 distractor each, all tile values distinct within an item. The existing `wordBank.test.ts` invariants (answer-length == slots-length, no duplicate distractor/trap tiles, trap slot in range) run over the whole `WORD_BANK`, so they cover these items automatically — only a count/shape assertion is added here.

**Files:**
- Modify: `src/data/wordBank.ts:37-38` (append before the closing `];`)
- Test: `src/data/wordBank.test.ts` (new test block)

- [ ] **Step 1: Write the failing test**

In `src/data/wordBank.test.ts`, add this test inside the `describe('WORD_BANK', ...)` block (e.g. after the grammar tests):

```ts
  it('has 5 mixed items at level 1, each enforce with 1 trap + 1 distractor', () => {
    const mx = itemsFor('mixed', 1);
    expect(mx.length).toBe(5);
    for (const item of mx) {
      expect(item.strictness).toBe('enforce');
      expect(item.traps?.length).toBe(1);
      expect(item.distractors?.length).toBe(1);
      expect(item.slots.length).toBe(3);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/data/wordBank.test.ts`
Expected: FAIL — `expected 0 to be 5` (`itemsFor('mixed', 1)` is empty).

- [ ] **Step 3: Add the items**

In `src/data/wordBank.ts`, insert these 5 items immediately before the closing `];` of `WORD_BANK` (after the `gr-l2-5` line):

```ts
  // Mixed · Level 1 (the "boss"): S+V+O, ENFORCE, all three dials on
  // (1 agreement trap on the verb slot + 1 distractor). Enforce ⇒ near-miss & distractor reject to retry.
  { id: 'mx-l1-1', drill: 'mixed', level: 1, strictness: 'enforce', thaiHint: 'ฉันกินข้าว', slots: ['Pronoun', 'Verb', 'Object'], answer: ['I', 'eat', 'rice'], distractors: ['bread'], traps: [{ slot: 1, word: 'eats', tip: 'ฉัน → I eat 👍' }] },
  { id: 'mx-l1-2', drill: 'mixed', level: 1, strictness: 'enforce', thaiHint: 'เขาดื่มน้ำ', slots: ['Pronoun', 'Verb', 'Object'], answer: ['he', 'drinks', 'water'], distractors: ['juice'], traps: [{ slot: 1, word: 'drink', tip: 'เขา → he drinks 👍' }] },
  { id: 'mx-l1-3', drill: 'mixed', level: 1, strictness: 'enforce', thaiHint: 'เธออ่านหนังสือ', slots: ['Pronoun', 'Verb', 'Object'], answer: ['she', 'reads', 'a book'], distractors: ['a pen'], traps: [{ slot: 1, word: 'read', tip: 'เธอ → she reads 👍' }] },
  { id: 'mx-l1-4', drill: 'mixed', level: 1, strictness: 'enforce', thaiHint: 'พวกเราเล่นฟุตบอล', slots: ['Pronoun', 'Verb', 'Object'], answer: ['we', 'play', 'football'], distractors: ['tennis'], traps: [{ slot: 1, word: 'plays', tip: 'เรา → we play 👍' }] },
  { id: 'mx-l1-5', drill: 'mixed', level: 1, strictness: 'enforce', thaiHint: 'พวกเขาดูทีวี', slots: ['Pronoun', 'Verb', 'Object'], answer: ['they', 'watch', 'TV'], distractors: ['a movie'], traps: [{ slot: 1, word: 'watches', tip: 'เขา → they watch 👍' }] },
```

- [ ] **Step 4: Run the full wordBank suite to verify it passes**

Run: `npm test -- --run src/data/wordBank.test.ts`
Expected: PASS — including the generic distinctness/slot-range invariants now covering the 5 new items.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/data/wordBank.ts src/data/wordBank.test.ts
git commit -m "feat: author 5 Mixed L1 items (S+V+O, enforce, trap + distractor)"
```

---

## Task 3: Regression test — grader handles a Mixed item under enforce

Proves the unchanged engine treats a Mixed item correctly: exact placement passes; the agreement trap is `flagged` but does NOT pass (enforce → retry); the distractor in a slot is `wrong`. This test should pass WITHOUT touching `grade.ts` — it guards the data-only assumption against future engine changes.

**Files:**
- Test: `src/domain/grade.test.ts` (new test inside the existing `describe('gradePlacement', ...)`)

- [ ] **Step 1: Write the test**

In `src/domain/grade.test.ts`, add at the end of the `describe('gradePlacement', ...)` block (before its closing `});`):

```ts
  it('Mixed item (enforce, S+V+O): exact passes, trap flagged-no-pass, distractor wrong', () => {
    const mixedItem: Pick<DrillItem, 'answer' | 'traps' | 'strictness'> = {
      answer: ['I', 'eat', 'rice'],
      traps: [{ slot: 1, word: 'eats', tip: 'ฉัน → I eat 👍' }],
      strictness: 'enforce',
    };
    // exact -> ideal, passes
    expect(gradePlacement(['I', 'eat', 'rice'], mixedItem)).toEqual({
      status: 'ideal', passes: true, flags: [],
    });
    // agreement trap in its slot -> flagged but enforce blocks the pass
    expect(gradePlacement(['I', 'eats', 'rice'], mixedItem)).toEqual({
      status: 'flagged', passes: false, flags: ['ฉัน → I eat 👍'],
    });
    // distractor placed in the object slot -> wrong
    expect(gradePlacement(['I', 'eat', 'bread'], mixedItem).status).toBe('wrong');
  });
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npm test -- --run src/domain/grade.test.ts`
Expected: PASS with no change to `grade.ts` (the engine already supports this shape). If it fails, STOP — the data-only assumption is broken; do not edit `grade.ts` without re-reviewing the spec.

- [ ] **Step 3: Commit**

```bash
git add src/domain/grade.test.ts
git commit -m "test: grader handles a Mixed enforce item (trap + distractor)"
```

---

## Task 4: Add the Mixed card to the drill picker

**Files:**
- Modify: `src/components/DrillPicker.tsx:5-9`
- Test: `src/components/DrillPicker.test.tsx:10-14`

- [ ] **Step 1: Write the failing test**

In `src/components/DrillPicker.test.tsx`, add one assertion to the `'shows a card for each drill'` test (after the `Word Choice` line):

```ts
    expect(screen.getByText('Grammar')).toBeInTheDocument();
    expect(screen.getByText('Mixed')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/DrillPicker.test.tsx`
Expected: FAIL — `Unable to find an element with the text: Mixed`.

- [ ] **Step 3: Add the picker entry**

In `src/components/DrillPicker.tsx`, change the `DRILLS` array:

```ts
const DRILLS: { drill: DrillType; title: string }[] = [
  { drill: 'pattern', title: 'Pattern' },
  { drill: 'wordChoice', title: 'Word Choice' },
  { drill: 'grammar', title: 'Grammar' },
  { drill: 'mixed', title: 'Mixed' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/DrillPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DrillPicker.tsx src/components/DrillPicker.test.tsx
git commit -m "feat: add Mixed card to the drill picker"
```

---

## Task 5: Full verification gate

Not a TDD task — a green-bar gate before finishing the branch.

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: PASS. Count should be 114 (prior) + the new assertions/tests; all green.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean, exit 0.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: clean build, no TS errors.

- [ ] **Step 4: Manual phone e2e (smoke)**

Run: `npm run dev` (kill stale instances on 5173–5176 first if held). Open the served URL on a phone/responsive view. Hatch if needed → Pick a drill → confirm a **Mixed** card (🍰 Earns Treat) appears → play one Mixed L1 round → confirm: correct S+V+O passes; placing the trap/distractor rejects to retry (enforce, no soft-accept tip); finishing awards treat and the **treat** nutrition bar fills.

- [ ] **Step 5 (no commit if clean):** if dev-server smoke surfaced a fix, address it as its own TDD task; otherwise proceed to finishing.

---

## Task 6: Sync GAME_DESIGN.md + finish the branch

- [ ] **Step 1: Update the §12 level-matrix note in BOTH copies**

Add a "Mixed (shipped)" note alongside the existing "Grammar dial (shipped)" note in:
- `D:\ai_projects\AI_design_thinking\sentence-pet\GAME_DESIGN.md` (repo root)
- `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md`

Note text (adapt to the existing §12 wording): `Mixed (shipped): L1 = S+V+O + 1 distractor + 1 agreement trap, all dials on, graded enforce → 🍰 treat. L2–L5 await level-select.`

- [ ] **Step 2: Commit the repo-root copy**

```bash
git add GAME_DESIGN.md
git commit -m "docs: note Mixed L1 shipped in §12 level matrix"
```

(The H: copy is outside the repo — save it via the editor, not git.)

- [ ] **Step 3: Finish the branch**

Use superpowers:finishing-a-development-branch — feature branch `mixed-mode` → PR → merge-commit to `main` (preserve TDD history), matching the Grammar slice (PR #2). Push.

---

## Self-Review

**Spec coverage:**
- Boss grading = enforce → items carry `strictness:'enforce'` (Task 2); grader regression proves enforce rejects near-miss (Task 3). ✓
- Scope = Mixed L1 only, 5 items → Task 2 authors exactly 5, count-asserted. ✓
- Tray = 3 answer + 1 trap + 1 distractor → Task 2 shape assertion + free distinctness invariants. ✓
- Edit surface (5 spots: types, food, wordBank, DrillPicker, tests) → Tasks 1–4. ✓
- Data-only / no engine change → Task 3 explicitly forbids editing `grade.ts`. ✓
- treat bar live → verified in Task 5 manual smoke. ✓
- Docs sync → Task 6. ✓
- No persist bump → stated; no task touches `gameStore` persist. ✓

**Placeholder scan:** none — every code step shows full code; every run step shows exact command + expected output.

**Type consistency:** `DrillType` widened once (Task 1) and reused as-is; item fields (`drill`/`level`/`strictness`/`slots`/`answer`/`distractors`/`traps`) match `DrillItem` in `types.ts`; `gradePlacement` signature matches `grade.ts`; `DRILLS` shape matches the existing `DrillPicker.tsx` literal.

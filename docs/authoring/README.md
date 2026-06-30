# Sentence Pet — content authoring guides

These guides let you author game content with an AI, then import it through the
admin panel. You paste a guide into an AI chat, describe the content you want,
and the AI emits **tables you drop into an Excel workbook**. The admin importer
reads that workbook.

The guides are the contract. Each one is self-contained: it carries the full
schema, every rule the content must satisfy, a worked example, and the exact
output format the AI must produce. The AI never has to see the codebase.

## Which guide do I paste?

| You want to author… | Paste this guide |
|---|---|
| A whole new course from scratch | all of them, in order below |
| The course header + its units | [`course-and-units.md`](course-and-units.md) |
| Practice activities + the lessons they form | [`lessons-and-items.md`](lessons-and-items.md) |
| Review bosses (gates + final) | [`bosses.md`](bosses.md) |
| Pets (the collectible catalog) | [`pets.md`](pets.md) |

You can author one surface at a time. The importer accepts a workbook with
**only the sheet(s) you changed** — see *Additive imports* below.

---

## How content is shaped (read this once)

A **Course** is one workbook. Inside it:

- **Units** are the chapters of the journey (Basics, Next Steps, …).
- **Items** are individual practice activities (a drag-drop sentence, a
  flashcard, …). Every item lives in a shared **pool**.
- **Lessons** are groups of items inside a unit. **There is no Lessons sheet** —
  a lesson is formed by giving several Items the same `node` value. The last
  lesson in each unit is automatically its **checkpoint**.
- **Bosses** are review battles: mid-course **gates** and one **final** boss.
- **Pets** are the collectible catalog (separate system; guide coming).

So the workbook has these sheets, named **exactly** (case-sensitive):

```
Course   Units   Items   Bosses
```

A full new course needs all four. Pets are a separate, additive surface that
adds an optional fifth sheet: `Pets` (see [`pets.md`](pets.md)).

---

## The output format the AI must produce — TSV tables

This is locked. Every guide repeats it; it is stated once here in full.

The AI **cannot** produce a binary `.xlsx`. Instead it emits, for each sheet,
**one tab-separated (TSV) table**: a header row of column names, then one data
row per record. Tabs separate the cells. You paste each table into the matching
sheet of an Excel workbook (cell A1), and the tabs land each value in its own
column.

**Why tabs, not commas:** several columns hold comma-separated lists (e.g. a
drag-drop `answer` is `I,run`). If the table itself were comma-separated, those
commas would collide with the cell boundaries. Tabs keep the commas as data.

Every AI answer must end with the tables in this exact frame, one block per
sheet:

```
=== Sheet: Units ===
id<TAB>title<TAB>emoji<TAB>order<TAB>l1Enabled
u1-basics<TAB>Basics<TAB>🐣<TAB>1<TAB>true
u2-next<TAB>Next Steps<TAB>🌱<TAB>2<TAB>false

=== Sheet: Items ===
id<TAB>kind<TAB>...
...
```

`<TAB>` above means a literal Tab character (the AI must output real tabs, not
the text "<TAB>" and not spaces). Header row first. One blank line between
sheet blocks.

### Getting it into Excel

1. Open (or create) the workbook. Make sure a sheet is named exactly `Items`
   (etc.) — rename a tab if needed.
2. Select cell **A1** of that sheet.
3. Copy the AI's table block (the lines under `=== Sheet: Items ===`, **not**
   the `=== Sheet ===` label) and paste. Tabs split it into columns.
4. Repeat per sheet. Save as `.xlsx`.

### Loading it into the game

Admin panel → open the surface you're importing (Pool, Bosses, Journey, …) →
toolbar **Import…** → choose your `.xlsx`. The drawer shows a preview and any
validation errors before you apply.

---

## Whole-course vs additive imports

- **Whole new course:** include all four sheets. The importer reads the single
  `Course` row, builds units + lessons from `Units`/`Items`, and attaches
  bosses from `Bosses`.
- **Additive (one surface):** include only the sheet(s) you changed. Importing
  an `Items`-only workbook updates the pool and the lessons those items form;
  importing a `Bosses`-only workbook updates the bosses. **Import is merge by
  `id`:** a row whose `id` already exists overwrites that record; a new `id`
  adds one. Records you don't include are left untouched.

> Because lessons are derived from the `Items` sheet's `node` grouping, an
> additive `Items` import also re-forms the affected lessons. Keep a unit's full
> set of items together when re-importing that unit.

---

## Rules every workbook must satisfy

The importer validates before it lets you apply. State these to the AI so it
self-checks (each guide repeats the rules for its own surface):

**Journey (Units + Items):**
- at least one unit; unit `id`s unique.
- each unit has at least one lesson; each lesson at least one item.
- lesson `id`s (= `node` values) unique across the whole course.
- **exactly one checkpoint per unit, and it must be the last lesson.** The
  importer marks the last `node` group in each unit as the checkpoint, so order
  the checkpoint's items last in that unit.
- every item a lesson references must exist in the pool (it does, if it's a row
  on the `Items` sheet for that unit).

**Bosses:**
- the course has exactly one `final` boss.
- every `reviewsUnits` id is a known unit; every `pinnedItemIds` id is a known
  item.
- each boss reviews at least one unit; `reviewCount` ≥ 1.
- a `gated` boss has an `afterUnit` that names a known unit; no two gates share
  the same `afterUnit`.
- any `rewardPetDefId` names a known pet.

Per-item rules live in [`lessons-and-items.md`](lessons-and-items.md).

---

## Not supported by import (v1)

State these to the AI as out of scope so it doesn't emit columns the importer
ignores:

- **Grammar `traps`** (the wrong-answer tips on a `grammar` drag-drop) — the
  type supports them, the importer does not read them yet. Author traps in the
  admin editor after import.
- **Boss display fields** (tier, element, name, sprite) — synthesized with
  defaults on import; tune them in the admin Bosses editor afterward.
- **Matching images, sprite variants** — not in the xlsx contract.

Pet rules live in [`pets.md`](pets.md) — pets are their own additive surface.

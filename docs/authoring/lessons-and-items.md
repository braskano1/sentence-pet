# Authoring guide — Items (activities) + the Lessons they form

**Paste this whole file into an AI chat, then describe the practice content you
want.** It produces one TSV table: the `Items` sheet. Every row is one practice
activity; the rows also **form the lessons** of each unit, through the `node`
column. There is no separate Lessons sheet.

This is the densest guide. Read the "How lessons form" section before authoring.

> **Tip — start from the template.** In the admin **Items** tab, open **Import…**
> and click **"Download template (with examples)"** to get an `Items` `.xlsx`
> already set up with these columns and one sample row per kind. Then have the AI
> produce more rows like the samples. The columns below match that template
> exactly.

---

## What this produces

- **`Items` sheet** — one row per pool item. Four activity kinds:
  `dragdrop`, `flashcard`, `fillblank`, `matching`.
- **Lessons** — derived, not authored separately. Items that share a `node`
  value become one lesson inside a unit. The last node group in each unit is
  automatically that unit's **checkpoint**.

It depends on the `Units` sheet (each item's `unit` must match a unit id) — see
[`course-and-units.md`](course-and-units.md).

---

## How lessons form (the core mechanic)

Each item row names:
- a `unit` — which chapter it belongs to (must match a `Units.id`).
- a `node` — the **lesson id** it joins.

All rows with the same `node` become one lesson, in row order. So to make a
"pattern practice" lesson in unit `u1-basics`, give five items
`unit = u1-basics` and `node = u1-pattern`.

Rules that fall out of this:
- If you leave `node` blank, it defaults to `<unit>-<kind>` (e.g.
  `u1-basics-dragdrop`). Fine when a unit has one lesson per kind; name nodes
  explicitly when you want more control.
- A `node` may **not** span two units (all rows sharing a node must share a
  `unit`).
- **The last node group in each unit becomes the checkpoint** — and validation
  requires the checkpoint to be last. So **order each unit's rows with the
  checkpoint lesson's items last.** Put the review/mixed lesson at the bottom of
  the unit's block of rows.
- Lesson ids (= `node` values) must be **unique across the whole course**, not
  just within a unit.

> The importer sets every derived lesson's internal drill to `pattern` and takes
> its `level` from the group. The item's own `kind`/`variant` still drive what
> the learner sees. You don't author lessons directly — just group items.

---

## `Items` sheet — shared columns (all kinds)

| Column | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | ✅ | Unique pool item id (unique across the whole `Items` sheet). |
| `kind` | `dragdrop` / `flashcard` / `fillblank` / `matching` | ✅ | Activity kind. Any other value is an error. |
| `unit` | string | ✅ | Unit this item's lesson belongs to. Must match a `Units.id`. |
| `node` | string | – | Lesson id this item joins. Blank → `<unit>-<kind>`. |
| `level` | number ≥ 1 | – | Difficulty 1–5. Defaults to 1. |
| `l1_th` | string | – | Thai (L1) helper text. Applies to flashcard / fillblank / matching. **Drag-drop uses `thaiHint` instead (see below).** |

Then per-kind columns. A row only needs the columns for its own `kind`; leave
the others blank.

---

## Kind: `dragdrop` — build a sentence from word tiles

| Column | Type | Required | Meaning |
|---|---|---|---|
| `variant` | `pattern` / `wordChoice` / `grammar` / `mixed` | – | The drill style. Defaults to `pattern`. |
| `thaiHint` | string | – | The Thai scaffold shown to the learner (drag-drop's L1 text — **not** `l1_th`). |
| `slots` | CSV of `Subject` / `Verb` / `Object` / `Be` / `Adjective` / `Not` / `Helper` / `Question` / `Place` | ✅ | The sentence frame, in order. |
| `answer` | CSV | ✅ | The correct word per slot, **same length and order as `slots`**. |
| `distractors` | CSV | – | Extra wrong tiles to mix in (used by `wordChoice` / `mixed`). |
| `punct` | `.` / `?` | – | Display sentence-ending punctuation. Defaults to `.`; use `?` for questions. Display-only — never affects grading. |
| `hidePos` | `true` / `false` | – | Hide the part-of-speech labels on the slots. |

- `variant` meanings: `pattern` = arrange the right words; `wordChoice` = pick
  correct word forms (give `distractors`); `grammar` = conjugation focus;
  `mixed` = a blend (typically the checkpoint).
- **`answer` must have exactly as many comma-separated values as `slots`.**
- Grammar **traps** (per-slot "almost right" tips) are **not importable** — the
  type has them but the importer ignores them. Add traps in the admin editor
  after import if you need them.

Example rows:

| id | kind | unit | node | level | variant | thaiHint | slots | answer | distractors | punct |
|---|---|---|---|---|---|---|---|---|---|---|
| l1-1 | dragdrop | u1-basics | u1-pattern | 1 | pattern | ฉันวิ่ง | Subject,Verb | I,run | | |
| wc-l1-1 | dragdrop | u1-basics | u1-wordchoice | 1 | wordChoice | ฉันวิ่ง | Subject,Verb | I,run | runs,running | |
| l2-1 | dragdrop | u2-next-steps | u2-pattern | 2 | pattern | ฉันกินข้าว | Subject,Verb,Object | I,eat,rice | | |
| q-l2-1 | dragdrop | u2-next-steps | u2-pattern | 2 | pattern | คุณชอบปลาไหม | Helper,Subject,Verb,Object | do,you,like,fish | | ? |

---

## Kind: `flashcard` — front/back recall

| Column | Type | Required | Meaning |
|---|---|---|---|
| `front` | string | ✅ | Prompt side. |
| `back` | string | ✅ | Answer side. |
| `audio` | string (url) | – | Optional audio clip url. |
| `image` | string (url) | – | Optional picture url, shown on the **back** face only. |
| `imageCaption` | `true` / `false` | – | Default `true` → show the `back` word under the image; `false` → image only. Only `false` is meaningful. |
| `l1_th` | string | – | Thai helper. |

Example:

| id | kind | unit | node | level | front | back | l1_th |
|---|---|---|---|---|---|---|---|
| fc-1 | flashcard | u1-basics | u1-vocab | 1 | dog | หมา | หมา |

---

## Kind: `fillblank` — type the missing word

| Column | Type | Required | Meaning |
|---|---|---|---|
| `template` | string | ✅ | The sentence with **exactly one** `___` (three underscores) as the blank. |
| `answer` | string | ✅ | The correct fill (trimmed, matched strictly). |
| `alternates` | CSV | – | Other accepted answers. |
| `l1_th` | string | – | Thai helper. |

- The template must contain **exactly one** `___`. Zero or two fails validation.
- `answer` here is the **same `answer` column** drag-drop uses — one shared column, not a separate fill-answer column.

Example:

| id | kind | unit | node | level | template | answer | alternates | l1_th |
|---|---|---|---|---|---|---|---|---|
| fb-1 | fillblank | u1-basics | u1-fill | 1 | I ___ rice every day | eat | eats | ฉันกินข้าว |

---

## Kind: `matching` — pair left with right

| Column | Type | Required | Meaning |
|---|---|---|---|
| `pair1`, `pair2`, … | string cell `left\|right\|th` + optional image suffix | ✅ (≥ 2) | One pair per `pairN` column. `left` and `right` required; `th` (Thai) optional. Separate parts with a pipe `\|`. Append optional image fields as `key=value` segments (see below). |
| `l1_th` | string | – | Thai helper for the whole item. |

- Use as many `pairN` columns as you need pairs; **at least two**.
- Each cell is `left|right|th`. Omit the trailing `|th` if no Thai:
  `dog|หมา`.
- **Pair images (optional).** After the `left|right|th` core, append any of these
  `key=value` segments, pipe-separated, in any order:
  - `li=<url>` — left-side image; `ri=<url>` — right-side image.
  - `lc=false` — hide the left caption (the `left` word); `rc=false` — hide the
    right caption. Captions show by default; only `false` is meaningful, and a
    caption only applies when its image side is present.
  - Add only the segments you need — omit the rest. Unknown keys are ignored.
  - Example: `dog|หมา|หมา|li=/img/dog.png|lc=false` — a pair with a left image and
    its caption hidden. `dog|หมา||ri=/img/hma.png` — right image only, no Thai.

Example (two pairs):

| id | kind | unit | node | level | pair1 | pair2 |
|---|---|---|---|---|---|---|
| mt-1 | matching | u1-basics | u1-match | 1 | dog\|หมา\|หมา | cat\|แมว\|แมว |

---

## Rules to satisfy (self-check before emitting)

Per item:
- `id` present and unique across the sheet; `kind` is one of the four.
- `unit` matches a unit id; `level` ≥ 1.
- `l1_th` (if present) is non-empty.
- **dragdrop:** `answer` count == `slots` count; `slots` only uses
  `Subject`/`Verb`/`Object`/`Be`/`Adjective`/`Not`/`Helper`/`Question`/`Place`.
  Set `punct` to `?` for question frames (defaults to `.`).
- **flashcard:** `front` and `back` both non-empty.
- **fillblank:** `template` has exactly one `___`; `answer` non-empty.
- **matching:** at least two `pairN` cells; each has a non-empty `left` and
  `right`.

Lesson / journey:
- Every unit ends up with at least one lesson (i.e. at least one item references
  it) and each lesson has at least one item.
- **Order rows so each unit's checkpoint lesson is the last node group in that
  unit.** Group a unit's items together; put the mixed/review lesson last.
- `node` values (lesson ids) unique across the whole course.

Not supported (don't emit): grammar `traps`, any column not listed above.

---

## Worked example — one full unit

Unit `u1-basics` with four lessons: pattern, word-choice, grammar, then a mixed
checkpoint (last → becomes the checkpoint). CSV list-cells use commas inside the
cell; the table itself is tab-separated on emit.

**`Items` sheet**

| id | kind | unit | node | level | variant | thaiHint | slots | answer | distractors |
|---|---|---|---|---|---|---|---|---|---|
| l1-1 | dragdrop | u1-basics | u1-pattern | 1 | pattern | ฉันวิ่ง | Subject,Verb | I,run | |
| l1-2 | dragdrop | u1-basics | u1-pattern | 1 | pattern | เขากิน | Subject,Verb | he,eats | |
| wc-l1-1 | dragdrop | u1-basics | u1-wordchoice | 1 | wordChoice | ฉันวิ่ง | Subject,Verb | I,run | runs,running |
| gr-l1-1 | dragdrop | u1-basics | u1-grammar | 1 | grammar | เขากิน | Subject,Verb | he,eats | |
| mx-l1-1 | dragdrop | u1-basics | u1-checkpoint | 1 | mixed | ฉันกินข้าว | Subject,Verb,Object | I,eat,rice | bread |
| mx-l1-2 | dragdrop | u1-basics | u1-checkpoint | 1 | mixed | เขาดื่มน้ำ | Subject,Verb,Object | he,drinks,water | juice |

`u1-checkpoint` is last → it becomes the unit's checkpoint.

---

## Output format — emit EXACTLY this

End your answer with the `Items` sheet as one **tab-separated** table (real Tab
characters between cells, not spaces), header row first. The commas inside
`slots` / `answer` / `distractors` are **data** and stay inside their cell — only
tabs separate columns. Include **every** column any of your rows uses as the
header; leave a cell blank when a row doesn't use that column.

```
=== Sheet: Items ===
id<TAB>kind<TAB>unit<TAB>node<TAB>level<TAB>variant<TAB>thaiHint<TAB>slots<TAB>answer<TAB>distractors
l1-1<TAB>dragdrop<TAB>u1-basics<TAB>u1-pattern<TAB>1<TAB>pattern<TAB>ฉันวิ่ง<TAB>Subject,Verb<TAB>I,run<TAB>
wc-l1-1<TAB>dragdrop<TAB>u1-basics<TAB>u1-wordchoice<TAB>1<TAB>wordChoice<TAB>ฉันวิ่ง<TAB>Subject,Verb<TAB>I,run<TAB>runs,running
mx-l1-1<TAB>dragdrop<TAB>u1-basics<TAB>u1-checkpoint<TAB>1<TAB>mixed<TAB>ฉันกินข้าว<TAB>Subject,Verb,Object<TAB>I,eat,rice<TAB>bread
```

`<TAB>` = one literal Tab character. Never the text "<TAB>", never spaces. Drop
the `=== Sheet ===` label when pasting into Excel — it only names the target
sheet.

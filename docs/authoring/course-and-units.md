# Authoring guide — Course header + Units

**Paste this whole file into an AI chat, then tell it what course you want.**
It produces two TSV tables — the `Course` sheet (one row) and the `Units` sheet
(one row per chapter). Pair it with [`lessons-and-items.md`](lessons-and-items.md)
(the activities) and [`bosses.md`](bosses.md) (the review battles) to build a
full course.

> **Tip — start from the template.** In the admin **Courses** tab, click
> **"Download course template"** to get a `.xlsx` already set up with these
> columns and sample rows (it bundles the Course/Units/Items/Bosses sheets).
> Then have the AI produce more rows like the samples. The columns below match
> that template exactly.

---

## What this produces

- **`Course` sheet** — a single row of course-level metadata (id, title, emoji,
  whether the Thai layer is ready).
- **`Units` sheet** — one row per unit (chapter). A unit carries no lessons
  here; its lessons come from the `Items` sheet (see the items guide). Units are
  ordered by the `order` column.

---

## `Course` sheet — columns (exactly ONE data row)

| Column | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | ✅ | Stable course id. If blank, the whole import fails. |
| `title` | string | ✅ | Display title. |
| `emoji` | string | – | Course emoji. |
| `l1Ready` | `true` / `false` | – | Whether the course's Thai (L1) layer is ready to show. Omit or `false` if unsure. |

Only one course per workbook → exactly one data row under the header.

## `Units` sheet — columns (one row per unit)

| Column | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | ✅ | Unit id. Referenced by Items (`unit`) and Bosses (`afterUnit`, `reviewsUnits`). Keep it short and stable. |
| `title` | string | – | Unit title. |
| `emoji` | string | – | Unit emoji. |
| `order` | number | – | Sort order (1, 2, 3, …). If blank/0, defaults to row position. |
| `l1Enabled` | `true` / `false` | – | Gates the Thai/English toggle for this whole unit. Omit or `false` if unsure. |

---

## Rules to satisfy (self-check before emitting)

- `Course.id` is present and non-empty.
- At least one unit row.
- Unit `id`s are **unique**.
- `order` values are distinct and ascending (1, 2, 3, …) so chapters sort
  predictably. (Blank is allowed — it falls back to row order — but explicit is
  clearer.)
- A course is only *complete* with units that contain lessons (items guide) and
  exactly one final boss (bosses guide). This file alone produces a valid
  `Course` + `Units` pair; the journey isn't valid until items + bosses exist.

## Conventions

- Bool columns accept literal `true` / `false` (case-insensitive). Anything else
  reads as `false`.
- Keep ids lowercase-kebab and meaningful (`u1-basics`, not `unit1`) — they show
  up in item/boss references and in validation errors.

---

## Worked example

A two-unit beginner course.

**`Course` sheet**

| id | title | emoji | l1Ready |
|---|---|---|---|
| thai-eng-starter | Thai → English Starter | 🐣 | true |

**`Units` sheet**

| id | title | emoji | order | l1Enabled |
|---|---|---|---|---|
| u1-basics | Basics | 🐣 | 1 | true |
| u2-next-steps | Next Steps | 🌱 | 2 | true |

---

## Output format — emit EXACTLY this

End your answer with the two sheet blocks below, each a **tab-separated** table
(real Tab characters between cells, not spaces), header row first, one blank
line between blocks. Emit nothing after the tables.

```
=== Sheet: Course ===
id<TAB>title<TAB>emoji<TAB>l1Ready
thai-eng-starter<TAB>Thai → English Starter<TAB>🐣<TAB>true

=== Sheet: Units ===
id<TAB>title<TAB>emoji<TAB>order<TAB>l1Enabled
u1-basics<TAB>Basics<TAB>🐣<TAB>1<TAB>true
u2-next-steps<TAB>Next Steps<TAB>🌱<TAB>2<TAB>true
```

`<TAB>` = one literal Tab character. Do not output the text "<TAB>", and do not
use spaces. Do not include the `=== Sheet ===` labels when pasting into Excel;
they only tell you which sheet each block goes to.

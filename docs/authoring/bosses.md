# Authoring guide — Bosses (review gates + final)

**Paste this whole file into an AI chat, then describe the review battles you
want.** It produces one TSV table: the `Bosses` sheet. Bosses are review
battles that sample items from units the learner has finished.

Depends on the `Units` and `Items` sheets — bosses reference unit ids and
(optionally) item ids. See [`course-and-units.md`](course-and-units.md) and
[`lessons-and-items.md`](lessons-and-items.md).

> **Tip — start from the template.** In the admin **Bosses** tab, open
> **Import…** and click **"Download template (with examples)"** to get a `Bosses`
> `.xlsx` already set up with these columns and sample gate + final rows. Then
> have the AI produce more rows like the samples. The columns below match that
> template exactly.

---

## What this produces

- **`Bosses` sheet** — one row per boss. Two scopes:
  - **`gated`** — a mid-course gate that sits *after* a given unit. A course can
    have several.
  - **`final`** — the single end-of-course boss. **Exactly one per course.**

A boss draws a set of review items from the units it covers (plus any pinned
items), so it tests retention across chapters.

---

## `Bosses` sheet — columns

| Column | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | ✅ | Boss id (unique). |
| `scope` | `gated` / `final` | ✅ | Gate (mid-course) or the single final. Any other value is an error. |
| `afterUnit` | string | ✅ for `gated` | Unit id the gate sits **after**. Must match a `Units.id`. Leave blank for `final`. |
| `reviewsUnits` | CSV of unit ids | ✅ (≥ 1) | Units this boss samples review items from. |
| `reviewCount` | number ≥ 1 | – | How many review items to sample. |
| `pinnedItemIds` | CSV of item ids | – | Items always included (the rest are sampled). Each must be a known item id. |
| `rewardPetDefId` | string | – | Grant this specific pet on first clear. Must name a known pet-def. Omit if none. |

---

## What you do NOT set here (synthesized on import)

The boss's **display fields** — tier, element, name, rival sprite — are filled
with defaults by the importer. **Do not invent columns for them.** After
importing, open the admin **Bosses** editor to set the boss's name, element,
tier, and sprite. (Authoring those via xlsx is out of scope for v1.)

`final` bosses automatically get "complete the course" behavior on clear; you
don't set that.

---

## Rules to satisfy (self-check before emitting)

- Exactly **one** `final` boss in the course.
- Every `reviewsUnits` id is a known unit id; each boss reviews **at least one**
  unit.
- Every `pinnedItemIds` id is a known item id.
- `reviewCount` ≥ 1 if set.
- Each `gated` boss has an `afterUnit` that names a known unit.
- **No two gates share the same `afterUnit`** (two gates after the same unit is
  ambiguous and fails validation).
- Any `rewardPetDefId` names a known pet.

## Conventions

- A gate typically reviews the units up to and including the one it follows; the
  final boss typically reviews all units.
- Keep `reviewCount` ≤ the number of distinct items across the reviewed units.

---

## Worked example

One mid-course gate after unit 2, plus the final boss covering all three units.

**`Bosses` sheet**

| id | scope | afterUnit | reviewsUnits | reviewCount | pinnedItemIds | rewardPetDefId |
|---|---|---|---|---|---|---|
| gate-midcourse | gated | u2-next-steps | u1-basics,u2-next-steps | 5 | mx-l1-1 | |
| final-course | final | | u1-basics,u2-next-steps,u3-challenge | 6 | gr-l1-1 | def-leaf |

The gate sits after `u2-next-steps` and reviews units 1–2; the final reviews all
three and grants pet `def-leaf` on first clear.

---

## Output format — emit EXACTLY this

End your answer with the `Bosses` sheet as one **tab-separated** table (real Tab
characters between cells, not spaces), header row first. The commas inside
`reviewsUnits` / `pinnedItemIds` are **data** and stay inside their cell — only
tabs separate columns. Leave a cell blank when a row doesn't use it (e.g.
`afterUnit` for the final boss).

```
=== Sheet: Bosses ===
id<TAB>scope<TAB>afterUnit<TAB>reviewsUnits<TAB>reviewCount<TAB>pinnedItemIds<TAB>rewardPetDefId
gate-midcourse<TAB>gated<TAB>u2-next-steps<TAB>u1-basics,u2-next-steps<TAB>5<TAB>mx-l1-1<TAB>
final-course<TAB>final<TAB><TAB>u1-basics,u2-next-steps,u3-challenge<TAB>6<TAB>gr-l1-1<TAB>def-leaf
```

`<TAB>` = one literal Tab character. Never the text "<TAB>", never spaces. Note
the two consecutive tabs after `final` — that's the empty `afterUnit` cell. Drop
the `=== Sheet ===` label when pasting into Excel.

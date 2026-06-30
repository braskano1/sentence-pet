# Handoff — Import authoring guides (AI-readable) + new Pets file-import

**Date:** 2026-06-30
**Repo:** `sentence-pet` — `D:/ai_projects/AI_design_thinking/sentence-pet`. Currently on `main` (the admin-uiux-revise epic incl. per-surface ImportDrawer just merged: `75f29a5`).
**Hazard reminder:** Bash with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (PowerShell-tool cwd resolves wrong + resets each command). `tsc -b` not `--noEmit`. Stage explicit files, never `git add -A`. Append to `*.test.*`, never clobber. Admin tokens stay scoped to `.admin-root`. Start feature work on a NEW branch off `main`, not on `main`.

---

## Goal

Produce a set of **Markdown authoring guides** that a content author can paste into an AI chat so the AI emits **import-ready content** for every admin surface — Course, Units, Lessons, Items (the 4 activity kinds), Bosses, **and Pets**. The guides are the contract: each is self-contained (schema + constraints + worked example + required output format) so the AI never has to read the codebase.

Two streams:
- **Stream A (docs only) — authoring guides for the EXISTING importer.** Course / Units / Items / Lessons / Bosses already import via the xlsx pipeline (`src/content/excelImport.ts`, `parseWorkbookToCourse` + the per-surface `importItems`/`importBosses`/`importUnits` adapters in `src/content/surfaceImport.ts`). Write the guides against that ground truth (below). No feature code.
- **Stream B (feature + docs) — NEW Pets file-import.** Pets have **no file import today** (admin-UI-only → Firestore doc `content/petDefs`). Build a Pets xlsx import mirroring the just-shipped Items/Bosses/Journey ImportDrawer pattern, THEN write the Pets authoring guide against that new format. (User decision 2026-06-30: build the import, don't just document JSON.)

> **Why guides at all:** the importer reads `.xlsx`. An AI can't emit a binary `.xlsx`, but it CAN emit one TSV/CSV/markdown table per sheet that the author pastes into a workbook whose sheets are named exactly `Course` / `Units` / `Items` / `Bosses` (and the new `Pets`). Each guide must end with an explicit "emit your answer as N labelled tables, one per sheet, tab-separated, header row first" instruction. Lock the output format as the FIRST decision (see Open Decisions).

---

## Proposed deliverable file set

Create under `docs/authoring/` (new dir). One master index + one guide per surface so an author pastes only the relevant guide:

- `docs/authoring/README.md` — index + the shared rules (sheet naming, output format the AI must emit, whole-workbook vs per-surface import, the additive-merge semantics, how to load a file: admin → surface toolbar → `Import…`).
- `docs/authoring/course-and-units.md` — Course row + Units sheet (+ how a Course ties together).
- `docs/authoring/lessons-and-items.md` — **the big one.** The 4 item kinds AND how lessons are formed (there is NO Lessons sheet — lessons emerge from the `node` column grouping on the Items sheet). Worked examples per kind.
- `docs/authoring/bosses.md` — gated + final bosses.
- `docs/authoring/pets.md` — the NEW Pets sheet (written after Stream B lands).

Each guide: (1) one-paragraph "what this produces", (2) the exact columns with type + required/optional + meaning, (3) the relationships/grouping rules, (4) every validation rule the content must satisfy (so the AI self-checks), (5) a full worked example, (6) the "emit as tables" output instruction.

---

## GROUND TRUTH — schema reference (source of every guide)

All column contracts come from `src/content/excelImport.ts`. All validation rules from `src/content/validate.ts`. Types from `src/data/types.ts` + `src/content/model.ts` + `src/content/course.ts`.

### A. `Course` sheet (single data row)
| Column | Type | Req | Meaning |
|---|---|---|---|
| `id` | string | ✅ | course id (stable). Required or the whole parse fails. |
| `title` | string | ✅ | display title |
| `emoji` | string | – | course emoji |
| `l1Ready` | bool (`true`/`false`) | – | whether the course's Thai (L1) layer is ready |

One Course row only (row 2). `parseWorkbookToCourse` requires all four sheets `Course`/`Units`/`Items`/`Bosses` to exist for a WHOLE-course import; the per-surface drawers are tolerant (a sheet may be absent).

### B. `Units` sheet (one row per unit)
| Column | Type | Req | Meaning |
|---|---|---|---|
| `id` | string | ✅ | unit id (referenced by Items `unit` + Bosses `afterUnit`) |
| `title` | string | – | unit title |
| `emoji` | string | – | unit emoji |
| `order` | number | – | sort order; defaults to row position if blank/0 |
| `l1Enabled` | bool | – | gates the TH/ENG toggle for the whole unit |

A Units row carries NO lessons — lessons are derived from the Items sheet (next).

### C. `Items` sheet → pool items **and** lessons
Each row is one pool item. The row's `node` column groups items into a **Lesson** inside a unit. **There is no separate Lessons sheet.** The last `node` group within a unit is automatically marked the unit's checkpoint.

Shared columns (all kinds):
| Column | Type | Req | Meaning |
|---|---|---|---|
| `id` | string | ✅ | unique pool item id |
| `kind` | `dragdrop`/`flashcard`/`fillblank`/`matching` | ✅ | activity kind (unknown kind = error) |
| `level` | number ≥1 | – | difficulty 1..5 (defaults 1) |
| `unit` | string | ✅* | which unit this item's lesson belongs to (must match a Units `id`) |
| `node` | string | – | the LESSON id this item joins. Blank → derived as `<unit>-<kind>`. All items sharing a `node` become one lesson; a `node` may not span two units. |
| `l1_th` | string | – | Thai L1 helper (flashcard/fillblank/matching; dragdrop uses `thaiHint` instead) |

Per-kind columns:
- **dragdrop**: `variant` (= drill: `pattern`/`wordChoice`/`grammar`/`mixed`, default `pattern`), `thaiHint` (string, the L1 scaffold), `slots` (CSV of `Pronoun`/`Verb`/`Object`), `answer` (CSV, SAME length as slots), `distractors` (CSV, optional), `hidePos` (bool, optional). (Grammar `traps` are not yet a column — note as a gap; they exist in the type.)
- **flashcard**: `front` (string), `back` (string), `audio` (string, optional).
- **fillblank**: `template` (string with exactly one `___`), `answer` (string, strict trimmed), `alternates` (CSV, optional).
- **matching**: `pair1`, `pair2`, … columns, each a cell `left|right|th` (th optional). ≥2 pairs.

CSV columns are comma-separated, trimmed, blanks dropped. Bool = literal `true` (case-insensitive) else false.

Lesson formation (from `excelImport.ts` node grouping): one Lesson per `node` group, `drill` defaults to `pattern`, `level` from the group, `itemIds` in row order; **the last lesson in each unit is force-marked `isCheckpoint`**.

### D. `Bosses` sheet (gates + one final)
| Column | Type | Req | Meaning |
|---|---|---|---|
| `id` | string | ✅ | boss id |
| `scope` | `gated` / `final` | ✅ | gate (mid-course) or the single final |
| `afterUnit` | string | gated→✅ | unit id the gate sits after (gated only) |
| `reviewsUnits` | CSV of unit ids | ✅ (≥1) | units this boss samples review items from |
| `reviewCount` | number ≥1 | – | how many review items to sample |
| `pinnedItemIds` | CSV of item ids | – | always-included items (rest sampled) |
| `rewardPetDefId` | string | – | grant this specific PetDef on first clear (must name a known pet) |

Boss display fields (tier/element/name/sprite) are synthesised with defaults by the parser today (`bossCfg()`), not author-supplied via xlsx — note this in the guide (authors tune them in the admin Bosses editor after import). A course must end with exactly one `final` boss; `final` rows get `onClear: completeCourse` automatically.

### E. Validation rules the content MUST satisfy (`validateCourse`)
State these in the guides so the AI self-checks before emitting:
- Journey: ≥1 unit; unit ids unique; each unit ≥1 lesson; **exactly one checkpoint per unit and it must be the LAST lesson** (the importer guarantees this via node order — guides should tell authors to order each unit's checkpoint node last); lesson ids unique across the whole journey; each lesson ≥1 item; every `itemId` resolves to a pool item.
- Per item: `level ≥ 1`; `l1.th` non-empty if present. dragdrop: `answer.length === slots.length`, trap slot in range. flashcard: front+back non-empty. matching: ≥2 pairs, each left+right non-empty. fillblank: template has exactly one `___`, answer non-empty.
- Bosses: every `reviewsUnits` id known; every `pinnedItemIds` id known; each review boss reviews ≥1 unit; `reviewCount ≥ 1`; gated → `afterUnit` set+known; no two gates share the same `afterUnit`; the course has a final boss; any `rewardPetDefId` names a known pet-def.

### F. `PetDef` shape (for Stream B + the Pets guide) — `src/data/types.ts:118-145`
```
PetDef {
  id: string            // unique, stable
  name: string
  gen: number ≥1
  dexNo: number ≥1      // (gen,dexNo) unique across catalog
  types: PetType[]      // ≥1, each a member of the PET_TYPES registry (src/domain/petType.ts, isPetType)
  element: Species      // one of leaf|fire|air|water (art family / fallback sprite)
  statBands: Record<Rarity, Record<'hp'|'atk'|'def'|'spd'|'luk', [min,max]>>  // ALL 4 rarities × 5 stats, min≤max, min≥0
  evolvesFromId?: string  // ref another PetDef.id
  evolvesToId?: string    // ref another PetDef.id
  evolutionStage?: number ≥1  // strictly increasing along an evolvesToId chain; no cycles
  starter?: boolean       // EXACTLY one def true across the catalog; it must be gen 1, dexNo 1
  enabled: boolean        // ≥1 def must be enabled
  gachaObtainable?: boolean   // absent = obtainable
  rarity?: Rarity         // optional spawn-rarity override (common|rare|epic|legendary)
  sprite?: { default?: url; variants?: Partial<Record<stage, Partial<Record<'happy'|'sad', url>>>> }  // http(s) urls; egg never overridable
}
```
PetDef validation (`validatePetDefs`, `src/content/validate.ts:153`): unique ids; non-empty id+name; `element` ∈ the fixed four; gen/dexNo ≥1 and (gen,dexNo) unique; types non-empty + each a known PetType; statBands present for ALL 4 rarities × 5 stats with numeric min≤max, min≥0; evolves refs resolve; evolutionStage strictly increases along chains, no cycles; exactly one starter at gen1/dexNo1; ≥1 enabled; sprite urls valid http(s). Builtins: `BUILTIN_PET_DEFS` in `src/domain/petDef.ts`. Persistence: Firestore doc `content/petDefs` via `savePetDefs`/`fetchPetDefs` (`src/firebase/content.ts`), reactive via `subscribePetDefs` + `usePetDefs`.

---

## Stream B — design the NEW Pets file-import

Mirror the just-shipped pattern exactly (study these first): `src/content/mergeById.ts`, `src/content/surfaceImport.ts`, `src/components/admin/ui/ImportDrawer.tsx`, and how `PetsTab.tsx` is structured + how the other tabs wired the drawer (`PoolTab`/`BossesTab`/`JourneyTab`).

Pieces to build (each TDD, subagent-driven):
1. **`Pets` sheet parser** — `parsePetsSheet(wb): { defs: PetDef[]; errors: string[] }` (new, e.g. in `src/content/petImport.ts`). Tolerant of an absent sheet. Reuse the `str`/`num`/`bool`/`csv` helper style from `excelImport.ts`.
2. **The flat-column encoding decision (the hard part).** `statBands` is `Record<Rarity, Record<stat,[min,max]>>` = 20 ranges; `types` is an array; `sprite` is nested. Flat xlsx can't hold that naturally. Pick an encoding and document it in the guide. Options to weigh in the plan:
   - **(a) Per-rarity-stat columns:** `common_hp`, `common_atk`, … `legendary_luk` (20 columns, each `min-max` or two columns). Explicit but very wide.
   - **(b) Base band + rarity multipliers / a shared band table:** author gives ONE base stat range; the parser derives the 4 rarity bands the way `bandsFromGacha()` does. Far fewer columns; matches how builtins are generated. **Recommended default** — confirm with the user.
   - **(c) A single JSON cell** for `statBands` (and `sprite`): one column whose cell is a JSON blob. Compact, but defeats "human edits in Excel".
   - `types` → a CSV column. `sprite.default` → a url column; variants likely out-of-scope for v1 (note as deferred).
3. **`importPets` adapter** — in `surfaceImport.ts` (or a sibling), `importPets(wb): SurfaceImport<PetDef>` filtering errors to the `Pets` prefix, "no pet rows found" fallback. Follow the own-sheet-error-prefix discipline already established.
4. **PetsTab ImportDrawer wiring** — a toolbar `Import…` button + `ImportDrawer<PetDef>` with `existing={petDefs}`, `getId={d => d.id}`, an injectable `parsePetsFile` prop. **Apply path differs from the course surfaces:** pets persist to Firestore (`savePetDefs`), not via `onChange(course)`. Decide whether apply merges into the in-memory draft (then the existing Save flow writes) or saves directly. Prefer merging into the PetsTab draft so the existing save/validate gate runs — keeps `validatePetDefs` as the guard.
5. **Validation gate** — applying must not bypass `validatePetDefs`. Surface its errors (the drawer already shows a `ValidationSummary` for parse errors; cross-catalog rules like duplicate gen/dexNo or the single-starter rule are catalog-wide, so validate the MERGED set before enabling Apply, or block at save).
6. **Pets authoring guide** (`docs/authoring/pets.md`) — written against whatever encoding (2) lands.

Watch-outs specific to pets: the single-starter / gen1-dexNo1 rule and (gen,dexNo) uniqueness are **catalog-wide invariants** — an additive import that adds a second starter or a dex collision must be caught (validate the merged catalog, not just the incoming rows). Evolution refs may point at defs only present after merge.

---

## Open decisions (resolve before/early in planning)
1. **AI output format** (locks every guide): tab-separated tables per sheet (paste into Excel) vs CSV vs markdown tables vs a JSON the author converts. Recommend TSV tables, one per sheet, header row first — easiest Excel paste.
2. **Pets statBands encoding** — (a)/(b)/(c) above. Recommend (b) base-band + derived rarities; confirm.
3. **Whole-workbook vs per-surface guidance** — the guides should show BOTH: a full 4-sheet (or 5-sheet) workbook for a new course, and single-sheet files for additive per-surface imports (the drawers accept either).
4. **Boss display fields via xlsx?** Today tier/element/name/sprite are defaulted by the parser. Decide whether the Bosses guide tells authors to set them post-import in the admin editor (simplest) or whether to extend the Bosses parser to read them (small feature). Recommend document-post-import for now.
5. **Grammar `traps` + matching `l1`/images + sprite variants** — currently partial/absent in the xlsx contract. Mark as explicitly out-of-scope-for-v1 in the guides rather than implying support.

---

## Suggested process
1. Read [[admin-uiux-revise-epic]] for the import pattern context. Open `src/content/excelImport.ts`, `surfaceImport.ts`, `mergeById.ts`, `ImportDrawer.tsx`, `validate.ts`, `data/types.ts`, `content/model.ts` — confirm the ground-truth tables above against current code (cheap, do it).
2. Resolve Open Decisions 1 + 2 with the user (they gate everything).
3. **Stream A first** (no code risk): use `superpowers:writing-plans` only if you want structure, but these are docs — likely just write the four guide files + README directly, then have a fresh agent dry-run each by acting as the AI: paste the guide, ask it to author a small course, and check the emitted tables import cleanly through `parseWorkbookToCourse` (write a throwaway test or use the admin drawer). Iterate the guide until a cold AI produces valid content.
4. **Stream B**: `superpowers:writing-plans` → `superpowers:subagent-driven-development` (fresh subagent per task, spec + code-quality review each; final whole-feature review — that final review caught 2 real data bugs in the P5 import work, so keep it). Per-task gates: `npx vitest run <file>`, `npx tsc -b`, `npx vite build`. Then write `pets.md` and dry-run it the same way.
5. Branch off `main` (e.g. `pets-import`); promote with a `--no-ff` merge when green, like the prior lines.

## Acceptance
- A cold AI, given only a guide MD, emits content that imports without validation errors for each surface (Course/Units/Items+Lessons/Bosses, and Pets after Stream B).
- Pets import: drawer on PetsTab, additive merge, `validatePetDefs` gate intact, catalog-wide invariants (single starter, gen/dexNo uniqueness) enforced on the merged set. Full suite + `tsc -b` + `vite build` green.

## Key files (verified 2026-06-30)
- `src/content/excelImport.ts` — column contracts + `parseWorkbookSlices`/`parseWorkbookToCourse`.
- `src/content/surfaceImport.ts` — per-surface adapters (pattern to copy for `importPets`).
- `src/content/mergeById.ts` — additive merge the drawer uses.
- `src/components/admin/ui/ImportDrawer.tsx` — generic drawer (reuse for pets).
- `src/components/admin/PetsTab.tsx` — where the Pets drawer wires in; Firestore save path.
- `src/content/validate.ts` — `validateCourse` + `validatePetDefs` (the rules the guides encode).
- `src/data/types.ts` (ContentItem kinds, PetDef), `src/content/model.ts` (Unit/Lesson/CheckpointBoss), `src/content/course.ts` (Course/BossNode).
- `src/content/seed.ts` — real example Course/Units/Items/Bosses data for the worked examples.
- `src/domain/petDef.ts` — `BUILTIN_PET_DEFS`; `src/domain/petType.ts` — `isPetType`/registry; `src/firebase/content.ts` — `savePetDefs`/`fetchPetDefs`.

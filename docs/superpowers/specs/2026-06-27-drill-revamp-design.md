# Drill Revamp — Course / Multi-Type Content System

**Date:** 2026-06-27
**Repo:** `sentence-pet` (branch off `journey-redesign`)
**Supersedes:** the single slot-fill drill stage described in `sentence-pet-drill-revamp-handoff.md`.

## 1. Goal

Replace the single type-agnostic slot-fill drill with a **course-based, multi-activity learning system**. A learner picks a **course**, walks a journey of **units**, and each unit is a trail of **typed activity nodes** (flashcard, matching, drag-drop, fill-blank) ending in a **checkpoint boss**. Bigger **gated bosses** review 2–3 units and gate progression; a **final boss** ends the course. Content can carry **Thai (L1) helpers** that the learner toggles TH/ENG, gated by an admin feature flag. Admins author everything in the admin tool, including **bulk Excel import**.

## 2. Hierarchy

```
Course (player picks first)
 └─ Units (ordered)
     └─ Lesson nodes — kind ∈ {flashcard, matching, dragdrop, fillblank}
     └─ Checkpoint boss (per unit, last node)            ← boss tier "checkpoint"
 └─ Gated bosses — placed after a unit, review the 2–3 units before it   ← tier "gated"
 └─ Final boss — reviews the whole course; clearing it completes course  ← tier "final"
 └─ Pool — Record<id, ContentItem>, shared across the whole course
```

- **Structure choice:** journey-nodes-per-type (each content type is its own trail node), chosen over a forced linear sequence or a shuffled item stream. Closest to today's `JourneyMap`/`journeyProgress`.
- **Pool scope:** per-course. Items reused freely across units within the course; no cross-course leakage.
- **Course-select** is a new first screen before the journey map.

## 3. Data model

### 3.1 Items — discriminated union by `kind`

```ts
type ContentKind = 'flashcard' | 'matching' | 'dragdrop' | 'fillblank';

interface L1Helper { th: string; }            // Thai bridge text

interface BaseItem {
  id: string;
  kind: ContentKind;
  level: number;
  l1?: L1Helper;                              // present only if this item has a Thai helper
}

// ① Flashcard — front/back recall, audio, self-grade
interface FlashcardItem extends BaseItem {
  kind: 'flashcard';
  front: string;
  back: string;
  audio?: string;
  // speaking?: SpeakingCheck;   // RESERVED — pronunciation check, built later
}

// ② Matching — drag each prompt tile into its target slot
interface MatchingPair { left: string; right: string; l1?: L1Helper; leftImage?: string; rightImage?: string; } // images RESERVED
interface MatchingItem extends BaseItem {
  kind: 'matching';
  pairs: MatchingPair[];                      // ≥2; left = prompt (L2), right = answer slot
}

// ③ Drag-drop — today's slot-fill engine, kept intact
interface DragDropItem extends BaseItem {
  kind: 'dragdrop';
  drill: 'pattern' | 'wordChoice' | 'grammar' | 'mixed';  // existing variants kept
  slots: PosLabel[];
  answer: string[];
  distractors?: string[];
  traps?: GrammarTrap[];
  hidePos?: boolean;                          // admin difficulty: hide POS label/tint in slots
}

// ④ Fill-blank — typed, strict
interface FillBlankItem extends BaseItem {
  kind: 'fillblank';
  template: string;                          // exactly one "___" marks the blank
  answer: string;                            // strict exact match (trimmed)
  alternates?: string[];                     // optional extra accepted answers, default none
  // hints escalate engine-side: L1 → first letter → length dots → reveal
}

type ContentItem = FlashcardItem | MatchingItem | DragDropItem | FillBlankItem;
```

### 3.2 Units, lessons, bosses

```ts
type BossScope = 'checkpoint' | 'gated' | 'final';

interface Lesson {                            // a trail node
  id; title?;
  kind: ContentKind;                          // which screen renders + which pool items are valid
  level: number;
  itemIds: string[];                          // admin assigns N items of this kind ("count per type")
}

interface Unit {
  id; title; emoji; order;
  l1Enabled: boolean;                         // ADMIN backend flag — gates the TH/ENG toggle for players
  lessons: Lesson[];                          // typed nodes
  checkpoint: BossNode;                       // per-unit boss, tier 'checkpoint'
}

interface BossNode {
  id; title;
  scope: BossScope;
  afterUnitId?: string;                       // gated: which unit this gate sits after (placement on the trail)
  reviewsUnitIds?: string[];                  // gated/final: units sourced for review (checkpoint = own unit)
  reviewCount?: number;                       // gated/final: how many review items
  pinnedItemIds?: string[];                   // gated/final: admin-pinned items, rest sampled
  boss: BossConfig;                           // reuse existing boss-battle feature config
  onClear?: 'completeCourse';                 // final only
}

interface Course {
  id; title; emoji?;
  l1Ready?: boolean;                          // course-level L1 availability hint
  pool: Record<string, ContentItem>;          // shared across the whole course
  units: Unit[];                              // ordered
  gates: BossNode[];                          // scope 'gated', placed via afterUnitId
  finalBoss: BossNode;                        // scope 'final', onClear: 'completeCourse'
}
```

Boss content for `gated`/`final` is **not authored fresh** — it is **sampled** (`reviewCount`) from `reviewsUnitIds`' nodes' `itemIds`, with `pinnedItemIds` always included.

## 4. Bilingual TH/ENG (L1)

- **Gate:** `unit.l1Enabled` is an admin backend flag. Off → player never sees a TH/ENG toggle for that unit.
- **Toggle UI:** appears in the unit header (sets the unit default) AND inside each content screen (per-screen override). Lives in the UI store, persisted per user.
- **Display rule (everywhere):** show Thai iff `unit.l1Enabled && toggle === 'TH' && item.l1` (or `pair.l1`) is present. Matching uses **per-pair** L1.
- TH text is display-only — never affects grading (consistent with today's display-only TTS).

## 5. Player screens

| Kind | Interaction | Grade | L1 surface |
|------|-------------|-------|------------|
| flashcard | flip front→back, 🔊 audio, self-grade Again/Got-it | self-report (no slip on Again? see §7) | helper line on card |
| matching | drag prompt tiles into target slots | all pairs correct | per-pair Thai on prompt |
| dragdrop | existing slots+tray (`DrillScreen`) | existing exact in-order grader | existing `thaiHint`-style l1 |
| fillblank | type into blank | strict exact (trimmed) + alternates | helper line; hints escalate |
| boss | existing boss-battle flow | existing | inherited from sampled items |

New screens are **separate components** routed by `kind` (not a single mega-screen), because the interactions genuinely differ. Drag-drop reuses `DrillScreen` unchanged apart from `hidePos`.

## 6. Admin

- **Course manager** — create/edit/delete courses; set `l1Ready`; manage units, gates, final boss.
- **Excel bulk import** — upload an `.xlsx` to create/populate a course in bulk (see §8).
- **Item editor** — one `kind` dropdown switches the form; every kind shows an optional L1.th block. Flashcard/matching/fillblank get real forms (handoff limit #5); dragdrop keeps existing fields + `hidePos` checkbox; traps stay JSON for now.
- **Journey tab** — per node assign `kind` + `level` + item-count (pick item ids); configure checkpoint, gated, final bosses (span, reviewCount, pinned ids).

## 7. Grading, scoring, rewards

- **Fill-blank:** strict trimmed exact match against `answer` ∪ `alternates`. Wrong → escalating hint, no auto-advance.
- **Matching:** correct when every prompt is in its right slot; wrong pairs clear, keep correct (mirror drag-drop selective clear).
- **Flashcard:** self-graded. Open question for plan: does "Again" count as a slip for stars, or is flashcard ungraded practice that always awards completion? **Decision: flashcard is practice — completion-based, no slip penalty.**
- **Stars / food / XP:** extend `DRILL_FOOD` and `scoring.ts` to map the 4 kinds + 3 boss tiers (handoff limits #6, #7). Each kind gets a food group; bosses reuse boss rewards.
- **Course completion:** clearing the final boss sets a per-player `courseComplete[courseId]` and unlocks the next course.

## 8. Excel import format

One workbook, multiple sheets:

- **`Course`** — one row: id, title, emoji, l1Ready.
- **`Units`** — id, title, emoji, order, l1Enabled.
- **`Items`** — id, kind, level, unit, node(kind/level group), l1_th, and kind-specific columns:
  - flashcard: front, back, audio
  - matching: pairs as `left|right|th` cells across columns (pair1, pair2, …)
  - dragdrop: variant, slots(CSV), answer(CSV), distractors(CSV), hidePos
  - fillblank: template, answer, alternates(CSV)
- **`Bosses`** — id, scope, afterUnit/reviewsUnits(CSV), reviewCount, pinnedItemIds(CSV).

Parser (library: `xlsx`/SheetJS) → builds a `Course` object → runs the same `validateContent` → writes via the content API. Import is **preview-then-commit** (show parsed result + validation errors before saving). Malformed rows reported with sheet+row location; nothing saved on any error.

## 9. Persistence & migration

- **New layout:** `content/courses/{courseId}` document per course (`{ course: Course }`), plus an index `content/coursesIndex` listing course ids/titles for the course-select screen.
- **Old layout:** two flat docs `content/pool` + `content/journey` — migrated into a single default course doc.
- `src/content/seed.ts` regenerated from the new structure (still generated, not hand-edited).
- `validate.ts` becomes **kind-aware**: per-kind field checks (flashcard front/back, matching ≥2 full pairs, dragdrop `answer.length===slots.length`, fillblank exactly one `___` + non-empty answer, l1.th non-empty when present) on top of structural rules (one checkpoint last per unit, gate `reviewsUnitIds` valid, final boss present, all itemIds exist in course pool).
- **Player load:** course-select reads the index; entering a course hydrates that course doc, cache-first with seed fallback (keep "never blank on error").

## 10. Phasing

Built phase-by-phase per the user's subagent-per-task / handoff-per-phase workflow. Each phase ships working software.

- **P1 — Foundation:** new types (`ContentItem` union, `Course`, kind-aware `Lesson`/`Unit`/`BossNode`); persistence restructure to `content/courses/*`; migration of existing content into a default course; course-select screen; `kind`-routed player shell that still only renders **dragdrop** (parity with today) + per-unit checkpoint. Kind-aware `validate.ts`. Green tests + build.
- **P2 — New activity types:** flashcard, matching, fill-blank player screens + their grading/hints + food/scoring/XP mapping + L1 toggle (unit header + per-screen) honoring `l1Enabled`. Admin item editor switches by kind; journey tab assigns typed nodes.
- **P3 — Boss tiers + bulk import:** gated boss (multi-unit review, sampling + pinned) and final boss (course completion + next-course unlock), wired to the existing boss-battle feature; admin boss config forms; Excel bulk import (preview-then-commit).
- **Reserved (later):** flashcard speaking/pronunciation check; matching images.

## 11. Carried landmines (from handoff)

- Stage **explicit files only**, never `git add -A`. Leave `firebase.json` modified-but-unstaged.
- `src/content/seed.ts` is generated — regenerate via admin export, don't hand-edit.
- Boss battle is an existing feature — reuse its config/flow, don't rebuild.
- `.superpowers/` brainstorm dir must be gitignored.

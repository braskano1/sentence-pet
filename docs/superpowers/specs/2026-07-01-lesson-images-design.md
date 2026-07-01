# Lesson Images — Design (P1 thin slice)

**Date:** 2026-07-01
**Status:** Approved design, ready for implementation plan (P1)
**Register:** product (children's ESL game; see PRODUCT.md)

## Goal

Add pictures to the **Flashcard** and **Matching** lessons so meaning is carried visually, not only by English text. The target learner is Pre-A1 (Thai students ~15–16, low English literacy, mobile-first); every per-lesson critique flagged "show, don't tell" as the recurring gap. Images directly serve that principle.

Source of images: **Firebase Storage** (reuse the dex pet-sprite pipeline). Render mode is **author-chosen per item**: text (today) / image / image + word caption.

This document specs **P1 only** — a thin vertical slice that ships working software (data + display + URL-paste authoring + graceful fallback). The heavier Storage **upload UI** (P2) and **xlsx import** (P3) are separate future specs, outlined at the end.

## Non-goals (P1)

- No Storage **upload** UI, `storage.rules` changes, image transcode, or CORS work (that is P2).
- No xlsx **import** columns / template changes (that is P3).
- No images for Drill or FillBlank (out of chosen scope).
- No change to grading, scoring, the rolling-window, flip-gate, success/error beats, or any lesson logic. Images are **display-only**.

## Data model

`src/data/types.ts`:

- `FlashcardItem` — add:
  - `image?: string` — Storage (or any) URL. Shown on the **back** face only.
  - `imageCaption?: boolean` — default `true` → show the `back` word beneath the image; `false` → image only.
- `MatchingPair` — un-reserve the existing fields and add caption flags:
  - `leftImage?: string` (already present, RESERVED → active)
  - `rightImage?: string` (already present, RESERVED → active)
  - `leftImageCaption?: boolean` — default `true`
  - `rightImageCaption?: boolean` — default `true`

All fields optional → existing content is unchanged and valid. Render mode is derived:

| Data state | Render |
|---|---|
| no image field | text (today's behavior) |
| image set, caption `true`/unset | image + word caption |
| image set, caption `false` | image only |

The text strings remain the source of truth: `flashcard.back`, `pair.left`, `pair.right` are still the words used for meaning and (for matching) the grading ids. Images never replace those values in logic — only in presentation.

## Display behavior

### Flashcard (`src/components/FlashcardScreen.tsx`)

- **Front, flip-gate, `tap to flip`, 🔊 (speaks `front`), Again/Got-it gating** — all unchanged.
- **Back face** (the reveal): if `item.image` is set, render `<img>` (e.g. `h-32 w-full object-contain`) with `alt={item.back}`; if `imageCaption !== false`, render the `back` word beneath it. If no image, render the `back` text exactly as today.
- The L1 Thai line below remains unchanged.
- **Fallback:** the `<img>` has an `onError` that swaps to rendering the `back` text, so a broken/missing URL never yields a blank card.

### Matching (`src/components/MatchingScreen.tsx`)

- **Rolling window (≤3), drag, wrong-flash, success beat, grading** — all unchanged. Grading keys on `pair.left`/`pair.right` strings regardless of what is displayed.
- **`PromptTile`** (left): if the pair's `leftImage` is set, render `<img alt={left}>` inside the tile, plus the `left` word caption when `leftImageCaption !== false`; else the `left` text (today).
- **`TargetSlot`** (right): same rule with `rightImage` / `rightImageCaption` / `right`. The slot keeps its label + `filledBy` + error styling; the image sits with the label.
- **`DragOverlay`**: when dragging a left tile that has `leftImage`, the floating overlay shows the image too (consistency with the lifted tile).
- **Fallback:** each `<img>` `onError` → text for that side.

### Sizing / mobile

Images must fit the existing `max-w-md` mobile layout and the small matching tiles. Use `object-contain` with a bounded height; reuse the codebase's existing image-display conventions where one exists (e.g. the pet sprite component's `onError` fallback pattern) rather than inventing new styling.

### Accessibility

- Every lesson `<img>` carries `alt = the word` (`back` / `left` / `right`). Screen-reader users (the Sam persona) still receive the meaning, and `alt` doubles as the visible fallback text on error.
- Image-only mode still has the word in `alt`, so it is never silent to assistive tech.

## Authoring (P1)

Admin lesson editors for Flashcard and Matching gain, per item / per pair-side:

- an **"Image URL"** text input (paste a Storage or any URL), and
- a **"Show caption"** checkbox (default checked).

No file upload in P1 — the author pastes a URL (mirrors the dex URL-paste step that preceded the full Storage uploader). Find the existing admin editors for these item kinds and extend them following their established field patterns; do not restructure them.

### Validation (`src/content/validate.ts`)

- Images are optional. If `image`/`leftImage`/`rightImage` is present, it must be a non-empty trimmed string. No reachability or format check.
- No new required fields; existing validation unaffected.

## Testing (P1)

Component tests (vitest + @testing-library/react), following existing screen-test conventions:

- **Flashcard:** back renders `<img>` with correct `src`/`alt` when `image` set; caption word shown when `imageCaption !== false` and hidden when `false`; renders `back` text when no image; `onError` falls back to `back` text.
- **Matching:** left tile / right slot render `<img>` + optional caption per the `*Image`/`*ImageCaption` fields; text when no image; drag overlay shows the image; `onError` → text. **A grading test confirms a correct/wrong match is unaffected when images are present** (image is display-only).
- **a11y:** `alt` equals the underlying word in each case.
- **Regression:** `npx tsc -b` → 0; `npx vitest run` → full suite green (current baseline 1256 passed | 18 skipped; new tests add to the pass count).

## Phasing (future, separate specs)

- **P2 — Storage upload UI:** replace/augment the URL field with a file picker in both editors; reuse the dex sprite-upload pipeline (`imageTranscode` downscale, `storage.rules` with a lesson-images path, emulator `:9199`, CORS), with `onError` + orphan-cleanup parity. Own spec.
- **P3 — xlsx import:** add image columns to the Flashcard and Matching import adapters + downloadable templates + round-trip drift guard. Own spec.

## Risks / open points

- Matching tiles are small on a 360px phone; an image plus caption plus the existing drag affordance may crowd. P1 keeps images optional, so authors opt in per pair; sizing is validated visually in-app before P2.
- Storage URLs require the bucket to allow public read for the `<img>` to load in P1 (the dex bucket already serves sprites publicly). If a pasted URL needs auth, it simply fails to `onError`-fallback — acceptable for P1.

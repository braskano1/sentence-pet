# Lesson Images P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional, author-driven pictures to the Flashcard (back face) and Matching (tiles/slots) lessons, sourced from a pasted URL, with graceful text fallback — display-only, no change to grading or lesson logic.

**Architecture:** Add optional image + caption fields to `FlashcardItem` and `MatchingPair` (the latter already reserves `leftImage`/`rightImage`). Render `<img>` with an `onError` text fallback in the two screens; the underlying word strings remain the source of truth for meaning and (matching) grading. Admin `ItemEditor` gains URL text fields + caption checkboxes. No Storage upload, no import columns (those are P2/P3).

**Tech Stack:** React 19 + TypeScript, Zustand, @dnd-kit/core, Tailwind, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-01-lesson-images-design.md`

**Branch:** `lesson-images` (already created; spec committed at d04f27e). Stage explicit paths only; never `git add -A`. End every commit message with:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

**Repo note:** Use Bash with `cd /d/ai_projects/AI_design_thinking/sentence-pet` (the PowerShell tool's cwd resolves to the wrong drive). Baseline before this plan: `npx tsc -b` → 0 errors, `npx vitest run` → 1256 passed | 18 skipped.

---

## File Structure

- `src/data/types.ts` — add optional image/caption fields (Task 1).
- `src/content/validate.ts` + `src/content/validate.test.ts` — optional-image emptiness guard (Task 1).
- `src/components/FlashcardScreen.tsx` + `.test.tsx` — back-face image render (Task 2).
- `src/components/MatchingScreen.tsx` + `.test.tsx` — tile/slot/overlay image render (Task 3).
- `src/components/admin/ItemEditor.tsx` + `.test.tsx` — admin URL fields + caption checkboxes (Task 4).

---

## Task 1: Data model + validation

**Files:**
- Modify: `src/data/types.ts` (FlashcardItem ~28-34, MatchingPair ~42-48)
- Modify: `src/content/validate.ts` (flashcard case ~19-22, matching case ~23-29)
- Test: `src/content/validate.test.ts`

- [ ] **Step 1: Add the type fields**

In `src/data/types.ts`, change `FlashcardItem` to add `image` + `imageCaption`:

```ts
/** ① Flashcard — front/back recall, optional audio, self-graded practice. */
export interface FlashcardItem extends BaseContentItem {
  kind: 'flashcard';
  front: string;
  back: string;
  audio?: string;
  image?: string;          // optional picture URL, shown on the BACK face only
  imageCaption?: boolean;  // default true → show the `back` word under the image; false → image only
  // speaking?: SpeakingCheck;  // RESERVED — pronunciation check, built later
}
```

And change `MatchingPair` to un-reserve the image fields and add caption flags:

```ts
export interface MatchingPair {
  left: string;
  right: string;
  l1?: L1Helper;             // per-pair Thai
  leftImage?: string;        // optional picture URL for the left (prompt) side
  rightImage?: string;       // optional picture URL for the right (target) side
  leftImageCaption?: boolean;  // default true → show the `left` word with the image; false → image only
  rightImageCaption?: boolean; // default true → show the `right` word with the image; false → image only
}
```

- [ ] **Step 2: Write the failing validation tests**

In `src/content/validate.test.ts`, add (place near the existing flashcard/matching validation tests; reuse whatever bundle/item helper the file already uses to build a valid item, then mutate it):

```ts
describe('lesson image validation', () => {
  it('rejects a flashcard with an empty-string image', () => {
    const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล', image: '   ' } as const;
    const errors: string[] = [];
    validateItem('fc1', item as any, (m) => errors.push(m));
    expect(errors).toContain('item fc1 flashcard image is empty');
  });

  it('accepts a flashcard with a non-empty image and no image field', () => {
    const withImg = { id: 'fc2', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล', image: 'https://x/apple.png' } as const;
    const noImg = { id: 'fc3', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล' } as const;
    const e1: string[] = []; const e2: string[] = [];
    validateItem('fc2', withImg as any, (m) => e1.push(m));
    validateItem('fc3', noImg as any, (m) => e2.push(m));
    expect(e1).toEqual([]);
    expect(e2).toEqual([]);
  });

  it('rejects a matching pair with an empty-string leftImage/rightImage', () => {
    const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
      { left: 'apple', right: 'แอปเปิล', leftImage: ' ' },
      { left: 'cat', right: 'แมว', rightImage: '' },
    ] } as const;
    const errors: string[] = [];
    validateItem('m1', item as any, (m) => errors.push(m));
    expect(errors).toContain('item m1 pair 0 leftImage is empty');
    expect(errors).toContain('item m1 pair 1 rightImage is empty');
  });
});
```

NOTE: `validateItem` is not currently exported. In Step 4 you will export it; if the existing test file already tests through a higher-level `validateBundle`/`validateContent` entry point instead, adapt these tests to that entry point (build a minimal valid bundle and assert the same error strings) rather than exporting `validateItem`. Check the test file first and follow its existing seam.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/validate.test.ts`
Expected: the three new tests FAIL (no "image is empty" errors produced yet).

- [ ] **Step 4: Implement the validation**

In `src/content/validate.ts`, extend the `flashcard` case:

```ts
    case 'flashcard':
      if (item.front.trim() === '') push(`item ${itemId} flashcard front is empty`);
      if (item.back.trim() === '') push(`item ${itemId} flashcard back is empty`);
      if (item.image !== undefined && item.image.trim() === '') push(`item ${itemId} flashcard image is empty`);
      break;
```

and the `matching` case's per-pair loop:

```ts
    case 'matching':
      if (item.pairs.length < 2) push(`item ${itemId} matching needs >= 2 pairs`);
      item.pairs.forEach((p, i) => {
        if (p.left.trim() === '' || p.right.trim() === '') push(`item ${itemId} pair ${i} incomplete`);
        if (p.l1 && p.l1.th.trim() === '') push(`item ${itemId} pair ${i} l1.th is empty`);
        if (p.leftImage !== undefined && p.leftImage.trim() === '') push(`item ${itemId} pair ${i} leftImage is empty`);
        if (p.rightImage !== undefined && p.rightImage.trim() === '') push(`item ${itemId} pair ${i} rightImage is empty`);
      });
      break;
```

If the tests in Step 2 call `validateItem` directly and it is not exported, add `export` to its declaration (`export function validateItem(...)`). If they go through a higher-level entry point, no export change is needed.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/validate.test.ts && npx tsc -b`
Expected: all validate tests PASS; tsc → 0 errors.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/data/types.ts src/content/validate.ts src/content/validate.test.ts
git commit -m "feat(lesson-images): optional image+caption fields on flashcard & matching pair

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Flashcard back-face image

**Files:**
- Modify: `src/components/FlashcardScreen.tsx` (the card button child ~73; add a `CardBack` helper component at file end)
- Test: `src/components/FlashcardScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/FlashcardScreen.test.tsx`, add (reuse the file's existing render setup / store mock — new tests in the same file inherit it). The card flips on clicking the `flip card` button:

```ts
it('shows the back image with caption after flipping', () => {
  const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล', image: 'https://x/apple.png' } as const;
  render(<FlashcardScreen items={[item as any]} unit={{ l1Enabled: false }} />);
  fireEvent.click(screen.getByLabelText('flip card'));
  const img = screen.getByRole('img');
  expect(img).toHaveAttribute('src', 'https://x/apple.png');
  expect(img).toHaveAttribute('alt', 'แอปเปิล');
  expect(screen.getByText('แอปเปิล')).toBeInTheDocument(); // caption shown by default
});

it('shows image only (no caption word) when imageCaption is false', () => {
  const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล', image: 'https://x/apple.png', imageCaption: false } as const;
  render(<FlashcardScreen items={[item as any]} unit={{ l1Enabled: false }} />);
  fireEvent.click(screen.getByLabelText('flip card'));
  expect(screen.getByRole('img')).toBeInTheDocument();
  expect(screen.queryByText('แอปเปิล')).toBeNull();
});

it('shows the back text when there is no image (unchanged behavior)', () => {
  const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล' } as const;
  render(<FlashcardScreen items={[item as any]} unit={{ l1Enabled: false }} />);
  fireEvent.click(screen.getByLabelText('flip card'));
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('แอปเปิล')).toBeInTheDocument();
});

it('falls back to the back text when the image fails to load', () => {
  const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล', image: 'https://x/broken.png' } as const;
  render(<FlashcardScreen items={[item as any]} unit={{ l1Enabled: false }} />);
  fireEvent.click(screen.getByLabelText('flip card'));
  fireEvent.error(screen.getByRole('img'));
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('แอปเปิล')).toBeInTheDocument();
});
```

Ensure `fireEvent` is imported in the file (it almost certainly already is for the flip tests).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/FlashcardScreen.test.tsx`
Expected: the 4 new tests FAIL (no `img` rendered).

- [ ] **Step 3: Implement the back-face render**

In `src/components/FlashcardScreen.tsx`, add `useState` is already imported. Add a `CardBack` helper at the END of the file:

```tsx
/** Back face: picture (with optional word caption) when an image is set, else the back word.
    Falls back to the back word if the image fails to load. */
function CardBack({ item }: { item: FlashcardItem }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (item.image && !imgFailed) {
    return (
      <span className="flex flex-col items-center gap-2">
        <img
          src={item.image}
          alt={item.back}
          className="h-32 w-full object-contain"
          onError={() => setImgFailed(true)}
        />
        {item.imageCaption !== false && <span>{item.back}</span>}
      </span>
    );
  }
  return <>{item.back}</>;
}
```

Then change the card button child (currently `{flipped ? item.back : item.front}`) to:

```tsx
        {flipped ? <CardBack item={item} /> : item.front}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/FlashcardScreen.test.tsx && npx tsc -b`
Expected: all FlashcardScreen tests PASS; tsc → 0.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/FlashcardScreen.tsx src/components/FlashcardScreen.test.tsx
git commit -m "feat(lesson-images): render picture on flashcard back with text fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Matching tile / slot / drag-overlay images

**Files:**
- Modify: `src/components/MatchingScreen.tsx` (call sites ~137-160; `PromptTile` ~167-182; `TargetSlot` ~184-204)
- Test: `src/components/MatchingScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/MatchingScreen.test.tsx`, add (reuse the file's existing render + the `@dnd-kit/core` transport mock / `drop` helper already in the file):

```ts
it('renders an image on a prompt tile and a target slot when set, with alt = word', () => {
  const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
    { left: 'apple', right: 'A', leftImage: 'https://x/apple.png' },
    { left: 'ball', right: 'B', rightImage: 'https://x/b.png' },
  ] } as const;
  render(<MatchingScreen items={[item as any]} unit={{ l1Enabled: false }} />);
  const imgs = screen.getAllByRole('img');
  const srcs = imgs.map((i) => i.getAttribute('src'));
  expect(srcs).toContain('https://x/apple.png');
  expect(srcs).toContain('https://x/b.png');
  expect(screen.getByAltText('apple')).toBeInTheDocument();
});

it('hides the caption word on a side when its caption flag is false', () => {
  const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
    { left: 'apple', right: 'A', leftImage: 'https://x/apple.png', leftImageCaption: false },
    { left: 'ball', right: 'B' },
  ] } as const;
  render(<MatchingScreen items={[item as any]} unit={{ l1Enabled: false }} />);
  // 'apple' image present but the word 'apple' not shown as a caption
  expect(screen.getByAltText('apple')).toBeInTheDocument();
  expect(screen.queryByText('apple')).toBeNull();
});

it('falls back to text on a tile when its image fails to load', () => {
  const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
    { left: 'apple', right: 'A', leftImage: 'https://x/broken.png', leftImageCaption: false },
    { left: 'ball', right: 'B' },
  ] } as const;
  render(<MatchingScreen items={[item as any]} unit={{ l1Enabled: false }} />);
  fireEvent.error(screen.getByAltText('apple'));
  expect(screen.queryByAltText('apple')).toBeNull();
  expect(screen.getByText('apple')).toBeInTheDocument(); // text fallback
});

it('still grades correctly when images are present (display-only)', () => {
  const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
    { left: 'apple', right: 'A', leftImage: 'https://x/apple.png' },
    { left: 'ball', right: 'B' },
  ] } as const;
  render(<MatchingScreen items={[item as any]} unit={{ l1Enabled: false }} />);
  // drop apple→A (correct): the pair leaves the board; no "Try again"
  drop('apple', 'A');
  expect(screen.queryByText('Try again')).toBeNull();
});
```

Use the file's existing `drop(activeId, overId)` helper (added in the rolling-window task). Ensure `fireEvent` is imported.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/MatchingScreen.test.tsx`
Expected: the image tests FAIL (no `img` rendered).

- [ ] **Step 3: Implement image rendering**

In `src/components/MatchingScreen.tsx`, first import `useState` (the file already imports `useEffect, useRef, useState` — confirm `useState` is present).

Replace `PromptTile` with:

```tsx
function PromptTile({ id, label, sub, image, caption }: {
  id: string; label: string; sub: string | null; image?: string; caption?: boolean;
}) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id });
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!image && !imgFailed;
  const showLabel = !showImage || caption !== false;
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className="rounded-xl border-2 border-slate-300 bg-white px-4 py-3 font-bold"
    >
      {showImage && (
        <img src={image} alt={label} className="mx-auto h-16 w-16 object-contain" onError={() => setImgFailed(true)} />
      )}
      {showLabel && label}
      {sub && <span className="block text-xs text-slate-500">{sub}</span>}
    </button>
  );
}
```

Replace `TargetSlot` with:

```tsx
function TargetSlot({ id, label, filledBy, error, image, caption }: {
  id: string; label: string; filledBy?: string; error?: boolean; image?: string; caption?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!image && !imgFailed;
  const showLabel = !showImage || caption !== false;
  return (
    <div
      ref={setNodeRef}
      data-testid={`target-${id}`}
      className={`min-h-12 rounded-xl border-2 px-4 py-3 ${
        error
          ? 'shake-wrong border-rose-400 bg-rose-50'
          : isOver
            ? 'border-emerald-500 bg-emerald-50'
            : filledBy
              ? 'border-emerald-400 bg-emerald-100'
              : 'border-dashed border-slate-300 bg-white'
      }`}
    >
      {showImage && (
        <img src={image} alt={label} className="mx-auto h-16 w-16 object-contain" onError={() => setImgFailed(true)} />
      )}
      {showLabel && <span className="block text-xs font-semibold text-slate-600">{label}</span>}
      {filledBy && <span className="font-bold">{filledBy}</span>}
    </div>
  );
}
```

Update the two call sites in the render to pass the new props:

```tsx
          <div className="flex flex-col gap-2">
            {activePairs.map((p) => {
              const th = showL1(unit, l1Mode, p.l1);
              return <PromptTile key={p.left} id={p.left} label={p.left} sub={th} image={p.leftImage} caption={p.leftImageCaption} />;
            })}
          </div>
          <div className="flex flex-col gap-2">
            {activePairs.map((p) => (
              <TargetSlot
                key={p.right}
                id={p.right}
                label={p.right}
                filledBy={Object.entries(assignment).find(([, r]) => r === p.right)?.[0]}
                error={errorRight === p.right}
                image={p.rightImage}
                caption={p.rightImageCaption}
              />
            ))}
          </div>
```

And update the `DragOverlay` to show the dragged pair's image when present:

```tsx
        <DragOverlay>
          {activeLeft ? (
            <div className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 text-lg font-semibold text-white shadow">
              {(() => {
                const ap = item.pairs.find((p) => p.left === activeLeft);
                return ap?.leftImage
                  ? <img src={ap.leftImage} alt={activeLeft} className="h-12 w-12 object-contain" />
                  : activeLeft;
              })()}
            </div>
          ) : null}
        </DragOverlay>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/MatchingScreen.test.tsx && npx tsc -b`
Expected: all MatchingScreen tests PASS (14 prior + 4 new = 18); tsc → 0.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/MatchingScreen.tsx src/components/MatchingScreen.test.tsx
git commit -m "feat(lesson-images): render images on matching tiles, slots, drag overlay

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Admin ItemEditor image fields

**Files:**
- Modify: `src/components/admin/ItemEditor.tsx` (`FlashcardForm` ~64-77, `MatchingForm` ~79-105)
- Test: `src/components/admin/ItemEditor.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/admin/ItemEditor.test.tsx`, add (reuse the file's existing render helper / `onChange` spy pattern):

```ts
it('edits a flashcard image URL and caption flag', () => {
  const onChange = vi.fn();
  const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล' } as const;
  render(<ItemEditor item={item as any} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('image (url)'), { target: { value: 'https://x/apple.png' } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ image: 'https://x/apple.png' }));

  onChange.mockClear();
  // unchecking caption stores false
  fireEvent.click(screen.getByLabelText('image caption'));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ imageCaption: false }));
});

it('edits a matching pair leftImage URL', () => {
  const onChange = vi.fn();
  const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
    { left: 'apple', right: 'A' }, { left: 'ball', right: 'B' },
  ] } as const;
  render(<ItemEditor item={item as any} onChange={onChange} />);
  fireEvent.change(screen.getAllByLabelText('left image (url)')[0], { target: { value: 'https://x/apple.png' } });
  const arg = onChange.mock.calls.at(-1)![0];
  expect(arg.pairs[0].leftImage).toBe('https://x/apple.png');
});
```

Confirm `Field` renders a label associated with its control such that `getByLabelText('image (url)')` resolves — the existing tests already query fields by their `label` text (e.g. `getByLabelText('front')`), so follow that exact pattern. If the existing tests use a different query (e.g. by placeholder or role), match it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ItemEditor.test.tsx`
Expected: the 2 new tests FAIL (fields don't exist).

- [ ] **Step 3: Implement the admin fields**

In `src/components/admin/ItemEditor.tsx`, extend `FlashcardForm`'s returned fragment (after the `audio` Field, before `L1Input`):

```tsx
      <Field label="image (url)">
        <TextInput value={item.image ?? ''}
          onChange={(e) => set({ image: e.target.value.trim() ? e.target.value : undefined })} />
      </Field>
      <Checkbox label="image caption" checked={item.imageCaption !== false}
        onChange={(e) => set({ imageCaption: e.target.checked ? undefined : false })} />
```

In `MatchingForm`, replace the per-pair row with a two-line layout that adds the image fields (keep the existing left/right/th/remove line, add an image line):

```tsx
        {item.pairs.map((p, i) => (
          <div key={i} className="flex flex-col gap-1 border-b border-slate-200 pb-2">
            <div className="flex items-end gap-2">
              <Field label="left"><TextInput value={p.left} onChange={(e) => setPair(i, { left: e.target.value })} /></Field>
              <Field label="right"><TextInput value={p.right} onChange={(e) => setPair(i, { right: e.target.value })} /></Field>
              <Field label="th">
                <TextInput value={p.l1?.th ?? ''}
                  onChange={(e) => setPair(i, { l1: e.target.value.trim() ? { th: e.target.value } : undefined })} />
              </Field>
              <Button variant="danger" aria-label={`remove pair ${i + 1}`}
                onClick={() => setPairs(item.pairs.filter((_, idx) => idx !== i))}>×</Button>
            </div>
            <div className="flex items-end gap-2">
              <Field label="left image (url)">
                <TextInput value={p.leftImage ?? ''}
                  onChange={(e) => setPair(i, { leftImage: e.target.value.trim() ? e.target.value : undefined })} />
              </Field>
              <Checkbox label="left cap" checked={p.leftImageCaption !== false}
                onChange={(e) => setPair(i, { leftImageCaption: e.target.checked ? undefined : false })} />
              <Field label="right image (url)">
                <TextInput value={p.rightImage ?? ''}
                  onChange={(e) => setPair(i, { rightImage: e.target.value.trim() ? e.target.value : undefined })} />
              </Field>
              <Checkbox label="right cap" checked={p.rightImageCaption !== false}
                onChange={(e) => setPair(i, { rightImageCaption: e.target.checked ? undefined : false })} />
            </div>
          </div>
        ))}
```

(`Checkbox` is already imported in this file.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ItemEditor.test.tsx && npx tsc -b`
Expected: all ItemEditor tests PASS; tsc → 0.

- [ ] **Step 5: Full suite + commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
npx vitest run          # expect full suite green (1256 + new tests)
git add src/components/admin/ItemEditor.tsx src/components/admin/ItemEditor.test.tsx
git commit -m "feat(lesson-images): admin image URL + caption fields for flashcard & matching

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done criteria

- `npx tsc -b` → 0 errors.
- `npx vitest run` → full suite green (1256 baseline + ~13 new tests).
- Flashcard back shows a picture (with optional caption) when authored; falls back to text on error.
- Matching tiles/slots/overlay show pictures when authored; grading unchanged; falls back to text on error.
- Admin can paste image URLs + toggle captions for both lesson types.
- No Storage upload, no import columns (P2/P3, separate specs).
```

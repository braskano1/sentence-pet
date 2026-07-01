import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// A 1×1 red PNG, written on demand so the spec is self-contained (dist-smoke/ is
// gitignored, so we can't rely on a committed fixture file).
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// Lesson-images manual smoke, automated. Opt-in (NOT part of default e2e).
// P2: drive the REAL admin LessonImageUpload → Firebase Storage emulator → preview.
// P1: after `node scripts/dev-demo-images.mjs`, render the ABC flashcard/matching
//     lesson and confirm the seeded images paint on the card back / target slots.
//
// To run (emulators up, courses+admin auto-seeded, demo images seeded for P1):
//   node scripts/dev-demo-images.mjs
//   RUN_LESSON_IMG_SMOKE=1 npx playwright test e2e/lesson-images-smoke.spec.ts
// Screenshots land in dist-smoke/ (gitignored).

const ADMIN_EMAIL = 'admin@test.dev';
const ADMIN_PASSWORD = 'test1234';
const OUT = 'dist-smoke';
const FIXTURE = `${OUT}/upload-fixture.png`;

async function signInAdmin(page: Page) {
  await page.goto('/#admin');
  await page.getByLabel(/^email$/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByText(/admin ✓/)).toBeVisible({ timeout: 20_000 });
}

test('P2: LessonImageUpload uploads to Storage emulator and previews', async ({ page }) => {
  test.skip(!process.env.RUN_LESSON_IMG_SMOKE, 'opt-in: needs emulators + seeded admin; see header');
  test.setTimeout(120_000);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(FIXTURE, PNG_1PX);

  await signInAdmin(page);
  await page.getByRole('tab', { name: /Items/ }).click();

  // The default "Beginner Course" has no flashcards — switch to the ABC course,
  // which has flashcard c0u1-fc-1 (single-image LessonImageUpload).
  await page.getByRole('button', { name: /select course/i }).click();
  await page.getByText('ABC & First Words').click();

  // Find the flashcard item by id and load it into the editor.
  await page.getByPlaceholder(/search items/i).fill('c0u1-fc-1');
  await page.getByRole('button').filter({ hasText: 'c0u1-fc-1' }).first().click();

  // The flashcard editor renders <LessonImageUpload label="upload image">.
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ timeout: 10_000 });
  await fileInput.setInputFiles(FIXTURE);

  // On success ImageUpload swaps the preview <img> src to a real Storage-emulator
  // download URL. Poll for it (the item may already carry a demo/CDN image, so
  // assert the src BECOMES a storage URL rather than merely being present).
  const preview = page.getByRole('img', { name: /upload image preview/i });
  await expect(preview).toHaveAttribute('src', /9199|googleapis|storage/i, { timeout: 30_000 });
  await page.screenshot({ path: `${OUT}/li01-p2-upload-preview.png`, fullPage: true });
});

// Shared: enter the game as guest, activate the ABC course (which carries the
// demo-seeded images), and jump straight to the lesson holding `itemId` via the
// dev-exposed game store. Returns nothing; leaves the app on the lesson screen.
async function enterAbcLessonFor(page: Page, itemId: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /tap to start/i }).click();
  await page.getByRole('button', { name: /play as guest/i }).click();
  await page.getByRole('button', { name: /skip/i }).click().catch(() => {});

  // The guest starts un-hatched → every lesson routes to EggHatch. Hatch the
  // active pet directly via the dev-exposed store so lesson screens render.
  await page.evaluate(() => {
    const w = window as unknown as { store: { getState: () => { hatch: () => void } } };
    w.store.getState().hatch();
  });
  await page.waitForFunction(() => {
    const w = window as unknown as { store: { getState: () => { pets: Array<{ hatched?: boolean }> } } };
    return w.store.getState().pets.some((p) => p.hatched);
  }, { timeout: 20_000 });

  // Activate ABC and wait for its content (with demo images) to hydrate.
  await page.evaluate(() => {
    const w = window as unknown as { store: { getState: () => { selectCourse: (id: string) => void } } };
    w.store.getState().selectCourse('pre-a1-c0-abc');
  });
  await page.waitForFunction(
    (id) => {
      const w = window as unknown as { contentStore: { getState: () => { bundle?: { pool?: Record<string, unknown> } } } };
      return !!w.contentStore.getState().bundle?.pool?.[id];
    },
    itemId,
    { timeout: 20_000 },
  );

  // Find the lesson that contains this item and start it.
  await page.evaluate((id) => {
    const w = window as unknown as {
      store: { getState: () => { startLesson: (lessonId: string) => void } };
      contentStore: { getState: () => { bundle?: { units?: Array<{ lessons: Array<{ id: string; itemIds: string[] }> }> } } };
    };
    const units = w.contentStore.getState().bundle?.units ?? [];
    for (const u of units) {
      const lesson = u.lessons.find((l) => l.itemIds.includes(id));
      if (lesson) { w.store.getState().startLesson(lesson.id); return; }
    }
    throw new Error(`no lesson holds ${id}`);
  }, itemId);
}

// FIXME: forced store-driven navigation (hatch() → selectCourse → startLesson)
// keeps the render on EggHatch for a guest whose active pet isn't the one hatch()
// touches, so the lesson screen never mounts (EggHatch then white-screens reading
// item.thaiHint on the synthetic state — a separate latent robustness bug). P1's
// image render is covered by unit tests (FlashcardScreen CardBack / MatchingScreen
// PromptTile+TargetSlot); this GUI capture needs a real hatch+journey-node walk
// helper. Left as fixme so it documents the intended check without failing runs.
test.fixme('P1: flashcard back renders the seeded image', async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(OUT, { recursive: true });
  await enterAbcLessonFor(page, 'c0u1-fc-1');
  await page.getByRole('button', { name: /flip card/i }).click();
  const apple = page.getByRole('img', { name: 'apple' });
  await expect(apple).toBeVisible({ timeout: 10_000 });
  const ok = await apple.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
  expect(ok, 'apple image decoded (naturalWidth>0)').toBe(true);
  await page.screenshot({ path: `${OUT}/li02-p1-flashcard-back.png`, fullPage: true });
});

test.fixme('P1: matching target slots render seeded images', async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(OUT, { recursive: true });
  await enterAbcLessonFor(page, 'c0u1-mt-1');
  await expect(page.getByRole('img', { name: 'apple' }).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `${OUT}/li03-p1-matching-slots.png`, fullPage: true });
});

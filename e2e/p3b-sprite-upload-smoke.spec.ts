import { test, expect, type Page } from '@playwright/test';

// P3b (generational-dex) sprite-UPLOAD manual smoke, automated. Needs the
// Storage emulator (port 9199) on top of auth + firestore.
//
// Opt-in (NOT part of the default `npm run e2e`). To run:
//   1. firebase emulators:start --only auth,firestore,storage --project demo-sentence-pet
//      (or `npm run emulators`, which now includes storage)
//   2. FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/p3b-smoke-setup.mjs
//      (reuses/creates admin@test.dev + {admin:true}; also writes xlsx fixtures, harmless)
//   3. VITE_EMULATOR_HOST=127.0.0.1 npm run dev   (emulator mode; override LAN host)
//   4. RUN_SPRITE_SMOKE=1 npx playwright test e2e/p3b-sprite-upload-smoke.spec.ts
// Screenshots land in dist-smoke/ (gitignored).
//
// One serial flow in a single context so the admin sign-in (and the persisted
// upload) survive the reload that proves the round-trip through Firestore.

const ADMIN_EMAIL = 'admin@test.dev';
const ADMIN_PASSWORD = 'test1234';
const IMG = 'src/assets/sprites/egg.webp'; // any real image on disk

async function signInAdmin(page: Page) {
  await page.getByLabel(/^email$/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByText(/admin ✓/)).toBeVisible({ timeout: 20_000 });
}

async function openLeafletInPets(page: Page) {
  await page.getByRole('button', { name: /^pets$/i }).click();
  await page.getByRole('button', { name: /edit leaflet/i }).click();
}

test('P3b sprite upload: default + variant upload, persist through reload', async ({ page }) => {
  test.skip(!process.env.RUN_SPRITE_SMOKE, 'opt-in: needs auth+firestore+storage emulators + seeded admin; see header, set RUN_SPRITE_SMOKE=1');
  test.setTimeout(120_000);

  // ── 1. Sign in as admin, open Leaflet in the Pets tab ────────────────
  await page.goto('/#admin');
  await signInAdmin(page);
  await openLeafletInPets(page);
  await page.screenshot({ path: 'dist-smoke/sprite-01-pets-leaflet.png', fullPage: true });

  // ── 2. Upload a DEFAULT sprite → preview shows a Storage download URL ──
  await page.getByLabel(/^default sprite$/i).setInputFiles(IMG);
  const defaultPreview = page.getByAltText(/^default sprite preview$/i);
  await expect(defaultPreview).toBeVisible({ timeout: 20_000 });
  // The download URL must point at the Storage object we uploaded.
  await expect.poll(async () => defaultPreview.getAttribute('src'), { timeout: 20_000 })
    .toContain('petDefs');
  await page.screenshot({ path: 'dist-smoke/sprite-02-default-uploaded.png', fullPage: true });

  // ── 3. Upload a VARIANT (baby happy) → its own preview ───────────────
  await page.getByLabel(/^baby happy sprite$/i).setInputFiles(IMG);
  const variantPreview = page.getByAltText(/^baby happy sprite preview$/i);
  await expect(variantPreview).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => variantPreview.getAttribute('src'), { timeout: 20_000 })
    .toContain('petDefs');

  // ── 4. Save → persisted to Firestore ────────────────────────────────
  // AdminShell has its own course Save; the PetsTab Save is the last one in the DOM.
  const save = page.getByRole('button', { name: /^save$/i }).last();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText(/saved ✓/)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'dist-smoke/sprite-03-saved.png', fullPage: true });

  // ── 5. Reload → re-open admin → the sprite round-tripped through Firestore ──
  await page.goto('/#admin');
  await page.reload();
  await expect(page.getByText(/admin ✓/)).toBeVisible({ timeout: 20_000 });
  await openLeafletInPets(page);
  const persisted = page.getByAltText(/^default sprite preview$/i);
  await expect(persisted).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => persisted.getAttribute('src'), { timeout: 20_000 })
    .toContain('petDefs');
  await expect(page.getByAltText(/^baby happy sprite preview$/i)).toBeVisible();
  await page.screenshot({ path: 'dist-smoke/sprite-04-persisted.png', fullPage: true });
});

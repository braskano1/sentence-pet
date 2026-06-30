import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Import-templates manual smoke, automated. Opt-in (NOT part of default e2e).
// Drives the REAL admin app: download each template, then re-import that exact
// file and confirm the drawer preview is clean (no validation errors).
//
// To run (emulators + dev server already up, admin seeded):
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/p3b-smoke-setup.mjs
//   RUN_TEMPLATES_SMOKE=1 npx playwright test e2e/templates-smoke.spec.ts
// Screenshots land in dist-smoke/ (gitignored).

const ADMIN_EMAIL = 'admin@test.dev';
const ADMIN_PASSWORD = 'test1234';
const OUT = 'dist-smoke';

async function signInAdmin(page: Page) {
  await page.goto('/#admin');
  await page.getByLabel(/^email$/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByText(/admin ✓/)).toBeVisible({ timeout: 20_000 });
}

/** Click a "Download … template" button and return the saved file path. */
async function downloadTemplate(page: Page, file: string): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download .*template/i }).click(),
  ]);
  const path = `${OUT}/${file}`;
  await download.saveAs(path);
  return path;
}

test('templates smoke: download + re-import per surface', async ({ page }) => {
  test.skip(!process.env.RUN_TEMPLATES_SMOKE, 'opt-in: needs emulators + seeded admin + dev server; see header');
  test.setTimeout(120_000);
  mkdirSync(OUT, { recursive: true });

  await signInAdmin(page);
  await page.screenshot({ path: `${OUT}/t01-admin.png`, fullPage: true });

  // ── Items (Pool) ─────────────────────────────────────────────────────
  await page.getByRole('tab', { name: /Items/ }).click();
  await page.getByRole('button', { name: /import/i }).click();
  const itemsFile = await downloadTemplate(page, 'items-template.xlsx');
  await page.getByLabel(/choose a file/i).setInputFiles(itemsFile);
  // Template has 6 items not in the SEED pool → all NEW, zero parse errors.
  await expect(page.getByText(/\bnew\b/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /apply \d+ change/i })).toBeEnabled();
  await expect(page.getByText(/required sheet|is required|unknown/i)).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/t02-items-import-preview.png`, fullPage: true });
  await page.getByRole('button', { name: /cancel/i }).click();

  // ── Pets ─────────────────────────────────────────────────────────────
  await page.getByRole('tab', { name: /Pets/ }).click();
  await page.getByRole('button', { name: /import/i }).click();
  const petsFile = await downloadTemplate(page, 'pets-template.xlsx');
  await page.getByLabel(/choose a file/i).setInputFiles(petsFile);
  // def-spark + def-blaze are new (gen 2, no collision) → 2 new, no errors.
  await expect(page.getByText(/\bnew\b/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /apply \d+ change/i })).toBeEnabled();
  await expect(page.getByText(/is required|unknown|must be/i)).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/t03-pets-import-preview.png`, fullPage: true });
  await page.getByRole('button', { name: /cancel/i }).click();

  // ── Courses: whole-course template → New from file ───────────────────
  await page.getByRole('tab', { name: /Courses/ }).click();
  const [courseDl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download course template/i }).click(),
  ]);
  const courseFile = `${OUT}/course-template.xlsx`;
  await courseDl.saveAs(courseFile);
  await page.getByLabel(/new from file/i).setInputFiles(courseFile);
  // parseWorkbookToCourse succeeds → onImport commits; no error surfaces.
  await expect(page.getByText(/could not|missing required sheet/i)).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/t04-course-import.png`, fullPage: true });
});

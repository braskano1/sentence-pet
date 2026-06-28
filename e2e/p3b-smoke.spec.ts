import { test, expect, type Page } from '@playwright/test';

// P3b manual-smoke, automated. Emulator-only (auth + firestore).
//
// Opt-in (NOT part of the default `npm run e2e` — needs emulators + a seeded
// admin). To run:
//   1. firebase emulators:start --only auth,firestore --project demo-sentence-pet
//      (or reuse already-running emulators)
//   2. FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/p3b-smoke-setup.mjs
//   3. npm run dev   (emulator mode via .env.local)
//   4. RUN_P3B_SMOKE=1 npx playwright test e2e/p3b-smoke.spec.ts
// Screenshots land in dist-smoke/ (gitignored).
//
// One serial flow in a single context so the admin sign-in survives across
// the admin -> player -> admin navigations (Playwright isolates context per test).

const ADMIN_EMAIL = 'admin@test.dev';
const ADMIN_PASSWORD = 'test1234';
const NEW_GATE_ID = 'gate-1';           // unique vs SEED_COURSE's 'gate-midcourse'
const SEED_UNIT = 'u1-basics';          // first SEED unit; new gate defaults afterUnit here

async function signInAdmin(page: Page) {
  await page.goto('/#admin');
  await page.getByLabel(/^email$/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  // AdminShell renders once auth resolves the admin claim.
  await expect(page.getByText(/admin ✓/)).toBeVisible({ timeout: 20_000 });
}

test('P3b smoke: admin authoring persists + Excel import preview/commit', async ({ page }) => {
  test.skip(!process.env.RUN_P3B_SMOKE, 'opt-in: needs emulators + seeded admin; see header, set RUN_P3B_SMOKE=1');
  test.setTimeout(120_000);

  // ── 1. Sign in as admin ──────────────────────────────────────────────
  await signInAdmin(page);
  await page.screenshot({ path: 'dist-smoke/01-admin-shell.png', fullPage: true });

  // ── 2. Bosses tab: add a uniquely-named gate, make it valid, Save ─────
  await page.getByRole('button', { name: /^bosses$/i }).click();
  await page.getByRole('button', { name: /add gate/i }).click();
  // New gate is 'gate-1'; give it a reviews unit so validateCourse passes.
  await page.getByRole('checkbox', { name: new RegExp(`gate ${NEW_GATE_ID} reviews ${SEED_UNIT}`, 'i') }).check();
  await page.screenshot({ path: 'dist-smoke/02-bosses-gate.png', fullPage: true });

  const saveBtn = page.getByRole('button', { name: /^save$/i });
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  await expect(page.getByText(/saved ✓/)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'dist-smoke/03-saved.png', fullPage: true });

  // ── 3. Player app: prove the saved gate round-tripped through Firestore ──
  // Fresh player load runs hydrateCourse('default'); the resolved bundle must
  // contain a synthetic boss unit for gate-1 (only possible if it was persisted
  // and re-fetched, since SEED fallback only has 'gate-midcourse').
  await page.goto('/');
  await page.waitForFunction(
    () => typeof (window as unknown as { contentStore?: { getState: () => unknown } }).contentStore?.getState === 'function',
    null, { timeout: 20_000 },
  );
  await page.waitForFunction(
    (gateUnitId) => {
      const cs = (window as unknown as { contentStore: { getState: () => { bundle: { units: Array<{ id: string }> } } } }).contentStore.getState();
      return cs.bundle.units.some((u) => u.id === gateUnitId);
    },
    `boss-unit:${NEW_GATE_ID}`,
    { timeout: 20_000 },
  );
  const unitIds = await page.evaluate(() => {
    const cs = (window as unknown as { contentStore: { getState: () => { bundle: { units: Array<{ id: string }> } } } }).contentStore.getState();
    return cs.bundle.units.map((u) => u.id);
  });
  expect(unitIds, 'hydrated bundle has the persisted gate-1 boss unit').toContain(`boss-unit:${NEW_GATE_ID}`);

  // ── 4. Import tab: valid workbook → preview + commit ─────────────────
  // goto('/#admin') from '/' is a same-document hash nav (no reload); force a
  // full reload so main.tsx re-evaluates the hash and mounts the admin entry.
  await page.goto('/#admin');
  await page.reload();
  await expect(page.getByText(/admin ✓/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /^import$/i }).click();
  await page.getByLabel(/excel file/i).setInputFiles('dist-smoke/valid.xlsx');
  await expect(page.getByText(/Imported Unit/)).toBeVisible({ timeout: 15_000 });
  const commit = page.getByRole('button', { name: /commit import/i });
  await expect(commit).toBeEnabled();
  await page.screenshot({ path: 'dist-smoke/04-import-preview.png', fullPage: true });
  await commit.click();
  await expect(page.getByText(/imported ✓/)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'dist-smoke/05-imported.png', fullPage: true });

  // ── 5. Import tab: invalid workbook → errors + commit blocked ─────────
  await page.getByLabel(/excel file/i).setInputFiles('dist-smoke/invalid.xlsx');
  await expect(page.getByText(/missing required sheet/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /commit import/i })).toBeDisabled();
  await page.screenshot({ path: 'dist-smoke/06-import-invalid.png', fullPage: true });
});

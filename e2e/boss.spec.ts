import { test, expect, type Page } from '@playwright/test';

// Boss-battle browser tests.
//
// Test A (hermetic): drives the REAL game store + content bundle + domain code
//   via the dev-exposed `window.store`, no auth needed. Guards the win-flow,
//   the lastReward fix (boss win must not land on a blank reward screen),
//   the first-clear egg, and the replay coin trickle.
//
// Test B (full UI): signs in via the dev panel's test account, then exercises
//   the real BossPrep -> Battle -> Reward screens. Skips gracefully if the
//   Firebase test-account sign-in can't complete in this environment.

const BOSS_LESSON = 'u1-checkpoint';

type StoreState = {
  screen: string;
  currentBossLessonId: string | null;
  coins: number;
  pets: unknown[];
  pendingStinger: string | null;
  lastReward: { coins: number; stars: number } | null;
  journey: { lessonStars: Record<string, number> };
  startBoss: (id: string) => void;
  finishBoss: (won: boolean) => void;
};

async function waitForStore(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof (window as unknown as { store?: { getState: () => unknown } }).store?.getState === 'function',
    null,
    { timeout: 30_000 },
  );
}

function readState(page: Page) {
  return page.evaluate((bossLesson) => {
    const s = (window as unknown as { store: { getState: () => StoreState } }).store.getState();
    return {
      screen: s.screen,
      currentBossLessonId: s.currentBossLessonId,
      coins: s.coins,
      petsLen: s.pets.length,
      pendingStinger: s.pendingStinger,
      lastReward: s.lastReward,
      bossStars: s.journey.lessonStars[bossLesson] ?? 0,
    };
  }, BOSS_LESSON);
}

test.describe('boss battle', () => {
  test('A: win flow drives reward + egg + replay coins (store-level, no auth)', async ({ page }) => {
    await waitForStore(page);

    // Enter the boss for the seeded checkpoint.
    await page.evaluate((id) => {
      (window as unknown as { store: { getState: () => StoreState } }).store.getState().startBoss(id);
    }, BOSS_LESSON);

    let s = await readState(page);
    expect(s.screen, 'startBoss should route to bossPrep').toBe('bossPrep');
    expect(s.currentBossLessonId).toBe(BOSS_LESSON);

    const petsBefore = s.petsLen;

    // First clear.
    await page.evaluate(() => {
      (window as unknown as { store: { getState: () => StoreState } }).store.getState().finishBoss(true);
    });

    s = await readState(page);
    expect(s.screen, 'finishBoss(win) routes to reward').toBe('reward');
    // The fix: reward screen would render blank without lastReward.
    expect(s.lastReward, 'lastReward must be populated so RewardScreen renders').not.toBeNull();
    expect(s.lastReward!.coins, 'reward shows coins earned').toBeGreaterThan(0);
    expect(s.lastReward!.stars).toBeGreaterThanOrEqual(1);
    expect(s.pendingStinger).toBe('win');
    expect(s.bossStars, 'checkpoint cleared').toBeGreaterThanOrEqual(1);
    expect(s.petsLen, 'first clear grants one egg').toBe(petsBefore + 1);

    const coinsAfterFirst = s.coins;
    const petsAfterFirst = s.petsLen;

    // Replay: no extra egg, +8 coins only.
    await page.evaluate((id) => {
      const st = (window as unknown as { store: { getState: () => StoreState } }).store.getState();
      st.startBoss(id);
      st.finishBoss(true);
    }, BOSS_LESSON);

    s = await readState(page);
    expect(s.petsLen, 'replay grants no extra egg').toBe(petsAfterFirst);
    expect(s.coins, 'replay grants the +8 coin trickle').toBe(coinsAfterFirst + 8);
  });

  test('B: BossPrep -> Battle -> Reward render (full UI via test account)', async ({ page }) => {
    await waitForStore(page);

    // Open the dev panel and sign in as the seeded test account (clears u1 lessons + hatched pets).
    await page.getByRole('button', { name: 'dev', exact: true }).click();
    await page.getByRole('button', { name: '🧪 test acct' }).click();

    // App renders only once non-anonymous. Poll startBoss until BossPrep mounts.
    const prep = page.getByText(/Recommended power/i);
    let visible = false;
    for (let i = 0; i < 20 && !visible; i++) {
      await page
        .evaluate((id) => (window as unknown as { store?: { getState: () => StoreState } }).store?.getState().startBoss(id), BOSS_LESSON)
        .catch(() => {});
      visible = await prep.isVisible().catch(() => false);
      if (!visible) await page.waitForTimeout(1000);
    }
    test.skip(!visible, 'App never rendered past auth — Firebase test-account sign-in unavailable in this environment');

    // BossPrep: recommended power + Fight.
    await expect(prep).toBeVisible();
    await page.getByRole('button', { name: /Fight/ }).click();

    // Intro cinematic -> skip by tapping.
    await page.getByText(/tap to skip/i).click().catch(() => {});

    // Battle screen: boss present.
    await expect(page.getByText('Ember Rival').first()).toBeVisible({ timeout: 10_000 });

    // Force a win through the store, then assert the reward screen actually renders
    // (this is the bug the fix addressed — it must not be blank).
    await page.evaluate(() => {
      (window as unknown as { store: { getState: () => StoreState } }).store.getState().finishBoss(true);
    });
    await expect(page.getByText(/Level cleared/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Continue/i })).toBeVisible();

    // Continue leaves the reward screen without error.
    await page.getByRole('button', { name: /Continue/i }).click();
    await expect(page.getByText(/Level cleared/i)).toBeHidden();
  });
});

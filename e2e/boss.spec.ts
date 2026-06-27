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
  // battle store fields
  charge: number;
  battlePhase: 'answering' | 'charged' | 'spell';
  begin: (pet: unknown, boss: unknown, rng?: () => number, items?: unknown[]) => void;
  tickCharge: (dtMs: number) => void;
  resolveSwipe: (success: boolean) => void;
  snapshot: { petHp: number; petHpMax: number; bossHp: number } | null;
  // P3 battle-store fields
  phaseIndex: number;
  bossPhases: number;
  spell: { words: string[]; wrongIndex: number; tip: string } | null;
  resolveSpell: (wordIndex: number) => void;
  onCorrect: () => void;
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

  test('C: charged attack fires at ring-full and a swipe dodges it (store-level)', async ({ page }) => {
    await waitForStore(page);

    // Enter the boss and seed a real battle via the prep → begin path the UI uses.
    await page.evaluate((id) => {
      (window as unknown as { store: { getState: () => StoreState } }).store.getState().startBoss(id);
    }, BOSS_LESSON);

    // Check battleStore is exposed; skip gracefully if not.
    const hasBattleStore = await page.evaluate(() =>
      typeof (window as unknown as { battleStore?: { getState: () => unknown } }).battleStore?.getState === 'function',
    ).catch(() => false);
    test.skip(!hasBattleStore, 'battleStore not exposed on window in this build');

    // Wait for contentStore to be ready before reading the bundle.
    await page.waitForFunction(
      () => typeof (window as unknown as { contentStore?: { getState: () => unknown } }).contentStore?.getState === 'function',
      null, { timeout: 10_000 },
    );

    // Establish a real battle: read the active pet from the game store and the boss
    // from the content store (both exposed in DEV), then call battleStore.begin().
    await page.evaluate((id) => {
      const gs = (window as unknown as { store: { getState: () => StoreState } }).store.getState();
      // Active (first hatched) pet — same selection logic as BossPrepScreen.
      const pet = (gs.pets as Array<{ hatched: boolean }>).find((p) => p.hatched) ?? gs.pets[0];

      // Boss from the content bundle — same lookup as BossPrepScreen.
      const cs = (window as unknown as { contentStore: { getState: () => { bundle: { units: Array<{ lessons: Array<{ id: string; boss?: unknown }> }> } } } }).contentStore.getState();
      let boss: unknown;
      for (const unit of cs.bundle.units) {
        const lesson = unit.lessons.find((l) => l.id === id);
        if (lesson?.boss) { boss = lesson.boss; break; }
      }
      if (!boss) throw new Error(`No boss found for lesson ${id}`);

      const bsStore = (window as unknown as { battleStore: { getState: () => StoreState } }).battleStore;
      const bs = bsStore.getState();
      bs.begin(pet, boss);
      if (!bsStore.getState().snapshot) throw new Error('battleStore.begin() did not initialise a snapshot — check the seeded boss tierId is valid');
    }, BOSS_LESSON);

    // Drive the battle store directly: fill the ring, assert the charged phase opens.
    // Re-read state after each mutation — Zustand set() is synchronous but the local
    // reference captured before the call is stale; always use getState() for post-mutation reads.
    const phase = await page.evaluate(() => {
      const bsRef = (window as unknown as {
        battleStore: { getState: () => StoreState };
      }).battleStore;
      bsRef.getState().tickCharge(99_999); // tick well past chargeMs to guarantee crossing into 'charged'
      return bsRef.getState().battlePhase; // fresh read after the set()
    });

    expect(phase).toBe('charged');

    // A successful swipe dodges: pet HP unchanged, phase re-arms to answering.
    const after = await page.evaluate(() => {
      const bsRef = (window as unknown as {
        battleStore: { getState: () => StoreState };
      }).battleStore;
      const before = bsRef.getState().snapshot!.petHp; // read before swipe
      bsRef.getState().resolveSwipe(true);
      const s = bsRef.getState(); // fresh read after the set()
      return { before, petHp: s.snapshot!.petHp, phase: s.battlePhase };
    });
    expect(after.petHp).toBe(after.before); // dodged → no damage
    expect(after.phase).toBe('answering');
  });

  test('D: tier-3 boss crosses a phase and opens the spot-the-error spell', async ({ page }) => {
    await waitForStore(page);

    const CP3 = 'u3-checkpoint';
    await page.evaluate((id) => {
      (window as unknown as { store: { getState: () => StoreState } }).store.getState().startBoss(id);
    }, CP3);

    const hasBattleStore = await page.evaluate(() =>
      typeof (window as unknown as { battleStore?: { getState: () => unknown } }).battleStore?.getState === 'function',
    ).catch(() => false);
    test.skip(!hasBattleStore, 'battleStore not exposed on window in this build');

    await page.waitForFunction(
      () => typeof (window as unknown as { contentStore?: { getState: () => unknown } }).contentStore?.getState === 'function',
      null, { timeout: 10_000 },
    );

    await page.evaluate((id) => {
      const gs = (window as unknown as { store: { getState: () => StoreState } }).store.getState();
      const pet = (gs.pets as Array<{ hatched: boolean }>).find((p) => p.hatched) ?? gs.pets[0];
      const cs = (window as unknown as { contentStore: { getState: () => { bundle: { pool: Record<string, unknown>; units: Array<{ lessons: Array<{ id: string; boss?: unknown; itemIds: string[] }> }> } } } }).contentStore.getState();
      let boss: unknown; let items: unknown[] = [];
      for (const unit of cs.bundle.units) {
        const lesson = unit.lessons.find((l) => l.id === id);
        if (lesson?.boss) { boss = lesson.boss; items = lesson.itemIds.map((i) => cs.bundle.pool[i]); break; }
      }
      if (!boss) throw new Error(`No boss for ${id}`);
      const bs = (window as unknown as { battleStore: { getState: () => StoreState } }).battleStore.getState();
      bs.begin(pet, boss, () => 0, items); // rng=0 → no crit, deterministic spell pick
    }, CP3);

    const crossed = await page.evaluate(() => {
      const ref = (window as unknown as { battleStore: { getState: () => StoreState } }).battleStore;
      for (let i = 0; i < 300; i++) {
        const s = ref.getState();
        if (s.phaseIndex >= 1) break;
        if (s.battlePhase === 'spell') break;
        if (s.snapshot && (s.snapshot as { bossHp: number }).bossHp === 0) break; // safety: boss died
        s.onCorrect();
      }
      const s = ref.getState();
      return { phaseIndex: s.phaseIndex, battlePhase: s.battlePhase, hasSpell: s.spell !== null };
    });
    expect(crossed.phaseIndex).toBeGreaterThanOrEqual(1);
    expect(crossed.battlePhase).toBe('spell');
    expect(crossed.hasSpell).toBe(true);

    const after = await page.evaluate(() => {
      const ref = (window as unknown as { battleStore: { getState: () => StoreState } }).battleStore;
      const wrongIndex = ref.getState().spell!.wrongIndex;
      ref.getState().resolveSpell(wrongIndex);
      const s = ref.getState();
      return { battlePhase: s.battlePhase, spell: s.spell };
    });
    expect(after.battlePhase).toBe('answering');
    expect(after.spell).toBeNull();
  });
});

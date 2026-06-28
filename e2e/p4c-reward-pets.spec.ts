import { test, expect, type Page } from '@playwright/test';

// P4c reward-pet grant browser tests (hermetic, no auth / no emulators).
//
// Proves the P4c seam end-to-end: a boss whose `rewardPetDefId` points at a
// specific authored PetDef grants exactly that pet on first clear, the hatch
// cinematic is queued (lastHatch), and the pet is recorded caught in the dex.
//
// Drives the REAL game store via the dev-exposed `window.store`, injects a
// custom pet-def catalog via `window.petDefs` (so the reward def resolves), and
// injects a one-checkpoint content bundle via `window.contentStore.setBundle`
// (so a boss lesson carrying `rewardPetDefId` exists in the runtime bundle).
// Then: set `currentBossLessonId` → `finishBoss(true)` → assert the grant.
//
// The grant site is gameStore.finishBoss(true): it reads cleared.rewardPetDefId,
// resolves the def, grants a pet (defId = def.id, species = def.element, band
// stats, rarity 'common'), sets lastPull AND lastHatch to it, and unions the
// granted defId into caughtDefIds (P4a dex).

const REWARD_DEF_ID = 'e2e-reward-fire';
const REWARD_ELEMENT = 'fire';
const BOSS_LESSON_ID = 'e2e-p4c-boss';

type PetInstance = { id: string; defId: string; species: string; stats: Record<string, number> };
type StoreState = {
  screen: string;
  currentBossLessonId: string | null;
  pets: PetInstance[];
  caughtDefIds: string[];
  lastPull: PetInstance | null;
  lastHatch: PetInstance | null;
  lastStageChange: unknown;
  journey: { lessonStars: Record<string, number> };
  finishBoss: (won: boolean) => void;
  setScreen: (s: string) => void;
};
type Win = {
  store: { getState: () => StoreState; setState: (p: Partial<StoreState>) => void };
  petDefs: { set: (defs: unknown[]) => void };
  contentStore: { getState: () => { setBundle: (bundle: unknown, status: string) => void } };
};

// NOTE: the per-page setup() builds the catalog + bundle INLINE inside
// page.evaluate (Playwright serializes evaluate args and cannot capture outer
// closures), so the def/bundle factory shapes live there. The injected bundle is
// a minimal ContentBundle with one unit whose only lesson is a checkpoint (boss)
// carrying `rewardPetDefId`. setBundle wraps it into a default Course and resolves
// it to the runtime bundle; authored units' lessons survive verbatim
// (resolveCourseBundle only ADDS synthetic boss units), so finishBoss's
// findLesson(bundle, BOSS_LESSON_ID) sees the rewardPetDefId.

async function waitForHarness(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => {
      const w = window as unknown as Partial<Win>;
      return (
        typeof w.store?.getState === 'function' &&
        typeof w.petDefs?.set === 'function' &&
        typeof w.contentStore?.getState === 'function'
      );
    },
    null,
    { timeout: 30_000 },
  );
}

/** Inject the reward catalog + reward bundle, and reset collection so the first
 *  clear is a genuine first-clear (no stars on the boss lesson yet). */
async function setup(page: Page) {
  await page.evaluate(
    ({ defId, element, lessonId }) => {
      const w = window as unknown as Win;
      // Catalog must contain the reward def so resolvePetDef(rewardId) resolves it.
      // Include a distractor so the reward def isn't the trivial defs[0] fallback.
      const mk = (id: string, el: string, dexNo: number, band: [number, number]) => {
        const bands = { hp: band, atk: band, def: band, spd: band, luk: band };
        return { id, name: id, gen: 1, dexNo, types: [el], element: el, statBands: { common: bands, rare: bands, epic: bands, legendary: bands }, enabled: true };
      };
      w.petDefs.set([mk('e2e-distractor', 'leaf', 1, [40, 60]), mk(defId, element, 2, [11, 13])]);

      const bundle = {
        pool: {},
        units: [{
          id: 'e2e-p4c-unit', title: 'P4c', emoji: '⚔️', order: 1,
          lessons: [{
            id: lessonId, kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: [],
            isCheckpoint: true, title: 'P4c Boss',
            boss: { tierId: 'tier-1', element, name: 'P4c Rival', rivalSprite: { species: element, stage: 'baby' } },
            rewardPetDefId: defId,
          }],
        }],
      };
      w.contentStore.getState().setBundle(bundle, 'live');

      // Clean collection + ensure the boss lesson has no prior stars (so it's a first-clear).
      const s = w.store.getState();
      const lessonStars = { ...s.journey.lessonStars };
      delete lessonStars[lessonId];
      w.store.setState({
        pets: [], caughtDefIds: [], lastPull: null, lastHatch: null,
        journey: { ...s.journey, lessonStars },
      });
    },
    { defId: REWARD_DEF_ID, element: REWARD_ELEMENT, lessonId: BOSS_LESSON_ID },
  );
}

/** Set the active boss lesson and clear it as a win; return a state snapshot. */
function clearBoss(page: Page) {
  return page.evaluate((lessonId) => {
    const w = window as unknown as Win;
    w.store.setState({ currentBossLessonId: lessonId });
    w.store.getState().finishBoss(true);
    const s = w.store.getState();
    return {
      screen: s.screen,
      lastPull: s.lastPull,
      lastHatch: s.lastHatch,
      caughtDefIds: [...s.caughtDefIds],
      petsLen: s.pets.length,
    };
  }, BOSS_LESSON_ID);
}

test.describe('P4c reward pets', () => {
  test('A: a boss with rewardPetDefId grants exactly that pet, queues the hatch, and marks it caught', async ({ page }) => {
    await waitForHarness(page);
    await setup(page);

    const res = await clearBoss(page);

    // Boss win lands on the reward screen with one freshly-granted pet.
    expect(res.screen, 'boss win routes to the reward screen').toBe('reward');
    expect(res.petsLen, 'first clear grants exactly one pet').toBe(1);

    // 1. The granted pet IS the authored reward def (both the pull + the hatch slot).
    expect(res.lastHatch, 'lastHatch is set for the hatch cinematic').not.toBeNull();
    expect(res.lastHatch!.defId, 'reward grants the authored def').toBe(REWARD_DEF_ID);
    expect(res.lastPull, 'lastPull mirrors the granted reward').not.toBeNull();
    expect(res.lastPull!.defId).toBe(REWARD_DEF_ID);
    // ...and NOT the distractor def (proves the grant resolved the authored reward
    // rather than the trivial defs[0] catalog fallback).
    expect(res.lastHatch!.defId).not.toBe('e2e-distractor');

    // 2. The reward defId is unioned into the dex caught set (P4a).
    expect(res.caughtDefIds, 'reward def recorded caught in the dex').toContain(REWARD_DEF_ID);

    // 3. Species is derived from the reward def's element.
    expect(res.lastHatch!.species, 'species = reward def element').toBe(REWARD_ELEMENT);

    // Stats come from the reward def's statBands.common (11-13), proving the grant
    // used the authored def (not a random pool pick or the legacy gacha table).
    for (const v of Object.values(res.lastHatch!.stats)) {
      expect(v).toBeGreaterThanOrEqual(11);
      expect(v).toBeLessThanOrEqual(13);
    }
  });

  test('B: from the reward screen, Continue routes to the hatch cinematic (lastHatch set)', async ({ page }) => {
    await waitForHarness(page);
    await setup(page);
    await clearBoss(page);

    // RewardScreen "Continue" routes to 'rewardHatch' precisely when lastHatch is set.
    // Drive the same routing the button does (the game UI is gated behind auth, so
    // we assert the store transition rather than depend on a live Firebase sign-in).
    const screen = await page.evaluate(() => {
      const w = window as unknown as Win;
      const s = w.store.getState();
      // Mirror RewardScreen's onClick: lastHatch ? 'rewardHatch' : lastStageChange ? 'evolution' : 'petRoom'.
      s.setScreen(s.lastHatch ? 'rewardHatch' : s.lastStageChange ? 'evolution' : 'petRoom');
      return w.store.getState().screen;
    });
    expect(screen, 'Continue with a queued reward routes to the hatch cinematic').toBe('rewardHatch');
  });

  test('C: replay of the same boss grants no second reward (first-clear only)', async ({ page }) => {
    await waitForHarness(page);
    await setup(page);

    await clearBoss(page);
    const second = await clearBoss(page);

    // The reward + caught union happen only on first clear; a replay must not
    // duplicate the pet or re-grant.
    expect(second.petsLen, 'replay grants no extra reward pet').toBe(1);
    expect(second.caughtDefIds.filter((id) => id === REWARD_DEF_ID).length, 'caught set stays deduped').toBe(1);
  });

  // Full-UI render of the hatch cinematic. The game UI mounts only once
  // non-anonymous (Firebase anon sign-in), so this signs in via the dev panel's
  // test account and SKIPS gracefully when Firebase auth is unavailable in this
  // environment (mirrors boss.spec.ts test B). The store-level proof above is the
  // hermetic guarantee; this is the visual confirmation when auth is reachable.
  test('D: the hatch cinematic renders the reward pet (full UI, skips without Firebase)', async ({ page }) => {
    await waitForHarness(page);

    // Sign in via the dev panel test account so App renders past the auth gate.
    await page.getByRole('button', { name: 'dev', exact: true }).click().catch(() => {});
    await page.getByRole('button', { name: '🧪 test acct' }).click().catch(() => {});

    // Poll for the app to render past auth (Continue/reward chrome appears once signed in).
    let signedIn = false;
    for (let i = 0; i < 15 && !signedIn; i++) {
      signedIn = await page
        .evaluate(() => {
          // App is mounted iff a game screen is reachable; probe via a known hub button.
          return document.querySelector('[data-testid], button') !== null && !document.body.textContent?.includes('🥚');
        })
        .catch(() => false);
      // Re-assert: only proceed once the menu/auth surface is gone.
      const menuGone = await page.getByRole('button', { name: /sign in|play as guest|new game/i }).first().isVisible().catch(() => true);
      signedIn = signedIn && !menuGone;
      if (!signedIn) await page.waitForTimeout(1000);
    }
    test.skip(!signedIn, 'App never rendered past auth — Firebase test-account sign-in unavailable in this environment');

    // Seed the reward grant, then drive the UI to the hatch cinematic.
    await setup(page);
    await clearBoss(page);
    await page.evaluate(() => {
      (window as unknown as Win).store.getState().setScreen('rewardHatch');
    });

    // EvolutionCinematic exposes data-testid="evolution-stage"; RewardHatchScreen
    // renders it for the freshly-granted reward pet.
    await expect(page.getByTestId('evolution-stage')).toBeVisible({ timeout: 10_000 });
  });
});

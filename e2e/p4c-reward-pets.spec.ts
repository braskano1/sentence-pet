import { test, expect, type Page } from '@playwright/test';
import { stubFirebaseAuth, enterGameViaMenu } from './support/hermetic-auth';

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

type PetInstance = { id: string; defId: string; species: string; stats: Record<string, number>; hatched?: boolean };
type StoreState = {
  screen: string;
  currentBossLessonId: string | null;
  activePetId: string;
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

  // Full-UI render of the hatch cinematic. Mounts hermetically via the shared
  // Firebase-auth stub (stubFirebaseAuth + enterGameViaMenu) — no emulator, no
  // network, no dev-panel test account — then drives the UI to the hatch cinematic.
  //
  // This does NOT reuse the store-only setup() (which wipes pets to []) because it
  // renders the LIVE UI, where two store invariants the store-only tests never hit
  // must hold:
  //   1. The screen router short-circuits to <EggHatch /> when the ACTIVE pet is
  //      unhatched (App.tsx: `if (!hatched) return EggHatch`). In the real game the
  //      reward lands while a hatched starter is active, so the router falls through
  //      to 'rewardHatch'. We seed a full HATCHED anchor pet to reproduce that.
  //   2. selectActivePet returns pets[0]; an empty pets[] makes it undefined and the
  //      live render throws on `.hatched` — so pets must never be observed empty.
  // Mutations are split into ordered, separately-awaited steps (rather than one
  // atomic evaluate) because gameStore + contentStore are read via useSyncExternalStore,
  // which re-renders SYNCHRONOUSLY per store write: batching petDefs/bundle/pet writes
  // in one evaluate lets an intermediate render see a half-applied state (e.g. the
  // unhatched starter against the minimal bundle) and crash EggHatch, which tears the
  // React root down permanently. Letting petRoom commit between the catalog and the
  // bundle write keeps every committed render renderable.
  test('D: the hatch cinematic renders the reward pet (full UI, hermetic)', async ({ page }) => {
    await stubFirebaseAuth(page); // register routes BEFORE goto
    await waitForHarness(page);
    await enterGameViaMenu(page); // Tap to start → Play as guest → Skip → mounts game

    // 1. Seed a full hatched anchor pet + park on petRoom (leaves the egg screen, so
    //    EggHatch unmounts and pets[] is never empty under a render).
    await page.evaluate(() => {
      const w = window as unknown as Win;
      w.store.setState({
        pets: [{
          id: 'anchor', defId: 'e2e-distractor', species: 'leaf', hatched: true, xp: 0, happiness: 50,
          bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
          stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
          growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '',
        }],
        activePetId: 'anchor',
        screen: 'petRoom',
        caughtDefIds: [], lastPull: null, lastHatch: null,
      });
    });

    // 2. Inject the reward catalog (distractor + reward def so the reward isn't the
    //    trivial defs[0] fallback).
    await page.evaluate(
      ({ defId, element }) => {
        const w = window as unknown as Win;
        const mk = (id: string, el: string, dexNo: number, band: [number, number]) => {
          const bands = { hp: band, atk: band, def: band, spd: band, luk: band };
          return { id, name: id, gen: 1, dexNo, types: [el], element: el, statBands: { common: bands, rare: bands, epic: bands, legendary: bands }, enabled: true };
        };
        w.petDefs.set([mk('e2e-distractor', 'leaf', 1, [40, 60]), mk(defId, element, 2, [11, 13])]);
      },
      { defId: REWARD_DEF_ID, element: REWARD_ELEMENT },
    );

    // 3. Wait for petRoom to actually COMMIT before mutating the bundle, so no
    //    intermediate useSyncExternalStore render straddles the catalog + bundle writes.
    await page.waitForFunction(
      () => (window as unknown as Win).store.getState().screen === 'petRoom' && document.body.innerText.length > 100,
      null,
      { timeout: 10_000 },
    );

    // 4. Inject the one-checkpoint reward bundle + clear the boss lesson's stars (so
    //    the clear is a genuine first-clear that grants).
    await page.evaluate(
      ({ element, lessonId, defId }) => {
        const w = window as unknown as Win;
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
        const s = w.store.getState();
        const lessonStars = { ...s.journey.lessonStars };
        delete lessonStars[lessonId];
        w.store.setState({ journey: { ...s.journey, lessonStars } });
      },
      { element: REWARD_ELEMENT, lessonId: BOSS_LESSON_ID, defId: REWARD_DEF_ID },
    );

    // 5. Clear the boss (grants the reward + sets lastHatch), then route to the cinematic.
    await clearBoss(page);
    await page.evaluate(() => {
      (window as unknown as Win).store.getState().setScreen('rewardHatch');
    });

    // EvolutionCinematic exposes data-testid="evolution-stage"; RewardHatchScreen
    // renders it for the freshly-granted reward pet. The cinematic img alt follows
    // `pet-<species>-<stage>` (see EvolutionCinematic.tsx); the reward pet's
    // species = REWARD_ELEMENT ('fire'), so the alt starts `pet-fire-`.
    const sprite = page.getByTestId('evolution-stage');
    await expect(sprite).toBeVisible({ timeout: 10_000 });
    await expect(sprite).toHaveAttribute('alt', /^pet-fire-/);
  });
});

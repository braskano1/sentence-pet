import { test, expect, type Page } from '@playwright/test';

// P4d def-chain evolution FULL-UI browser test (hermetic, no auth / no emulators).
//
// Complements the store-state-only `e2e/p4d-evolution.spec.ts` (which proves the
// `finishRound` -> evolvePetDef -> defId-hop seam at the store level) by driving
// the REAL UI and asserting the player actually SEES the evolution:
//   1. the evolution CINEMATIC renders the evolved def's sprite + reveal text, and
//   2. the DEX evolution chain lights up the evolved form (full art, no silhouette).
//
// This supersedes the deferred p4c "full-UI render only with Firebase" skip: it
// gets the same visual coverage with zero auth/emulator dependency by reusing the
// dev-exposed `window.store` / `window.petDefs` harness and the screen router.
//
// Boot/seed pattern (waitForHarness + inject 2-def chain + park a baby one round
// below L16 + a single finishRound) is lifted verbatim from p4d-evolution.spec.ts.

const BASE_DEF_ID = 'e2e-base';
const MID_DEF_ID = 'e2e-mid';
const MID_NAME = 'Mid';
const MID_ELEMENT = 'fire';

type PetInstance = { id: string; defId: string; species: string };
type StoreState = {
  pets: PetInstance[];
  caughtDefIds: string[];
  finishRound: (r: { drill: string; level: number; stars: number; correctCount: number }) => void;
  setScreen: (s: string) => void;
};
type PetDefHandle = { set: (defs: unknown[]) => void; builtins: Array<{ statBands: unknown }> };
type Win = {
  store: { getState: () => StoreState; setState: (p: Record<string, unknown>) => void };
  petDefs: PetDefHandle;
};

// Hermetic auth: the app boots into a Firebase Auth-EMULATOR anonymous sign-in
// (.env.local has VITE_USE_EMULATOR=true). With no emulator reachable, the SDK's
// signInAnonymously never resolves, so PlayerRoot stays on the loading splash and
// the game UI never mounts — which the store-only specs never noticed because
// they never render any UI. We intercept the emulator's Identity Toolkit REST
// calls and fulfill the anonymous-bootstrap (accounts:signUp) + account lookup so
// onAuthChange fires with an anonymous user and `loading` flips false. That lands
// us on the MainMenu (isAnonymous → not inGame); the test then walks the real
// menu UI ("Play as guest" → Skip intro) to mount the game — no emulator, no
// network to a live Firebase project.
async function stubFirebaseAuth(page: Page) {
  // The Firebase JS SDK talks to the auth emulator at
  // {host}:9099/identitytoolkit.googleapis.com/v1/accounts:<method>?key=...
  const localId = 'e2e-uid';
  const idToken = 'e2e-id-token';
  const refreshToken = 'e2e-refresh-token';

  // NOTE: Playwright evaluates routes LAST-registered-first. Register the broad
  // catch-alls FIRST so the specific handlers below win for their exact endpoints.

  // Belt-and-suspenders: any other identitytoolkit / firestore call returns 200 so
  // the SDK never blocks on the unreachable emulator (cloud sync, etc.).
  await page.route(/firestore\.googleapis\.com\//, (route) =>
    route.fulfill({ contentType: 'application/json', body: '{}' }),
  );
  await page.route(/identitytoolkit\.googleapis\.com\//, (route) =>
    route.fulfill({ contentType: 'application/json', body: '{}' }),
  );

  // Anonymous bootstrap (signInAnonymously → accounts:signUp).
  await page.route(/identitytoolkit\.googleapis\.com\/v1\/accounts:signUp/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'identitytoolkit#SignupNewUserResponse',
        idToken, refreshToken, expiresIn: '3600', localId,
      }),
    }),
  );

  // getIdTokenResult(true) refreshes via the secure-token endpoint.
  await page.route(/securetoken\.googleapis\.com\/v1\/token/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: idToken, expires_in: '3600', token_type: 'Bearer',
        refresh_token: refreshToken, id_token: idToken, user_id: localId, project_id: 'demo-sentence-pet',
      }),
    }),
  );

  // accounts:lookup returns the user record (anonymous: no provider info).
  await page.route(/identitytoolkit\.googleapis\.com\/v1\/accounts:lookup/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'identitytoolkit#GetAccountInfoResponse',
        users: [{ localId, validSince: '0', disabled: false, lastLoginAt: '0', createdAt: '0' }],
      }),
    }),
  );
}

/** Walk the real menu → game: anon sign-in lands on MainMenu, "Play as guest"
 *  starts the intro, "Skip" enters the game (petRoom). */
async function enterGameViaMenu(page: Page) {
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await page.getByRole('button', { name: 'Play as guest' }).click();
  await page.getByRole('button', { name: /Skip/ }).click();
}

async function waitForHarness(page: Page) {
  await stubFirebaseAuth(page);
  await page.goto('/');
  await page.waitForFunction(
    () => {
      const w = window as unknown as Partial<Win>;
      return (
        typeof w.store?.getState === 'function' &&
        typeof w.petDefs?.set === 'function' &&
        Array.isArray(w.petDefs?.builtins)
      );
    },
    null,
    { timeout: 30_000 },
  );
}

/**
 * Inject the 2-def chain and seed a hatched baby parked one finishRound below the
 * L16 baby->young threshold, then fire ONE round to tip it over and run the
 * evolve path. Returns the post-evolve store snapshot for a precondition assert.
 * Identical boot/seed to p4d-evolution.spec.ts (kept in sync deliberately).
 */
async function bootAndEvolve(page: Page) {
  await waitForHarness(page);
  await enterGameViaMenu(page);

  // Inject a 2-def chain: leaf root e2e-base -> fire e2e-mid. statBands borrowed
  // from a builtin so the defs validate (they're not exercised by the hop, which
  // re-bases the live pet's stats — but a real PetDef needs them).
  await page.evaluate(
    ({ baseId, midId, midName, midEl }) => {
      const w = window as unknown as Win;
      const bands = w.petDefs.builtins[0].statBands;
      w.petDefs.set([
        {
          id: baseId, name: 'Base', gen: 9, dexNo: 90, types: ['leaf'], element: 'leaf',
          statBands: bands, enabled: true, starter: true, evolvesToId: midId,
        },
        {
          id: midId, name: midName, gen: 9, dexNo: 91, types: [midEl], element: midEl,
          statBands: bands, enabled: true, evolvesFromId: baseId,
        },
      ]);
    },
    { baseId: BASE_DEF_ID, midId: MID_DEF_ID, midName: MID_NAME, midEl: MID_ELEMENT },
  );

  return page.evaluate(
    ({ baseId }) => {
      const w = window as unknown as Win;
      // Park the hatched baby exactly one finishRound round below the L16
      // (baby->young) threshold so a single round tips it over and fires the
      // stage-change -> evolve path. The xp module isn't on window, so we mirror
      // the unit test + shipped config constants directly (kept in sync with
      // gameConfig.xp): totalXpForLevel(16) === 15123, and one correct answer at
      // level 1 grants perLevelMultiplier(10) * level(1) === 10 xp.
      const L16 = 15123; // totalXpForLevel(16) with the shipped curve { base: 40, growth: 1.5 }
      const roundGain = 10; // correctCount(1) * xpPerCorrect(1) === perLevelMultiplier(10) * level(1)
      w.store.setState({
        pets: [{
          id: 'a', defId: baseId, species: 'leaf', hatched: true, xp: L16 - roundGain, happiness: 50,
          bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
          stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
          growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '',
        }],
        activePetId: 'a',
        caughtDefIds: [baseId],
      });
      // One round tips it over L16 → applyXp reports a baby->young stageChange →
      // finishRound runs evolvePetDef → defId hops to evolvesToId AND lastStageChange
      // is set (the screen router gates 'evolution' on it being non-null).
      w.store.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 1 });
      const s = w.store.getState();
      return { defId: s.pets[0].defId, species: s.pets[0].species, caught: [...s.caughtDefIds] };
    },
    { baseId: BASE_DEF_ID },
  );
}

test.describe('P4d def-chain evolution (full UI)', () => {
  test('the evolution cinematic renders the evolved def', async ({ page }) => {
    const after = await bootAndEvolve(page);

    // Precondition: the store actually evolved (defId hop + species re-derive + dex).
    expect(after.defId, 'active pet hopped to the next def in the chain').toBe(MID_DEF_ID);
    expect(after.species, 'species re-derived from the evolved def element').toBe(MID_ELEMENT);
    expect(after.caught, 'evolved def recorded caught').toContain(MID_DEF_ID);

    // Route to the cinematic (lastStageChange is now set, so EvolutionScreen stays).
    await page.evaluate(() => {
      (window as unknown as Win).store.getState().setScreen('evolution');
    });

    // The cinematic sprite is visible and shows the evolved SPECIES. `showNew`
    // toggles the stage segment across phases (baby -> young), so assert only the
    // stable species segment `pet-fire-`, not a fixed stage.
    const sprite = page.getByTestId('evolution-stage');
    await expect(sprite).toBeVisible();
    await expect(sprite).toHaveAttribute('alt', /^pet-fire-/);

    // The reveal text only appears in the revealed phase — waiting on it gives the
    // animation time to run, proving the cinematic reaches the evolved reveal.
    await expect(page.getByText(/Evolved to.*✨/)).toBeVisible({ timeout: 10_000 });
  });

  test('the dex evolution chain lights up the evolved form', async ({ page }) => {
    const after = await bootAndEvolve(page);
    expect(after.caught, 'evolved def recorded caught').toContain(MID_DEF_ID);

    await page.evaluate(() => {
      (window as unknown as Win).store.getState().setScreen('collection');
    });

    // Switch to the Dex tab and open the evolved entry's chain detail.
    await page.getByRole('tab', { name: /^dex$/i }).click();
    await page.getByRole('button', { name: MID_NAME, exact: true }).click();

    // The DexDetail chain node for the caught evolved form renders full art:
    // alt = def.name ('Mid') and NO brightness(0) silhouette filter. Scope to the
    // open chain dialog so the assertion targets the chain node, not the grid cell
    // (both expose the 'Mid' name).
    const dialog = page.getByRole('dialog', { name: 'Evolution' });
    await expect(dialog).toBeVisible();
    const evolvedNode = dialog.getByAltText(MID_NAME);
    await expect(evolvedNode).toBeVisible();
    await expect(dialog.getByText(MID_NAME)).toBeVisible();

    const filter = await evolvedNode.evaluate((el) => getComputedStyle(el).filter);
    expect(filter, 'caught evolved chain node is lit, not a silhouette').not.toContain('brightness(0)');
  });
});

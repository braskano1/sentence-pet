import { test, expect, type Page } from '@playwright/test';
import {
  stubFirebaseAuth,
  enterGameViaMenu,
  waitForHarness,
  injectChain,
  seedAndEvolve,
  type Win,
  type EvolveSnapshot,
  MID_DEF_ID,
  MID_NAME,
  MID_ELEMENT,
} from './support/p4d-evolution';

// P4d def-chain evolution FULL-UI browser test (hermetic, no auth / no emulators).
//
// Complements the store-state-only `e2e/p4d-evolution.spec.ts` (which proves the
// `finishRound` -> evolvePetDef -> defId-hop seam at the store level) by driving
// the REAL UI and asserting the player actually SEES the evolution:
//   1. the evolution CINEMATIC renders the evolved def's sprite + reveal text, and
//   2. the DEX evolution chain lights up the evolved form (full art, no silhouette).
//
// This supersedes the deferred p4c "full-UI render only with Firebase" skip: it
// gets the same visual coverage with zero auth/emulator dependency by stubbing the
// Firebase auth emulator (see stubFirebaseAuth in ./support/p4d-evolution), walking
// the real menu to mount the game, then reusing the shared inject/seed/evolve
// boot.

/** Stub auth → mount the game via the menu → inject the chain → seed + evolve.
 *  Returns the post-evolve store snapshot for a precondition assert. */
async function bootAndEvolve(page: Page): Promise<EvolveSnapshot> {
  await stubFirebaseAuth(page); // register routes BEFORE goto
  await waitForHarness(page);
  await enterGameViaMenu(page);
  await injectChain(page);
  return seedAndEvolve(page);
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

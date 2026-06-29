import { type Page } from '@playwright/test';

// Hermetic-auth helpers moved to ./hermetic-auth; re-exported here so existing
// importers (`p4d-evolution-full-ui.spec.ts`) keep importing them from this module.
export { stubFirebaseAuth, enterGameViaMenu } from './hermetic-auth';

// Shared fixture for the two P4d def-chain-evolution e2e specs
// (`p4d-evolution.spec.ts` store-only, `p4d-evolution-full-ui.spec.ts` full-UI).
// Both inject the same 2-def chain, seed the same hatched baby one round below the
// L16 threshold, and fire one finishRound to run the evolve path — so that boot/
// seed plus the harness/auth helpers live here once.

export const BASE_DEF_ID = 'e2e-base';
export const MID_DEF_ID = 'e2e-mid';
export const MID_NAME = 'Mid';
export const MID_ELEMENT = 'fire';

// L16 (baby->young) threshold + one-round XP gain, mirrored from the shipped
// gameConfig.xp curve { base: 40, growth: 1.5 } and the gameStore unit test. The
// xp module isn't exposed on window, so these are pinned here as the single source
// for both p4d e2e specs. If gameConfig.xp is retuned, update here — the
// precondition asserts fail LOUD if the pet doesn't cross L16, so drift can't
// false-green.
export const L16_TOTAL_XP = 15123; // totalXpForLevel(16)
export const ROUND_GAIN = 10; // correctCount(1) * xpPerCorrect(level 1) === perLevelMultiplier(10) * level(1)

export type PetInstance = { id: string; defId: string; species: string };
export type StoreState = {
  pets: PetInstance[];
  caughtDefIds: string[];
  finishRound: (r: { drill: string; level: number; stars: number; correctCount: number }) => void;
  setScreen: (s: string) => void;
};
export type PetDefHandle = { set: (defs: unknown[]) => void; builtins: Array<{ statBands: unknown }> };
export type Win = {
  store: { getState: () => StoreState; setState: (p: Record<string, unknown>) => void };
  petDefs: PetDefHandle;
};

/** The post-evolve store snapshot returned by `seedAndEvolve` for precondition asserts. */
export type EvolveSnapshot = { defId: string; species: string; caught: string[] };

/** Navigate to `/` and wait until the DEV window harness (store + petDefs) is exposed. */
export async function waitForHarness(page: Page) {
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

/** Inject a 2-def chain into the live pet-def registry: leaf root e2e-base ->
 *  fire e2e-mid. statBands borrowed from a builtin so the defs validate (they're
 *  not exercised by the hop, which re-bases the live pet's stats — but a real
 *  PetDef needs them). */
export async function injectChain(page: Page) {
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
}

/**
 * Seed a hatched baby on e2e-base parked exactly one finishRound round below the
 * L16 (baby->young) threshold, then fire ONE round to tip it over so applyXp
 * reports a baby->young stageChange and finishRound runs evolvePetDef — hopping
 * defId to evolvesToId, re-deriving species, and setting lastStageChange (the
 * screen router gates 'evolution' on it being non-null). Returns the post-evolve
 * store snapshot for a precondition assert.
 */
export async function seedAndEvolve(page: Page): Promise<EvolveSnapshot> {
  return page.evaluate(
    ({ baseId, l16, roundGain }) => {
      const w = window as unknown as Win;
      w.store.setState({
        pets: [{
          id: 'a', defId: baseId, species: 'leaf', hatched: true, xp: l16 - roundGain, happiness: 50,
          bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
          stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
          growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '',
        }],
        activePetId: 'a',
        caughtDefIds: [baseId],
      });
      w.store.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 1 });
      const s = w.store.getState();
      return { defId: s.pets[0].defId, species: s.pets[0].species, caught: [...s.caughtDefIds] };
    },
    { baseId: BASE_DEF_ID, l16: L16_TOTAL_XP, roundGain: ROUND_GAIN },
  );
}

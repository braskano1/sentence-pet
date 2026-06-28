import { test, expect, type Page } from '@playwright/test';

// P4d def-chain evolution browser test (hermetic, no auth / no emulators).
//
// Proves the P4d seam end-to-end in the REAL game store: when a hatched pet on a
// def with `evolvesToId` crosses the baby->young art-stage threshold (L16),
// `finishRound` runs `evolvePetDef` and HOPS the active pet's `defId` along the
// chain (defId -> evolvesToId), re-derives `species` from the next def's element,
// and unions the evolved defId into `caughtDefIds` (the P4a def-chain dex).
//
// Drives the store via the dev-exposed `window.store` (zustand getState/setState)
// and injects a 2-def chain catalog via `window.petDefs.set` (so evolvePetDef can
// resolve the next def). The whole thing is store-level, so it needs no auth gate
// and no content bundle — `finishRound` reads the active pet directly.
//
// Mirrors the unit test `gameStore.test.ts` "advances defId to evolvesToId on the
// baby->young stage-change and records the dex": park a hatched baby just below
// L16, then a single `finishRound({ ..., correctCount: 1 })` tips it over and the
// evolve path fires.

const BASE_DEF_ID = 'e2e-base';
const MID_DEF_ID = 'e2e-mid';
const MID_ELEMENT = 'fire';

type PetInstance = { id: string; defId: string; species: string };
type StoreState = {
  pets: PetInstance[];
  caughtDefIds: string[];
  finishRound: (r: { drill: string; level: number; stars: number; correctCount: number }) => void;
};
type PetDefHandle = { set: (defs: unknown[]) => void; builtins: Array<{ statBands: unknown }> };
type Win = {
  store: { getState: () => StoreState; setState: (p: Record<string, unknown>) => void };
  petDefs: PetDefHandle;
};

async function waitForHarness(page: Page) {
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

test.describe('P4d def-chain evolution', () => {
  test('a pet evolves its def on the baby->young stage-change and is recorded caught', async ({ page }) => {
    await waitForHarness(page);

    // Inject a 2-def chain: leaf root e2e-base -> fire e2e-mid. statBands borrowed
    // from a builtin so the defs validate (they're not exercised by the hop, which
    // re-bases the live pet's stats — but a real PetDef needs them).
    await page.evaluate(
      ({ baseId, midId, midEl }) => {
        const w = window as unknown as Win;
        const bands = w.petDefs.builtins[0].statBands;
        w.petDefs.set([
          {
            id: baseId, name: 'Base', gen: 9, dexNo: 90, types: ['leaf'], element: 'leaf',
            statBands: bands, enabled: true, starter: true, evolvesToId: midId,
          },
          {
            id: midId, name: 'Mid', gen: 9, dexNo: 91, types: [midEl], element: midEl,
            statBands: bands, enabled: true, evolvesFromId: baseId,
          },
        ]);
      },
      { baseId: BASE_DEF_ID, midId: MID_DEF_ID, midEl: MID_ELEMENT },
    );

    // Seed a hatched baby on e2e-base parked just below L16, then fire ONE
    // finishRound granting correctCount(1)*xpPerCorrect(1) — exactly enough to
    // cross into 'young' and trigger the evolve path. We compute the L16 threshold
    // in the browser from the real xp domain via a high-enough xp floor: rather
    // than re-import xp math, we set xp to (L16 total - one round's gain). To stay
    // hermetic we reproduce the unit test's arithmetic using the store's own
    // config is overkill; instead we park xp high and rely on finishRound's single
    // round tipping a baby (level 1) into young. We pin the exact pre-XP using the
    // app's xp helpers exposed on the module graph is unavailable here, so we set a
    // large xp guaranteed past L16 minus a small round, then assert the hop.
    const after = await page.evaluate(
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
        // finishRound runs evolvePetDef → defId hops to evolvesToId.
        w.store.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 1 });
        const s = w.store.getState();
        return { defId: s.pets[0].defId, species: s.pets[0].species, caught: [...s.caughtDefIds] };
      },
      { baseId: BASE_DEF_ID },
    );

    expect(after.defId, 'active pet hops to the next def in the chain').toBe(MID_DEF_ID);
    expect(after.species, 'species re-derives from the evolved def element').toBe(MID_ELEMENT);
    expect(after.caught, 'evolved def is recorded caught in the dex').toContain(MID_DEF_ID);
  });
});

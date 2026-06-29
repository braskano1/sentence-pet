import { test, expect } from '@playwright/test';
import {
  waitForHarness,
  injectChain,
  seedAndEvolve,
  MID_DEF_ID,
  MID_ELEMENT,
} from './support/p4d-evolution';

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
// and no content bundle — `finishRound` reads the active pet directly. Boot/seed
// helpers are shared with the full-UI spec via ./support/p4d-evolution.

test.describe('P4d def-chain evolution', () => {
  test('a pet evolves its def on the baby->young stage-change and is recorded caught', async ({ page }) => {
    await waitForHarness(page);
    await injectChain(page);
    const after = await seedAndEvolve(page);

    expect(after.defId, 'active pet hops to the next def in the chain').toBe(MID_DEF_ID);
    expect(after.species, 'species re-derives from the evolved def element').toBe(MID_ELEMENT);
    expect(after.caught, 'evolved def is recorded caught in the dex').toContain(MID_DEF_ID);
  });
});

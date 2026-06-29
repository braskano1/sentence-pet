import { test, expect, type Page } from '@playwright/test';

// P4b gacha-over-the-dex browser tests (hermetic, no auth / no emulators).
//
// Drives the REAL game store via the dev-exposed `window.store`, and injects
// custom pet-def catalogs via the dev-exposed `window.petDefs` so the gacha
// pool is fully controlled. Guards the whole P4b seam:
//   - pulls draw a real PetDef from the active catalog (species = def.element,
//     defId = def.id), and the pulled defId is unioned into caughtDefIds (P4a),
//   - the gachaObtainable gate excludes non-obtainable defs,
//   - pulled stats come from def.statBands (not the legacy gacha table),
//   - the never-empty fallback: an all-non-obtainable catalog still yields a pet.

type PetInstance = { id: string; defId: string; species: string; stats: Record<string, number> };
type GachaState = {
  coins: number;
  pets: PetInstance[];
  caughtDefIds: string[];
  lastPull: PetInstance | null;
  pullEgg: () => void;
};
type Win = {
  store: { getState: () => GachaState; setState: (p: Partial<GachaState>) => void };
  petDefs: { get: () => Array<{ id: string; element: string }>; set: (defs: unknown[]) => void; builtins: Array<{ id: string }> };
};

// A full PetDef literal with one [min,max] applied to every rarity × stat.
function mkDef(id: string, element: string, dexNo: number, band: [number, number], opts: { gachaObtainable?: boolean } = {}) {
  const bands = { hp: band, atk: band, def: band, spd: band, luk: band };
  return {
    id, name: id, gen: 1, dexNo, types: [element], element,
    statBands: { common: bands, rare: bands, epic: bands, legendary: bands },
    enabled: true,
    ...(opts.gachaObtainable === undefined ? {} : { gachaObtainable: opts.gachaObtainable }),
  };
}

async function waitForHarness(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => {
      const w = window as unknown as Partial<Win>;
      return typeof w.store?.getState === 'function' && typeof w.petDefs?.set === 'function';
    },
    null,
    { timeout: 30_000 },
  );
}

/** Inject a catalog and reset the wallet/collection so assertions start clean. */
async function setup(page: Page, defs: unknown[]) {
  await page.evaluate((catalog) => {
    const w = window as unknown as Win;
    w.petDefs.set(catalog as unknown[]);
    w.store.setState({ coins: 100_000, pets: [], caughtDefIds: [], lastPull: null });
  }, defs);
}

/** Pull `n` eggs, returning a snapshot of the resulting collection. */
function pull(page: Page, n: number) {
  return page.evaluate((count) => {
    const w = window as unknown as Win;
    for (let i = 0; i < count; i++) w.store.getState().pullEgg();
    const s = w.store.getState();
    const catalog = w.petDefs.get();
    return {
      pets: s.pets.map((p) => ({ defId: p.defId, species: p.species, stats: p.stats })),
      caughtDefIds: s.caughtDefIds,
      coins: s.coins,
      // element each pulled def resolves to in the active catalog (for species cross-check)
      elementById: Object.fromEntries(catalog.map((d) => [d.id, d.element])),
    };
  }, n);
}

test.describe('P4b gacha over the dex', () => {
  test('A: pulls draw real defs from the catalog and mark them caught (built-ins)', async ({ page }) => {
    await waitForHarness(page);
    // Use the real built-in catalog (all enabled + obtainable).
    await page.evaluate(() => {
      const w = window as unknown as Win;
      w.petDefs.set(w.petDefs.builtins as unknown[]);
      w.store.setState({ coins: 100_000, pets: [], caughtDefIds: [], lastPull: null });
    });

    const res = await pull(page, 24);
    const ids = new Set(res.pets.map((p) => p.defId));
    const builtinIds = await page.evaluate(() => (window as unknown as Win).petDefs.builtins.map((d) => d.id));

    expect(res.pets.length).toBe(24);
    // Every pulled def is a real member of the active catalog…
    for (const p of res.pets) {
      expect(builtinIds, 'pulled defId is a real catalog id').toContain(p.defId);
      // …and species is derived from that def's element.
      expect(p.species, 'species = def.element').toBe(res.elementById[p.defId]);
    }
    // …and each distinct pulled def was recorded into the dex (P4a addCaught at the pull site).
    for (const id of ids) expect(res.caughtDefIds, 'pulled def marked caught').toContain(id);
  });

  test('B: obtainable gate + def.statBands + addCaught (single obtainable def)', async ({ page }) => {
    await waitForHarness(page);
    // Exactly one obtainable def (narrow 11-13 band) + one non-obtainable.
    // With one obtainable def, EVERY pull must resolve to it — deterministic regardless of rng.
    await setup(page, [
      mkDef('e2e-fire', 'fire', 1, [11, 13]),                              // obtainable (field absent → obtainable)
      mkDef('e2e-water', 'water', 2, [40, 60], { gachaObtainable: false }), // excluded
    ]);

    const res = await pull(page, 30);

    // Gate: never pulls the non-obtainable def.
    for (const p of res.pets) {
      expect(p.defId, 'only the obtainable def is pulled').toBe('e2e-fire');
      expect(p.species).toBe('fire');
      // Stats come from def.statBands (11-13), a range the legacy gacha table (40-90) could never produce.
      for (const v of Object.values(p.stats)) {
        expect(v).toBeGreaterThanOrEqual(11);
        expect(v).toBeLessThanOrEqual(13);
      }
    }
    expect(res.caughtDefIds, 'obtainable def caught').toContain('e2e-fire');
    expect(res.caughtDefIds, 'non-obtainable def never caught').not.toContain('e2e-water');
  });

  test('C: never-empty fallback — an all-non-obtainable catalog still yields a pet', async ({ page }) => {
    await waitForHarness(page);
    // No obtainable def in the catalog → the gameStore pool is empty → it falls back
    // to [starterDef()]. starterDef has no `starter` flag here, so it resolves to defs[0].
    await setup(page, [
      mkDef('e2e-a', 'leaf', 1, [40, 60], { gachaObtainable: false }),
      mkDef('e2e-b', 'air', 2, [40, 60], { gachaObtainable: false }),
    ]);

    const res = await pull(page, 1);

    // A pull must never blank/throw: it still produced a pet, from the fallback def (defs[0]).
    expect(res.pets.length, 'pull still succeeds via fallback').toBe(1);
    expect(res.pets[0].defId, 'fallback uses the first catalog def').toBe('e2e-a');
    expect(res.pets[0].species).toBe('leaf');
    expect(res.coins, 'a successful pull deducted the egg price').toBeLessThan(100_000);
  });
});

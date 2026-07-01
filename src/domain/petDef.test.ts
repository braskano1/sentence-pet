import { describe, it, expect } from 'vitest';
import {
  BUILTIN_PET_DEFS,
  getActivePetDefs,
  setActivePetDefs,
  subscribePetDefs,
  resolvePetDef,
  defaultDefForElement,
  starterDef,
  obtainablePool,
} from './petDef';
import { rollStatsForRarity } from './pets';
import { validatePetDefs } from '../content/validate';
import { GAME_CONFIG } from '../config/gameConfig';
import type { PetDef, Rarity, Species } from '../data/types';

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const ELEMENTS: Species[] = ['leaf', 'fire', 'air', 'water'];

describe('BUILTIN_PET_DEFS', () => {
  it('is a 3-stage chain per element (12 defs), all enabled', () => {
    expect(BUILTIN_PET_DEFS).toHaveLength(12); // 4 elements × 3 stages, mirroring the seed
    // three defs per element, one per stage
    for (const el of ELEMENTS) {
      const chain = BUILTIN_PET_DEFS.filter((d) => d.element === el);
      expect(chain.map((d) => d.evolutionStage)).toEqual([1, 2, 3]);
      expect(chain.map((d) => d.id)).toEqual([`def-${el}-1`, `def-${el}-2`, `def-${el}-3`]);
    }
    expect(BUILTIN_PET_DEFS.every((d) => d.enabled)).toBe(true);
  });

  it('flags exactly one starter (leaf root)', () => {
    const starters = BUILTIN_PET_DEFS.filter((d) => d.starter);
    expect(starters).toHaveLength(1);
    expect(starters[0].element).toBe('leaf');
    expect(starters[0].id).toBe('def-leaf-1');
  });

  it('assigns gen 1, roots keep line dexNos + non-roots a high band, element-derived types', () => {
    expect(BUILTIN_PET_DEFS.every((d) => d.gen === 1)).toBe(true);
    // roots (no evolvesFromId) hold the shown line numbers 1..4; non-roots get 1000..1007
    const roots = BUILTIN_PET_DEFS.filter((d) => !d.evolvesFromId);
    expect(roots.map((d) => d.dexNo)).toEqual([1, 2, 3, 4]);
    const nonRoots = BUILTIN_PET_DEFS.filter((d) => d.evolvesFromId);
    expect(nonRoots.map((d) => d.dexNo)).toEqual([1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007]);
    // all dexNos unique
    expect(new Set(BUILTIN_PET_DEFS.map((d) => d.dexNo)).size).toBe(12);
    for (const d of BUILTIN_PET_DEFS) expect(d.types).toEqual([d.element]);
  });

  it('links each element chain 1 -> 2 -> 3 with reciprocal evolves refs', () => {
    for (const el of ELEMENTS) {
      const [s1, s2, s3] = BUILTIN_PET_DEFS.filter((d) => d.element === el);
      expect(s1.evolvesFromId).toBeUndefined();
      expect(s1.evolvesToId).toBe(s2.id);
      expect(s2.evolvesFromId).toBe(s1.id);
      expect(s2.evolvesToId).toBe(s3.id);
      expect(s3.evolvesFromId).toBe(s2.id);
      expect(s3.evolvesToId).toBeUndefined();
    }
  });

  it('resolves the -1 roots for the starter and each element default', () => {
    expect(starterDef(BUILTIN_PET_DEFS).id).toBe('def-leaf-1');
    for (const el of ELEMENTS) {
      expect(defaultDefForElement(el, BUILTIN_PET_DEFS).id).toBe(`def-${el}-1`);
    }
  });

  it('passes validatePetDefs (unique dexNos + integral chains)', () => {
    expect(validatePetDefs([...BUILTIN_PET_DEFS]).ok).toBe(true);
  });

  it('pins the starter to gen 1, dexNo 1', () => {
    const starter = BUILTIN_PET_DEFS.find((d) => d.starter)!;
    expect(starter.gen).toBe(1);
    expect(starter.dexNo).toBe(1);
  });

  it('stat bands reproduce the existing gacha bands for every rarity/stat', () => {
    for (const def of BUILTIN_PET_DEFS) {
      for (const tier of GAME_CONFIG.gacha.rarities) {
        for (const stat of ['hp', 'atk', 'def', 'spd', 'luk'] as const) {
          expect(def.statBands[tier.rarity][stat]).toEqual(tier.band);
        }
      }
    }
  });
});

describe('resolve helpers', () => {
  it('defaultDefForElement returns the built-in def for that element', () => {
    for (const el of ELEMENTS) {
      expect(defaultDefForElement(el, BUILTIN_PET_DEFS).element).toBe(el);
    }
  });

  it('starterDef returns the starter-flagged def', () => {
    expect(starterDef(BUILTIN_PET_DEFS).starter).toBe(true);
  });

  it('resolvePetDef finds by id, falls back to starter for an unknown id', () => {
    const leaf = defaultDefForElement('leaf', BUILTIN_PET_DEFS);
    expect(resolvePetDef(leaf.id, BUILTIN_PET_DEFS)).toBe(leaf);
    expect(resolvePetDef('does-not-exist', BUILTIN_PET_DEFS)).toBe(starterDef(BUILTIN_PET_DEFS));
  });

  it('built-in bands feed rollStatsForRarity within range', () => {
    const def = defaultDefForElement('fire', BUILTIN_PET_DEFS);
    for (const r of RARITIES) {
      const [min, max] = def.statBands[r].hp;
      const s = rollStatsForRarity(r, () => 0.5, GAME_CONFIG.gacha.rarities);
      expect(s.hp).toBeGreaterThanOrEqual(min);
      expect(s.hp).toBeLessThanOrEqual(max);
    }
  });
});

describe('active registry', () => {
  it('defaults to the built-ins and is swappable', () => {
    setActivePetDefs(BUILTIN_PET_DEFS); // reset
    expect(getActivePetDefs()).toEqual(BUILTIN_PET_DEFS);
    const custom = [{ ...BUILTIN_PET_DEFS[0], id: 'custom-leaf' }];
    setActivePetDefs(custom);
    expect(getActivePetDefs()).toEqual(custom);
    setActivePetDefs(BUILTIN_PET_DEFS); // restore for other suites
  });

  it('helpers default their defs arg to the active registry', () => {
    setActivePetDefs(BUILTIN_PET_DEFS);
    expect(defaultDefForElement('water').element).toBe('water');
    expect(starterDef().starter).toBe(true);
  });

  it('notifies subscribers on a catalog swap and stops after unsubscribe', () => {
    setActivePetDefs(BUILTIN_PET_DEFS);
    let calls = 0;
    const unsub = subscribePetDefs(() => { calls += 1; });

    const custom = [{ ...BUILTIN_PET_DEFS[0], id: 'custom-leaf' }];
    setActivePetDefs(custom);
    expect(calls).toBe(1);

    unsub();
    setActivePetDefs(BUILTIN_PET_DEFS);
    expect(calls).toBe(1); // unsubscribed — no further notifications

    setActivePetDefs(BUILTIN_PET_DEFS); // restore for other suites
  });

  it('does not notify on an identical (same-reference) swap', () => {
    setActivePetDefs(BUILTIN_PET_DEFS);
    let calls = 0;
    const unsub = subscribePetDefs(() => { calls += 1; });
    setActivePetDefs(BUILTIN_PET_DEFS); // same ref as current active
    expect(calls).toBe(0);
    unsub();
  });
});

describe('obtainablePool', () => {
  it('keeps enabled defs and drops gachaObtainable===false', () => {
    const a = { ...BUILTIN_PET_DEFS[0], id: 'a', enabled: true, gachaObtainable: true };
    const b = { ...BUILTIN_PET_DEFS[0], id: 'b', enabled: true, gachaObtainable: false };
    const c = { ...BUILTIN_PET_DEFS[0], id: 'c', enabled: false };
    expect(obtainablePool([a, b, c]).map((d) => d.id)).toEqual(['a']);
  });
  it('falls back to a never-empty pool when nothing is obtainable', () => {
    const none = [{ ...BUILTIN_PET_DEFS[0], id: 'x', enabled: false }];
    expect(obtainablePool(none).length).toBe(1); // starterDef fallback — never blank
  });
});

describe('obtainablePool — stage-1 roots only (P4d)', () => {
  const mk = (over: Partial<PetDef>): PetDef => ({
    id: over.id ?? 'x', name: 'X', gen: 1, dexNo: 1, types: ['leaf'], element: 'leaf',
    statBands: {} as PetDef['statBands'], enabled: true, starter: false, ...over,
  });

  it('excludes mid/final evolutions (defs with evolvesFromId)', () => {
    const defs = [
      mk({ id: 'root', starter: true }),
      mk({ id: 'mid', evolvesFromId: 'root', evolvesToId: 'final', dexNo: 2 }),
      mk({ id: 'final', evolvesFromId: 'mid', dexNo: 3 }),
    ];
    const pool = obtainablePool(defs).map((d) => d.id);
    expect(pool).toContain('root');
    expect(pool).not.toContain('mid');
    expect(pool).not.toContain('final');
  });

  it('still excludes disabled and gachaObtainable:false roots', () => {
    const defs = [
      mk({ id: 'root', starter: true }),
      mk({ id: 'off', enabled: false, dexNo: 2 }),
      mk({ id: 'noGacha', gachaObtainable: false, dexNo: 3 }),
    ];
    const pool = obtainablePool(defs).map((d) => d.id);
    expect(pool).toEqual(['root']);
  });

  it('falls back to the starter when no root is obtainable', () => {
    const defs = [mk({ id: 'root', starter: true, evolvesFromId: 'ghost' })];
    expect(obtainablePool(defs).length).toBe(1);
  });
});

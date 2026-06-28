import { describe, it, expect } from 'vitest';
import {
  BUILTIN_PET_DEFS,
  getActivePetDefs,
  setActivePetDefs,
  resolvePetDef,
  defaultDefForElement,
  starterDef,
} from './petDef';
import { rollStatsForRarity } from './pets';
import { GAME_CONFIG } from '../config/gameConfig';
import type { Rarity, Species } from '../data/types';

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const ELEMENTS: Species[] = ['leaf', 'fire', 'air', 'water'];

describe('BUILTIN_PET_DEFS', () => {
  it('has exactly one def per element, all enabled', () => {
    expect(BUILTIN_PET_DEFS).toHaveLength(4);
    expect(BUILTIN_PET_DEFS.map((d) => d.element).sort()).toEqual([...ELEMENTS].sort());
    expect(BUILTIN_PET_DEFS.every((d) => d.enabled)).toBe(true);
  });

  it('flags exactly one starter (leaf)', () => {
    const starters = BUILTIN_PET_DEFS.filter((d) => d.starter);
    expect(starters).toHaveLength(1);
    expect(starters[0].element).toBe('leaf');
  });

  it('assigns gen 1, sequential dexNo, and element-derived types', () => {
    expect(BUILTIN_PET_DEFS.every((d) => d.gen === 1)).toBe(true);
    expect(BUILTIN_PET_DEFS.map((d) => d.dexNo).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    for (const d of BUILTIN_PET_DEFS) expect(d.types).toEqual([d.element]);
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
});

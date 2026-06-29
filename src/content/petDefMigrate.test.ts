import { describe, it, expect } from 'vitest';
import { backfillPetDefs, type RawPetDef } from './petDefMigrate';
import { validatePetDefs } from './validate';
import { BUILTIN_PET_DEFS } from '../domain/petDef';

// A pre-v2 catalog: built-ins stripped of gen/dexNo/types.
function preV2() {
  return BUILTIN_PET_DEFS.map((d) => {
    const { gen: _g, dexNo: _x, types: _t, ...rest } = d;
    return { ...rest };
  });
}

describe('backfillPetDefs', () => {
  it('fills gen 1, sequential dexNo, and element-derived types on pre-v2 defs', () => {
    const out = backfillPetDefs(preV2() as RawPetDef[]);
    expect(out.every((d) => d.gen === 1)).toBe(true);
    expect(out.map((d) => d.dexNo)).toEqual(BUILTIN_PET_DEFS.map((_, i) => i + 1));
    for (const d of out) expect(d.types).toEqual([d.element]);
  });

  it('produces a catalog that passes validatePetDefs', () => {
    expect(validatePetDefs(backfillPetDefs(preV2() as RawPetDef[])).ok).toBe(true);
  });

  it('preserves already-present v2 fields', () => {
    const out = backfillPetDefs(BUILTIN_PET_DEFS as RawPetDef[]);
    // backfill stamps gachaObtainable: true (absent in built-ins); strip it before comparing the v2 fields.
    expect(out.map(({ gachaObtainable: _g, ...rest }) => rest)).toEqual(BUILTIN_PET_DEFS);
  });

  it('defaults gachaObtainable to true when absent', () => {
    const out = backfillPetDefs(preV2() as RawPetDef[]);
    for (const d of out) expect(d.gachaObtainable).toBe(true);
  });

  it('preserves an explicit gachaObtainable false', () => {
    const raw = preV2() as RawPetDef[];
    raw[0].gachaObtainable = false;
    expect(backfillPetDefs(raw)[0].gachaObtainable).toBe(false);
  });
});

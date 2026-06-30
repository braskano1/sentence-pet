import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { deriveStatBands, parsePetsSheet, importPets } from './petImport';
import { GAME_CONFIG } from '../config/gameConfig';
import { validatePetDefs } from './validate';

const common = GAME_CONFIG.gacha.rarities.find((r) => r.rarity === 'common')!.band;

describe('deriveStatBands', () => {
  it('base = gacha common reproduces the gacha table for every rarity & stat', () => {
    const bands = deriveStatBands([common[0], common[1]]);
    for (const tier of GAME_CONFIG.gacha.rarities) {
      for (const stat of ['hp', 'atk', 'def', 'spd', 'luk'] as const) {
        expect(bands[tier.rarity][stat]).toEqual([tier.band[0], tier.band[1]]);
      }
    }
  });

  it('shifts every rarity by the same delta when the base shifts', () => {
    const bands = deriveStatBands([common[0] + 10, common[1] + 10]);
    const rare = GAME_CONFIG.gacha.rarities.find((r) => r.rarity === 'rare')!.band;
    expect(bands.rare.hp).toEqual([rare[0] + 10, rare[1] + 10]);
  });

  it('clamps a derived min below zero up to zero', () => {
    const bands = deriveStatBands([-50, 5]);
    expect(bands.common.hp[0]).toBe(0);            // -50 clamped up to 0
    expect(bands.common.hp[0]).toBeGreaterThanOrEqual(0);
    expect(bands.common.hp[1]).toBeGreaterThanOrEqual(bands.common.hp[0]); // max >= min
  });
});

function wbWithPets(tsv: string): XLSX.WorkBook {
  const aoa = tsv.split('\n').map((l) => l.split('\t'));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Pets');
  return wb;
}

describe('parsePetsSheet', () => {
  it('absent Pets sheet → empty, no errors', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
    expect(parsePetsSheet(wb)).toEqual({ defs: [], errors: [] });
  });

  it('parses a full row and derives statBands from the base range', () => {
    const { defs, errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\tbase_min\tbase_max\tenabled\tstarter\n' +
      'def-sprig\tSprig\t1\t1\tleaf\tleaf\t40\t60\ttrue\ttrue',
    ));
    expect(errors).toEqual([]);
    expect(defs).toHaveLength(1);
    const d = defs[0];
    expect(d.id).toBe('def-sprig');
    expect(d.types).toEqual(['leaf']);
    expect(d.statBands.common.hp).toEqual([40, 60]);
    expect(d.statBands.legendary.hp).toEqual([85, 90]);
    expect(d.starter).toBe(true);
    expect(d.enabled).toBe(true);
  });

  it('omitted base columns → gacha-table statBands (builtin-identical)', () => {
    const { defs } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\n' +
      'def-x\tEx\t1\t1\tfire\tfire',
    ));
    expect(defs[0].statBands.common.hp).toEqual([40, 60]);
    expect(defs[0].statBands.epic.hp).toEqual([72, 88]);
  });

  it('reports per-row shape errors prefixed "Pets row N:"', () => {
    const { errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\n' +
      '\tNoId\t1\t1\tleaf\tleaf\n' +
      'def-b\tB\t1\t1\t\tleaf\n' +
      'def-c\tC\t0\t1\tleaf\twind',
    ));
    expect(errors.some((e) => e.startsWith('Pets row 2:') && /id/.test(e))).toBe(true);
    expect(errors.some((e) => e.startsWith('Pets row 3:') && /type/.test(e))).toBe(true);
    expect(errors.some((e) => e.startsWith('Pets row 4:'))).toBe(true);
  });

  it('parsed defs merged with builtins pass validatePetDefs', () => {
    const { defs } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\tenabled\n' +
      'def-new\tNewbie\t2\t1\twater\twater\ttrue',
    ));
    const res = validatePetDefs(defs);
    expect(res.errors).toContain('expected exactly one starter pet-def, found 0');
    expect(res.errors.some((e) => e.includes('def-new') && /band|type|element|gen|dexNo/.test(e))).toBe(false);
  });

  it('invalid evolutionStage → error and field omitted from def', () => {
    const { defs, errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\tevolutionStage\n' +
      'def-x\tEx\t1\t1\tfire\tfire\t2nd',
    ));
    expect(errors.some((e) => e.startsWith('Pets row 2:') && /evolutionStage/.test(e))).toBe(true);
    expect(defs).toHaveLength(1);
    expect('evolutionStage' in defs[0]).toBe(false);
  });

  it('partial base (only base_min set) → error', () => {
    const { errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\tbase_min\tbase_max\n' +
      'def-x\tEx\t1\t1\tfire\tfire\t40\t',
    ));
    expect(errors.some((e) => e.startsWith('Pets row 2:') && /base_min and base_max/.test(e))).toBe(true);
  });

  it('inverted base (base_min > base_max) → error', () => {
    const { errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\tbase_min\tbase_max\n' +
      'def-x\tEx\t1\t1\tfire\tfire\t80\t20',
    ));
    expect(errors.some((e) => e.startsWith('Pets row 2:') && /base_min must be <= base_max/.test(e))).toBe(true);
  });

  it('optional fields round-trip correctly', () => {
    const { defs, errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\trarity\tgachaObtainable\tevolvesToId\tevolutionStage\tspriteDefault\n' +
      'def-opt\tOptional\t3\t7\tair\tair\trare\tfalse\tdef-next\t2\thttps://example.com/a.png',
    ));
    expect(errors).toEqual([]);
    expect(defs).toHaveLength(1);
    const d = defs[0];
    expect(d.rarity).toBe('rare');
    expect(d.gachaObtainable).toBe(false);
    expect(d.evolvesToId).toBe('def-next');
    expect(d.evolutionStage).toBe(2);
    expect(d.sprite?.default).toBe('https://example.com/a.png');
  });

  it('row with empty name is still emitted (contract guard)', () => {
    const { defs, errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\n' +
      'def-noname\t\t1\t1\tleaf\tleaf',
    ));
    expect(errors.some((e) => e.startsWith('Pets row 2:') && /name/.test(e))).toBe(true);
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe('');
  });
});

describe('importPets', () => {
  it('returns entities + Pets-prefixed errors only', () => {
    const wb = wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\n' +
      'def-ok\tOk\t2\t1\tleaf\tleaf\n' +
      '\tBad\t1\t1\tleaf\tleaf',
    );
    const { entities, errors } = importPets(wb);
    expect(entities).toHaveLength(1);
    expect(entities[0].id).toBe('def-ok');
    expect(errors.every((e) => e.startsWith('Pets'))).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('absent/empty Pets sheet → empty entities + a "no rows" message', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
    const { entities, errors } = importPets(wb);
    expect(entities).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Pets/);
  });
});

describe('parsePetsSheet integer enforcement + types dedup', () => {
  it('rejects a fractional gen', () => {
    const { errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\n' +
      'def-f\tF\t1.5\t1\tleaf\tleaf',
    ));
    expect(errors.some((e) => e.startsWith('Pets row 2:') && /gen must be an integer/.test(e))).toBe(true);
  });

  it('rejects a fractional dexNo', () => {
    const { errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\n' +
      'def-f\tF\t1\t2.5\tleaf\tleaf',
    ));
    expect(errors.some((e) => e.startsWith('Pets row 2:') && /dexNo must be an integer/.test(e))).toBe(true);
  });

  it('rejects a fractional base_min/base_max', () => {
    const { errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\tbase_min\tbase_max\n' +
      'def-f\tF\t2\t1\tleaf\tleaf\t40.5\t60',
    ));
    expect(errors.some((e) => e.startsWith('Pets row 2:') && /whole number/.test(e))).toBe(true);
  });

  it('dedupes duplicate types', () => {
    const { defs, errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\n' +
      'def-d\tD\t2\t1\tleaf,leaf\tleaf',
    ));
    expect(errors).toEqual([]);
    expect(defs[0].types).toEqual(['leaf']);
  });
});

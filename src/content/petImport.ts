import * as XLSX from 'xlsx';
import { GAME_CONFIG } from '../config/gameConfig';
import type { BattleStats, PetDef, PetType, Rarity, Species, StatRange } from '../data/types';
import { SPECIES } from '../domain/species';
import { isPetType } from '../domain/petType';

/** Per-rarity offset of the gacha band from the gacha *common* band. */
function rarityOffsets(): Record<Rarity, [number, number]> {
  const rarities = GAME_CONFIG.gacha.rarities;
  const common = rarities.find((r) => r.rarity === 'common')!.band;
  const out = {} as Record<Rarity, [number, number]>;
  for (const tier of rarities) {
    out[tier.rarity] = [tier.band[0] - common[0], tier.band[1] - common[1]];
  }
  return out;
}

/**
 * Build the full 4-rarity × 5-stat band table from a single base range.
 * Each rarity = base + that rarity's offset-from-common (from the gacha table),
 * clamped so min >= 0. All five stats share the rarity band (matches builtins).
 * base = gacha common reproduces bandsFromGacha() exactly, so an
 * omitted base yields builtin-identical stats.
 */
export function deriveStatBands(base: StatRange): Record<Rarity, Record<keyof BattleStats, StatRange>> {
  const offsets = rarityOffsets();
  const out = {} as Record<Rarity, Record<keyof BattleStats, StatRange>>;
  for (const rarity of Object.keys(offsets) as Rarity[]) {
    const [offMin, offMax] = offsets[rarity];
    const min = Math.max(0, base[0] + offMin);
    const max = Math.max(min, base[1] + offMax);
    const band: StatRange = [min, max];
    out[rarity] = { hp: band, atk: band, def: band, spd: band, luk: band };
  }
  return out;
}

type Row = Record<string, unknown>;

const s = (v: unknown): string => (v === undefined || v === null ? '' : String(v)).trim();
const n = (v: unknown): number => Number(v);
const b = (v: unknown): boolean => v === true || s(v).toLowerCase() === 'true';
const list = (v: unknown): string[] => s(v).split(',').map((x) => x.trim()).filter(Boolean);

const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/** Parse a `Pets` sheet into PetDefs. Tolerant: absent sheet → empty. Pure: no IO.
 *  Reports per-row SHAPE errors (prefixed `Pets row N:`); cross-catalog invariants
 *  (uniqueness, single starter, evolution chains) are validatePetDefs's job. */
export function parsePetsSheet(wb: XLSX.WorkBook): { defs: PetDef[]; errors: string[] } {
  const errors: string[] = [];
  const ws = wb.Sheets['Pets'];
  if (!ws) return { defs: [], errors: [] };
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Row[];

  const common = GAME_CONFIG.gacha.rarities.find((r) => r.rarity === 'common')!.band;
  const defs: PetDef[] = [];

  rows.forEach((r, i) => {
    const line = i + 2; // header is row 1
    const id = s(r['id']);
    const name = s(r['name']);
    if (!id) { errors.push(`Pets row ${line}: id is required`); return; }
    if (!name) errors.push(`Pets row ${line}: name is required`);

    const gen = n(r['gen']);
    const dexNo = n(r['dexNo']);
    if (!Number.isFinite(gen) || gen < 1) errors.push(`Pets row ${line}: gen must be a number >= 1`);
    if (!Number.isFinite(dexNo) || dexNo < 1) errors.push(`Pets row ${line}: dexNo must be a number >= 1`);

    const types = list(r['types']) as PetType[];
    if (types.length === 0) errors.push(`Pets row ${line}: types is required (>= 1, comma-separated)`);
    else for (const t of types) if (!isPetType(t)) errors.push(`Pets row ${line}: unknown type "${t}"`);

    const element = s(r['element']) as Species;
    if (!SPECIES.includes(element)) errors.push(`Pets row ${line}: element "${s(r['element'])}" must be one of ${SPECIES.join('/')}`);

    const hasMin = s(r['base_min']) !== '';
    const hasMax = s(r['base_max']) !== '';
    let base: StatRange = [common[0], common[1]];
    if (hasMin !== hasMax) errors.push(`Pets row ${line}: base_min and base_max must both be set or both empty`);
    else if (hasMin && hasMax) {
      const lo = n(r['base_min']); const hi = n(r['base_max']);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) errors.push(`Pets row ${line}: base_min/base_max must be numbers`);
      else if (lo < 0) errors.push(`Pets row ${line}: base_min must be >= 0`);
      else if (lo > hi) errors.push(`Pets row ${line}: base_min must be <= base_max`);
      else base = [lo, hi];
    }

    const rarityRaw = s(r['rarity']);
    if (rarityRaw && !RARITIES.includes(rarityRaw as Rarity)) errors.push(`Pets row ${line}: rarity "${rarityRaw}" must be one of ${RARITIES.join('/')}`);

    const def: PetDef = {
      id,
      name,
      gen,
      dexNo,
      types,
      element,
      statBands: deriveStatBands(base),
      enabled: s(r['enabled']) === '' ? true : b(r['enabled']),
      ...(b(r['starter']) ? { starter: true } : {}),
      ...(rarityRaw && RARITIES.includes(rarityRaw as Rarity) ? { rarity: rarityRaw as Rarity } : {}),
      ...(s(r['gachaObtainable']) !== '' ? { gachaObtainable: b(r['gachaObtainable']) } : {}),
      ...(s(r['evolvesFromId']) ? { evolvesFromId: s(r['evolvesFromId']) } : {}),
      ...(s(r['evolvesToId']) ? { evolvesToId: s(r['evolvesToId']) } : {}),
      ...(s(r['evolutionStage']) !== '' ? { evolutionStage: n(r['evolutionStage']) } : {}),
      ...(s(r['spriteDefault']) ? { sprite: { default: s(r['spriteDefault']) } } : {}),
    };
    defs.push(def);
  });

  return { defs, errors };
}

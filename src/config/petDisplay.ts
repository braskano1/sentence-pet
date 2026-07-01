// Shared pet display metadata — names, level labels, rarity styling, sprite/level helpers.
// Consumed by PetRoom, Gacha, Collection (and the upcoming B-3 battle UI). Keep display
// concerns here so a new species/rarity is a one-file change.
import type { BattleStats, PetInstance, PetStage, Rarity, Species } from '../data/types';
import { levelForXp, stageForXp } from '../domain/xp';
import { spriteSrc } from './sprites';
import { resolvePetDef } from '../domain/petDef';

/** Friendly, A1-readable pet name per species. */
export const PET_NAME: Record<Species, string> = { leaf: 'Sprout', fire: 'Ember', air: 'Breeze', water: 'Bubble' };

/** Element glyph per species (UI flavor; species IS the element). */
export const ELEMENT_EMOJI: Record<Species, string> = { leaf: '🍃', fire: '🔥', air: '💨', water: '💧' };

/** Battle stat display order: [label, key]. */
export const BATTLE_STAT_LABELS = [
  ['HP', 'hp'],
  ['ATK', 'atk'],
  ['DEF', 'def'],
  ['SPD', 'spd'],
  ['LUK', 'luk'],
] as const satisfies ReadonlyArray<readonly [string, keyof BattleStats]>;

/** Rarity → pill background + text classes (badges). */
export const RARITY_BADGE: Record<Rarity, string> = {
  common: 'bg-slate-200 text-slate-700',
  rare: 'bg-sky-200 text-sky-800',
  epic: 'bg-violet-200 text-violet-800',
  legendary: 'bg-amber-200 text-amber-800',
};

/** Rarity → ring color class (portrait rings). */
export const RARITY_RING: Record<Rarity, string> = {
  common: 'ring-slate-400',
  rare: 'ring-sky-400',
  epic: 'ring-violet-400',
  legendary: 'ring-amber-400',
};

/** Rarity → hex (SVG fill/stroke, e.g. the stat radar). */
export const RARITY_HEX: Record<Rarity, string> = {
  common: '#64748b',
  rare: '#0ea5e9',
  epic: '#8b5cf6',
  legendary: '#f59e0b',
};

/** Stage name labels for display. */
export const STAGE_NAME: Record<PetStage, string> = {
  egg: 'Egg',
  baby: 'Baby',
  young: 'Young',
  adult: 'Adult',
};

/** Zero-padded dex number badge, e.g. 3 -> "#003". */
export const formatDexNo = (n: number) => `#${String(n).padStart(3, '0')}`;

/** Displayed battle stats = creation roll + level-up growth. */
export function displayStats(pet: PetInstance): BattleStats {
  const g = pet.growth;
  const s = pet.stats;
  return { hp: s.hp + g.hp, atk: s.atk + g.atk, def: s.def + g.def, spd: s.spd + g.spd, luk: s.luk + g.luk };
}

/** Sum of all displayed stats. */
export function petPower(pet: PetInstance): number {
  const d = displayStats(pet);
  return d.hp + d.atk + d.def + d.spd + d.luk;
}

/** Highest displayed stat; ties broken by BATTLE_STAT_LABELS order. */
export function petSpecialty(pet: PetInstance): keyof BattleStats {
  const d = displayStats(pet);
  let best: keyof BattleStats = BATTLE_STAT_LABELS[0][1];
  for (const [, key] of BATTLE_STAT_LABELS) if (d[key] > d[best]) best = key;
  return best;
}

/** A pet's current display level. */
export function petLevel(pet: PetInstance): number {
  return levelForXp(pet.xp);
}

/** Display name: the custom name if set, otherwise the pet's authored Dex name.
 *  resolvePetDef reads the active catalog and never returns null (unknown id -> starter). */
export function petDisplayName(pet: PetInstance): string {
  return pet.name.trim() || resolvePetDef(pet.defId).name;
}

/** A pet's happy sprite at its current stage (eggs fall back to the baby sprite).
 *  Routes through spriteSrc so an owned pet shows its def's real art (as in the Dex);
 *  spriteSrc's element guard rejects a mismatched/fallback def, yielding plain element art. */
export function petStageSprite(pet: PetInstance): string {
  const stage = stageForXp(pet.xp, pet.hatched);
  const s = stage === 'egg' ? 'baby' : stage;
  return spriteSrc(pet.species, s, 'happy', resolvePetDef(pet.defId));
}

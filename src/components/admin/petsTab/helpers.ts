import type { BattleStats, PetDef, PetMood, PetStage, Rarity, StatRange } from '../../../data/types';

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export const STAT_KEYS: ReadonlyArray<keyof BattleStats> = ['hp', 'atk', 'def', 'spd', 'luk'];
export type VariantStage = Exclude<PetStage, 'egg'>;
export const VARIANT_STAGES: readonly VariantStage[] = ['baby', 'young', 'adult'];
export const MOODS: readonly PetMood[] = ['happy', 'sad'];

/** Set one rarity's [min,max] across all 5 stats (representative-band editor). */
export function setRarityBand(def: PetDef, rarity: Rarity, range: StatRange): PetDef {
  const band = {} as Record<keyof BattleStats, StatRange>;
  for (const stat of STAT_KEYS) band[stat] = range;
  return { ...def, statBands: { ...def.statBands, [rarity]: band } };
}

/** Remove `default` from a sprite override; collapse to undefined when nothing remains. */
export function stripDefault(sprite: PetDef['sprite']): PetDef['sprite'] {
  if (!sprite) return undefined;
  const { default: _omit, ...rest } = sprite;
  const hasVariants = rest.variants && Object.keys(rest.variants).length > 0;
  return hasVariants ? rest : undefined;
}

/** Immutably set variants[stage][mood] = url, preserving default and other cells. */
export function setVariant(sprite: PetDef['sprite'], stage: VariantStage, mood: PetMood, url: string): NonNullable<PetDef['sprite']> {
  const variants = { ...(sprite?.variants ?? {}) };
  variants[stage] = { ...(variants[stage] ?? {}), [mood]: url };
  return { ...sprite, variants };
}

/** Immutably remove variants[stage][mood]; drop an emptied stage; collapse empties (matches stripDefault). */
export function clearVariant(sprite: PetDef['sprite'], stage: VariantStage, mood: PetMood): PetDef['sprite'] {
  if (!sprite?.variants) return sprite;
  const variants = { ...sprite.variants };
  const stageMap = { ...(variants[stage] ?? {}) };
  delete stageMap[mood];
  if (Object.keys(stageMap).length) variants[stage] = stageMap;
  else delete variants[stage];
  const next: NonNullable<PetDef['sprite']> = { ...sprite };
  if (Object.keys(variants).length) next.variants = variants;
  else delete next.variants;
  if (!next.default && !next.variants) return undefined;
  return next;
}

/** Forward links (evolvesToId) win; back-pointers (evolvesFromId) are derived/reconciled. */
export function reconcileEvolution(defs: PetDef[]): PetDef[] {
  const byId = new Map(defs.map((d) => [d.id, { ...d }]));
  for (const d of byId.values()) {
    if (d.evolvesToId && byId.has(d.evolvesToId)) byId.get(d.evolvesToId)!.evolvesFromId = d.id;
  }
  // Second pass handles the reverse direction (a back-pointer with no matching forward
  // link sets the parent's forward link). validatePetDefs is the backstop for any
  // remaining multi-parent inconsistency the two passes can't reconcile.
  for (const d of byId.values()) {
    if (d.evolvesFromId && byId.has(d.evolvesFromId)) {
      const parent = byId.get(d.evolvesFromId)!;
      if (parent.evolvesToId !== d.id) parent.evolvesToId = d.id;
    }
  }
  return defs.map((d) => byId.get(d.id)!);
}

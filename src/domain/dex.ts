import type { PetDef, PetStage } from '../data/types';

/** Union `defId` into the caught set, preserving order and avoiding duplicates. */
export function addCaught(caught: readonly string[], defId: string): string[] {
  return caught.includes(defId) ? [...caught] : [...caught, defId];
}

/**
 * The ordered evolution chain (def-chain / Axis 2) containing `def`: walk
 * `evolvesFromId` back to the root, then `evolvesToId` forward. Cycle-guarded.
 * A def with no links returns `[def]`. Dangling refs simply terminate the walk.
 */
export function evolutionChain(def: PetDef, defs: readonly PetDef[]): PetDef[] {
  const byId = new Map(defs.map((d) => [d.id, d]));

  // Walk back to the root.
  let root = def;
  const seenBack = new Set<string>([root.id]);
  while (root.evolvesFromId) {
    const prev = byId.get(root.evolvesFromId);
    if (!prev || seenBack.has(prev.id)) break; // dangling or cycle
    seenBack.add(prev.id);
    root = prev;
  }

  // Walk forward from the root.
  const chain: PetDef[] = [root];
  const seenFwd = new Set<string>([root.id]);
  let cur = root;
  while (cur.evolvesToId) {
    const next = byId.get(cur.evolvesToId);
    if (!next || seenFwd.has(next.id)) break; // dangling or cycle
    seenFwd.add(next.id);
    chain.push(next);
    cur = next;
  }
  return chain;
}

/** Sprite stages that have per-species art (egg is generic). */
export type SpriteStage = Exclude<PetStage, 'egg'>; // 'baby' | 'young' | 'adult'

/**
 * The sprite stage for a node at `index` in a chain of `length`. The tip always
 * reads as the mature `adult` form and a lone creature is `adult`; the root is
 * `baby`; any interior node is `young`. Pure; the source of truth for dex art
 * stage (more reliable than the optional, author-supplied `evolutionStage`).
 */
export function stageForChainPosition(index: number, length: number): SpriteStage {
  if (length <= 1) return 'adult';
  if (index <= 0) return 'baby';
  if (index >= length - 1) return 'adult';
  return 'young';
}

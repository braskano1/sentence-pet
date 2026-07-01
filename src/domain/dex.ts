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

/** A node's resolved position within its chain. */
export interface ChainUnlock {
  def: PetDef;
  index: number;
}

/**
 * The highest-index node in `chain` present in `unlocked`, or null if none.
 * Drives the grid card's "latest stage seen/caught" art.
 */
export function latestUnlockedInChain(
  chain: readonly PetDef[],
  unlocked: ReadonlySet<string>,
): ChainUnlock | null {
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    if (unlocked.has(chain[i].id)) return { def: chain[i], index: i };
  }
  return null;
}

/**
 * Group defs into one ordered evolution chain per line, deduped by root and
 * sorted by the root's (gen, dexNo). Chains are walked over the full `defs`
 * list, so a disabled mid/late stage does not truncate a line; callers gate
 * line *visibility* (e.g. by `root.enabled`) themselves.
 */
export function dexLines(defs: readonly PetDef[]): PetDef[][] {
  const seenRoots = new Set<string>();
  const lines: PetDef[][] = [];
  for (const d of defs) {
    const chain = evolutionChain(d, defs);
    const root = chain[0];
    if (seenRoots.has(root.id)) continue;
    seenRoots.add(root.id);
    lines.push(chain);
  }
  return lines.sort((a, b) => a[0].gen - b[0].gen || a[0].dexNo - b[0].dexNo);
}

/**
 * Per-line progress for the Dex card badge: how many of a line's countable
 * (enabled) stages the player has caught, and how many there are. Renders as
 * "X/N". Disabled stages (`enabled === false`) are excluded from both the
 * numerator and denominator, mirroring the grid's enabled-gating so a
 * partially-disabled line can't show 2/3 when only 2 stages are visible.
 */
export function chainCaughtCount(
  chain: readonly PetDef[],
  caught: ReadonlySet<string>,
): { caught: number; total: number } {
  const countable = chain.filter((d) => d.enabled !== false);
  return {
    caught: countable.filter((d) => caught.has(d.id)).length,
    total: countable.length,
  };
}

/**
 * Group already-sorted dex lines into generation buckets for the gen-sectioned
 * Dex layout, keyed by the root's (`line[0]`) gen. Buckets are ordered by
 * ascending gen; within a bucket the incoming line order is preserved (callers
 * pass `dexLines(...)` output, already sorted by (gen, dexNo)). Empty input → [].
 */
export function linesByGen(lines: readonly PetDef[][]): Array<{ gen: number; lines: PetDef[][] }> {
  const byGen = new Map<number, PetDef[][]>();
  for (const line of lines) {
    const gen = line[0].gen;
    const bucket = byGen.get(gen);
    if (bucket) bucket.push(line);
    else byGen.set(gen, [line]);
  }
  return [...byGen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([gen, lns]) => ({ gen, lines: lns }));
}

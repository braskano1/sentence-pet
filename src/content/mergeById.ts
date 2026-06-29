export type MergeStatus = 'new' | 'updated' | 'unchanged';

export interface MergeChange<T> {
  id: string;
  status: MergeStatus;
  incoming: T;
  existing?: T;
}

export interface MergeResult<T> {
  /** Full resulting collection: existing order preserved, updates replaced in place, new appended. */
  merged: T[];
  /** One entry per incoming entity, in incoming order. */
  changes: MergeChange<T>[];
  counts: { new: number; updated: number; unchanged: number };
}

/** Deterministic JSON with object keys sorted recursively; arrays keep order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

const deepEqual = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

/**
 * Additive merge of `incoming` into `existing`, keyed by `getId`. Never deletes:
 * existing entities stay (in order), an incoming id that matches an existing one
 * replaces it (status `updated`, or `unchanged` if deep-equal), and a new id is
 * appended (status `new`). `changes` mirrors `incoming` order; `counts` summarises.
 */
export function mergeById<T>(
  existing: readonly T[],
  incoming: readonly T[],
  getId: (item: T) => string,
): MergeResult<T> {
  const existingById = new Map<string, T>();
  existing.forEach((e) => existingById.set(getId(e), e));

  const changes: MergeChange<T>[] = [];
  const incomingById = new Map<string, T>();
  for (const inc of incoming) {
    const cid = getId(inc);
    incomingById.set(cid, inc);
    const prev = existingById.get(cid);
    const status: MergeStatus = prev === undefined ? 'new' : deepEqual(prev, inc) ? 'unchanged' : 'updated';
    changes.push({ id: cid, status, incoming: inc, existing: prev });
  }

  const merged: T[] = existing.map((e) => incomingById.get(getId(e)) ?? e);
  for (const inc of incoming) {
    if (!existingById.has(getId(inc))) merged.push(inc);
  }

  const counts = changes.reduce(
    (acc, c) => { acc[c.status] += 1; return acc; },
    { new: 0, updated: 0, unchanged: 0 } as Record<MergeStatus, number>,
  );
  return { merged, changes, counts };
}

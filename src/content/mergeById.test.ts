import { describe, it, expect } from 'vitest';
import { mergeById, stableStringify } from './mergeById';

const id = (x: { id: string }) => x.id;

describe('mergeById', () => {
  it('classifies new / updated / unchanged by id and value', () => {
    const existing = [
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
    ];
    const incoming = [
      { id: 'b', v: 2 },   // unchanged (deep-equal)
    ].concat([
      { id: 'c', v: 3 },   // new
      { id: 'a', v: 5 },   // updated
    ]);
    const r = mergeById(existing, incoming, id);
    expect(r.counts).toEqual({ new: 1, updated: 1, unchanged: 1 });
    const byId = Object.fromEntries(r.changes.map((c) => [c.id, c.status]));
    expect(byId).toEqual({ b: 'unchanged', c: 'new', a: 'updated' });
  });

  it('merges additively: existing kept in order, updates replace, new appended, nothing deleted', () => {
    const existing = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
    const incoming = [{ id: 'a', v: 9 }, { id: 'c', v: 3 }];
    const r = mergeById(existing, incoming, id);
    expect(r.merged).toEqual([{ id: 'a', v: 9 }, { id: 'b', v: 2 }, { id: 'c', v: 3 }]);
  });

  it('deep-equals nested objects/arrays regardless of key order', () => {
    const existing = [{ id: 'a', meta: { x: 1, y: 2 }, tags: ['p', 'q'] }];
    const incoming = [{ id: 'a', tags: ['p', 'q'], meta: { y: 2, x: 1 } }];
    const r = mergeById(existing, incoming, id);
    expect(r.counts.unchanged).toBe(1);
    expect(r.counts.updated).toBe(0);
  });

  it('detects array-order changes as updates (itemIds order is meaningful)', () => {
    const existing = [{ id: 'a', itemIds: ['x', 'y'] }];
    const incoming = [{ id: 'a', itemIds: ['y', 'x'] }];
    expect(mergeById(existing, incoming, id).counts.updated).toBe(1);
  });

  it('returns existing unchanged and empty changes for empty incoming', () => {
    const existing = [{ id: 'a', v: 1 }];
    const r = mergeById(existing, [], id);
    expect(r.merged).toEqual(existing);
    expect(r.changes).toEqual([]);
    expect(r.counts).toEqual({ new: 0, updated: 0, unchanged: 0 });
  });
});

describe('stableStringify', () => {
  it('is invariant to object key order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });
  it('preserves array order (arrays are not sorted)', () => {
    expect(stableStringify(['x', 'y'])).not.toBe(stableStringify(['y', 'x']));
  });
  it('omits undefined object values, matching {} and distinguishing null', () => {
    expect(stableStringify({ a: undefined })).toBe(stableStringify({}));
    expect(stableStringify({ a: null })).not.toBe(stableStringify({}));
  });
  it('handles nested null and primitives', () => {
    expect(stableStringify({ a: { b: null }, c: 3 })).toBe('{"a":{"b":null},"c":3}');
  });
});

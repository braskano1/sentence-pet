import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ContentBundle } from './model';
import type { DrillItem } from '../data/types';

const item = (id: string): DrillItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

const liveBundle: ContentBundle = {
  pool: { a: item('a') },
  units: [{ id: 'u1', title: 'One', emoji: '🐣', order: 1, lessons: [
    { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
    { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['a'], isCheckpoint: true },
  ]}],
};

const fetchContent = vi.fn();
vi.mock('../firebase/content', () => ({ fetchContent: () => fetchContent() }));

import { cachedBundle, writeCache, hydrateContent, CACHE_KEY } from './load';
import { useContentStore } from './store';

describe('content load', () => {
  beforeEach(() => {
    localStorage.clear();
    fetchContent.mockReset();
    useContentStore.setState({ status: 'fallback' });
  });

  it('writeCache then cachedBundle round-trips a valid bundle', () => {
    writeCache(liveBundle);
    expect(cachedBundle()?.units[0].id).toBe('u1');
  });

  it('cachedBundle returns null for absent or invalid cache', () => {
    expect(cachedBundle()).toBeNull();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ pool: {}, units: [] })); // invalid (no units)
    expect(cachedBundle()).toBeNull();
  });

  it('hydrateContent swaps to a valid live bundle and caches it', async () => {
    fetchContent.mockResolvedValue(liveBundle);
    await hydrateContent();
    expect(useContentStore.getState().status).toBe('live');
    expect(useContentStore.getState().bundle.units[0].id).toBe('u1');
    expect(cachedBundle()?.units[0].id).toBe('u1');
  });

  it('hydrateContent keeps the current bundle when the live doc is invalid', async () => {
    fetchContent.mockResolvedValue({ pool: {}, units: [] }); // invalid
    const before = useContentStore.getState().bundle;
    await hydrateContent();
    expect(useContentStore.getState().status).toBe('fallback');
    expect(useContentStore.getState().bundle).toBe(before);
  });

  it('hydrateContent swallows fetch errors and keeps the current bundle', async () => {
    fetchContent.mockRejectedValue(new Error('offline'));
    await hydrateContent();
    expect(useContentStore.getState().status).toBe('fallback');
  });
});

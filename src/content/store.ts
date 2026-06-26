import { create } from 'zustand';
import type { ContentBundle } from './model';
import { SEED } from './seed';
import { cachedBundle } from './load';

export type ContentStatus = 'fallback' | 'live';

interface ContentState {
  bundle: ContentBundle;
  status: ContentStatus;
  setBundle: (bundle: ContentBundle, status: ContentStatus) => void;
}

/** Module-level store so both React components and gameStore actions read the
 *  active bundle synchronously. First paint = cached last-good ?? bundled SEED. */
export const useContentStore = create<ContentState>((set) => ({
  bundle: cachedBundle() ?? SEED,
  status: 'fallback',
  setBundle: (bundle, status) => set({ bundle, status }),
}));

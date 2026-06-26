import type { ContentBundle } from './model';
import { validateContent } from './validate';
import { fetchContent } from '../firebase/content';
import { useContentStore } from './store';

export const CACHE_KEY = 'sentence-pet-content';

/** Last-good bundle from localStorage, or null if absent/corrupt/invalid. */
export function cachedBundle(): ContentBundle | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContentBundle;
    return validateContent(parsed).ok ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist a known-good bundle as the last-good cache. */
export function writeCache(bundle: ContentBundle): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
  } catch {
    // quota / disabled storage — non-fatal
  }
}

/** Fetch live content; swap + cache only if valid. Errors/invalid → keep current bundle. */
export async function hydrateContent(): Promise<void> {
  try {
    const live = await fetchContent();
    if (validateContent(live).ok) {
      useContentStore.getState().setBundle(live, 'live');
      writeCache(live);
    }
  } catch {
    // offline / permission — keep fallback, never blank the game
  }
}

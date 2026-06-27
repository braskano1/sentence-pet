import { buyOwnable, type BuyOwnableResult } from './decor';
import type { MusicTrackItem } from './shop';

/** The free, pre-owned default overworld loop (played when `activeTrack === null`). */
export const DEFAULT_OVERWORLD_TRACK_URL = '/audio/overworld.mp3';

/**
 * Pure. Validates then applies a music-track purchase. No mutation.
 * Mirrors {@link buyDecor} — delegates to {@link buyOwnable}.
 */
export function buyMusic(
  state: { coins: number; owned: string[] },
  item: MusicTrackItem,
): BuyOwnableResult {
  return buyOwnable(state, item);
}

/**
 * Pure. Resolve the overworld loop url for the equipped track:
 * the catalog item whose `id === activeTrack`'s `src`, else the free default.
 * Unknown / null ids fall back to the default.
 */
export function overworldTrackUrl(
  activeTrack: string | null,
  catalog: MusicTrackItem[],
): string {
  if (activeTrack === null) return DEFAULT_OVERWORLD_TRACK_URL;
  return catalog.find((t) => t.id === activeTrack)?.src ?? DEFAULT_OVERWORLD_TRACK_URL;
}

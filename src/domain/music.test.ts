import { describe, expect, it } from 'vitest';
import { buyMusic, overworldTrackUrl, DEFAULT_OVERWORLD_TRACK_URL } from './music';
import type { MusicTrackItem } from './shop';

const lofi: MusicTrackItem = { id: 'music:lofi', name: 'Lo-Fi Lounge', kind: 'music', price: 150, src: '/audio/tracks/lofi.mp3' };
const jazz: MusicTrackItem = { id: 'music:jazz', name: 'Jazz Café', kind: 'music', price: 150, src: '/audio/tracks/jazz.mp3' };
const catalog = [lofi, jazz];

describe('buyMusic', () => {
  it('succeeds: decrements coins, appends id to owned (delegates to buyOwnable)', () => {
    expect(buyMusic({ coins: 200, owned: [] }, lofi)).toEqual({
      ok: true, coins: 50, owned: ['music:lofi'],
    });
  });

  it('rejects already-owned', () => {
    expect(buyMusic({ coins: 999, owned: ['music:lofi'] }, lofi)).toEqual({
      ok: false, reason: 'already-owned',
    });
  });

  it('rejects when unaffordable', () => {
    expect(buyMusic({ coins: 10, owned: [] }, lofi)).toEqual({
      ok: false, reason: 'insufficient-coins',
    });
  });

  it('does not mutate input state', () => {
    const state = { coins: 200, owned: [] as string[] };
    buyMusic(state, lofi);
    expect(state).toEqual({ coins: 200, owned: [] });
  });
});

describe('overworldTrackUrl', () => {
  it('null activeTrack → the free default url', () => {
    expect(overworldTrackUrl(null, catalog)).toBe(DEFAULT_OVERWORLD_TRACK_URL);
    expect(overworldTrackUrl(null, catalog)).toBe('/audio/overworld.mp3');
  });

  it('equipped track → its catalog src', () => {
    expect(overworldTrackUrl('music:lofi', catalog)).toBe('/audio/tracks/lofi.mp3');
    expect(overworldTrackUrl('music:jazz', catalog)).toBe('/audio/tracks/jazz.mp3');
  });

  it('unknown id → the free default url', () => {
    expect(overworldTrackUrl('music:nope', catalog)).toBe(DEFAULT_OVERWORLD_TRACK_URL);
  });
});

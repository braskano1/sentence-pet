import { describe, it, expect } from 'vitest';
import { toCloud, fromCloud, PERSIST_VERSION } from './mapping';
import type { PersistedState } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';
import type { PetInstance } from '../data/types';

function pet(id: string): PetInstance {
  return {
    id, defId: 'def-leaf', species: 'leaf', hatched: true, xp: 0, happiness: 50,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: 'common', name: '',
  };
}

const sample: PersistedState = {
  screen: 'petRoom', pets: [pet('a'), pet('b')], activePetId: 'a', coins: 7,
  courseComplete: { 'course-1': true },
  inventory: { protein: 1, veggie: 0, vitamin: 0, treat: 0 },
  selectedDrill: 'pattern', selectedLevel: 2, lastReward: null, lastPull: null,
  owned: ['bg1', 'music:lofi'], activeBackground: 'bg1', activeTrack: 'music:lofi',
  journey: { lessonStars: { 'u1-pattern': 3 } }, audio: defaultAudioSettings(),
  l1Mode: 'TH',
};

describe('mapping', () => {
  it('toCloud splits pets out of the profile and stamps the version', () => {
    const { profile, pets } = toCloud(sample);
    expect(pets).toHaveLength(2);
    expect(profile).not.toHaveProperty('pets');
    expect(profile.persistVersion).toBe(PERSIST_VERSION);
    expect(profile.coins).toBe(7);
  });

  it('fromCloud recombines into the persisted shape and drops persistVersion', () => {
    const restored = fromCloud(toCloud(sample));
    expect(restored).toEqual(sample);
    expect(restored).not.toHaveProperty('persistVersion');
  });
});

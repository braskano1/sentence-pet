import { describe, it, expect, vi } from 'vitest';
import { reconcileFromCloud } from './reconcile';
import { toCloud } from './mapping';
import type { PersistedState } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';
import type { PetInstance } from '../data/types';

function pet(id: string): PetInstance {
  return {
    id, species: 'leaf', hatched: true, xp: 0, happiness: 50,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: 'common', name: '',
  };
}
const cloudState: PersistedState = {
  screen: 'petRoom', pets: [pet('cloud')], activePetId: 'cloud', coins: 42,
  inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
  selectedDrill: 'pattern', selectedLevel: 1, lastReward: null, lastPull: null,
  owned: [], activeBackground: null, activeTrack: null, journey: { lessonStars: {} }, audio: defaultAudioSettings(),
  l1Mode: 'TH',
};

describe('reconcileFromCloud', () => {
  it('overwrites local state when a cloud save exists (cloud wins)', async () => {
    const applyState = vi.fn();
    const applied = await reconcileFromCloud({
      uid: 'u1', loadCloudSave: async () => toCloud(cloudState), applyState,
    });
    expect(applied).toBe(true);
    expect(applyState).toHaveBeenCalledWith(cloudState);
  });

  it('leaves local untouched when there is no cloud save', async () => {
    const applyState = vi.fn();
    const applied = await reconcileFromCloud({
      uid: 'u1', loadCloudSave: async () => null, applyState,
    });
    expect(applied).toBe(false);
    expect(applyState).not.toHaveBeenCalled();
  });
});

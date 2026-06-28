import { describe, it, expect, vi } from 'vitest';
import { startCloudSync, type SyncRepo } from './cloudSync';
import type { PersistedState } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';
import type { PetInstance } from '../data/types';

function pet(id: string, xp = 0): PetInstance {
  return {
    id, defId: 'def-leaf', species: 'leaf', hatched: true, xp, happiness: 50,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: 'common', name: '',
  };
}
function state(coins: number, pets: PetInstance[]): PersistedState {
  return {
    screen: 'petRoom', pets, activePetId: pets[0].id, coins,
    courseComplete: {},
    inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    selectedDrill: 'pattern', selectedLevel: 1, lastReward: null, lastPull: null,
    owned: [], activeBackground: null, activeTrack: null, journey: { lessonStars: {} }, audio: defaultAudioSettings(),
    l1Mode: 'TH', caughtDefIds: ['def-leaf'],
  };
}

/** A manual scheduler: captures the pending flush so the test fires it on demand. */
function manualScheduler() {
  let pending: (() => void) | null = null;
  return {
    schedule: (fn: () => void) => { pending = fn; return 1 as const; },
    cancel: () => { pending = null; },
    flush: () => { const p = pending; pending = null; p?.(); },
    hasPending: () => pending !== null,
  };
}

function fakeRepo() {
  const profile = vi.fn().mockResolvedValue(undefined);
  const petFn = vi.fn().mockResolvedValue(undefined);
  const repo: SyncRepo = { saveProfile: (_u, p) => profile(p), savePet: (_u, p) => petFn(p) };
  return { repo, profile, petFn };
}

describe('startCloudSync', () => {
  it('does an initial flush of profile + every pet on start', async () => {
    const cur = state(0, [pet('a'), pet('b')]);
    const sch = manualScheduler();
    const { repo, profile, petFn } = fakeRepo();
    startCloudSync({ uid: 'u1', getState: () => cur, subscribe: () => () => {}, repo, schedule: sch.schedule, cancel: sch.cancel });
    sch.flush();
    await Promise.resolve();
    expect(profile).toHaveBeenCalledTimes(1);
    expect(petFn).toHaveBeenCalledTimes(2);
  });

  it('coalesces rapid changes into a single flush and writes only changed docs', async () => {
    let cur = state(0, [pet('a'), pet('b')]);
    let listener = () => {};
    const sch = manualScheduler();
    const { repo, profile, petFn } = fakeRepo();
    startCloudSync({ uid: 'u1', getState: () => cur, subscribe: (l) => { listener = l; return () => {}; }, repo, schedule: sch.schedule, cancel: sch.cancel });
    sch.flush(); // initial
    await Promise.resolve();
    profile.mockClear(); petFn.mockClear();

    cur = state(5, [pet('a'), pet('b')]);
    listener();
    cur = state(5, [pet('a', 99), pet('b')]);
    listener();
    expect(sch.hasPending()).toBe(true);
    sch.flush();
    await Promise.resolve();
    expect(profile).toHaveBeenCalledTimes(1);
    expect(petFn).toHaveBeenCalledTimes(1);
    expect(petFn.mock.calls[0][0].id).toBe('a');
  });

  it('stop() cancels a pending flush', () => {
    let cur = state(0, [pet('a')]);
    let listener = () => {};
    const sch = manualScheduler();
    const { repo } = fakeRepo();
    const stop = startCloudSync({ uid: 'u1', getState: () => cur, subscribe: (l) => { listener = l; return () => {}; }, repo, schedule: sch.schedule, cancel: sch.cancel });
    sch.flush();
    cur = state(1, [pet('a')]);
    listener();
    expect(sch.hasPending()).toBe(true);
    stop();
    expect(sch.hasPending()).toBe(false);
  });
});

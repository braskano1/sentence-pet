import { describe, it, expect } from 'vitest';
import { useGameStore, selectPersisted, PERSIST_VERSION } from './gameStore';

describe('selectPersisted', () => {
  it('keeps the persisted data fields and drops transient + action fields', () => {
    const snap = selectPersisted(useGameStore.getState());
    const keys = Object.keys(snap).sort();
    expect(keys).toEqual(
      [
        'activeBackground', 'activePetId', 'coins', 'inventory', 'journey',
        'lastPull', 'lastReward', 'owned', 'pets', 'screen', 'selectedDrill', 'selectedLevel',
      ].sort(),
    );
    expect(snap).not.toHaveProperty('lastLevelUp');
    expect(snap).not.toHaveProperty('currentLessonId');
    for (const v of Object.values(snap)) expect(typeof v).not.toBe('function');
  });

  it('PERSIST_VERSION matches the persisted store version', () => {
    expect(PERSIST_VERSION).toBe(9);
  });
});

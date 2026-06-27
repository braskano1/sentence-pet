import { describe, it, expect } from 'vitest';
import { useGameStore, selectPersisted, PERSIST_VERSION } from './gameStore';

describe('selectPersisted', () => {
  it('keeps the persisted data fields and drops transient + action fields', () => {
    const snap = selectPersisted(useGameStore.getState());
    const keys = Object.keys(snap).sort();
    expect(keys).toEqual(
      [
        'activeBackground', 'activePetId', 'audio', 'coins', 'inventory', 'journey',
        'lastPull', 'lastReward', 'owned', 'pets', 'screen', 'selectedDrill', 'selectedLevel',
      ].sort(),
    );
    expect(snap).not.toHaveProperty('lastLevelUp');
    expect(snap).not.toHaveProperty('currentLessonId');
    for (const v of Object.values(snap)) expect(typeof v).not.toBe('function');
  });

  it('PERSIST_VERSION matches the persisted store version', () => {
    expect(PERSIST_VERSION).toBe(11);
  });

  it('includes audio, defaulting to a full unmuted mixer', () => {
    expect(selectPersisted(useGameStore.getState())).toHaveProperty('audio.master.level', 1);
    expect(selectPersisted(useGameStore.getState())).toHaveProperty('audio.allMuted', false);
  });

  it('covers exactly the persisted (non-transient, non-function) store fields — no drift vs partialize', () => {
    const full = useGameStore.getState() as unknown as Record<string, unknown>;
    // partialize keeps every field except these two transient ones; JSON serialization
    // drops the action functions. So the persisted DATA keys are:
    const persistedDataKeys = Object.keys(full)
      .filter((k) => typeof full[k] !== 'function')
      .filter((k) => k !== 'lastLevelUp' && k !== 'lastStageChange' && k !== 'currentLessonId')
      .sort();
    const selectedKeys = Object.keys(selectPersisted(useGameStore.getState())).sort();
    expect(selectedKeys).toEqual(persistedDataKeys);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';

describe('selectCourse', () => {
  beforeEach(() => useGameStore.setState({ screen: 'petRoom', currentCourseId: null } as never));
  it('sets currentCourseId and routes to the journey (pickDrill)', () => {
    useGameStore.getState().selectCourse('default');
    const s = useGameStore.getState();
    expect(s.currentCourseId).toBe('default');
    expect(s.screen).toBe('pickDrill');
  });
});

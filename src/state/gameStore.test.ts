// src/state/gameStore.test.ts  (add this describe block; keep existing imports/tests)
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { useContentStore } from '../content/store';
import { SEED_COURSE } from '../content/seedCourse';

describe('finishBoss course completion', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
    useContentStore.getState().setCourse(SEED_COURSE, 'fallback');
  });

  it('marks the active course complete when clearing a final boss', () => {
    useGameStore.setState({ currentCourseId: 'default', currentBossLessonId: 'final-course' });
    useGameStore.getState().finishBoss(true);
    expect(useGameStore.getState().courseComplete['default']).toBe(true);
  });

  it('does not complete the course when clearing a non-final boss', () => {
    useGameStore.setState({ currentCourseId: 'default', currentBossLessonId: 'gate-midcourse' });
    useGameStore.getState().finishBoss(true);
    expect(useGameStore.getState().courseComplete['default']).toBeUndefined();
  });

  it('does not complete on a loss', () => {
    useGameStore.setState({ currentCourseId: 'default', currentBossLessonId: 'final-course' });
    useGameStore.getState().finishBoss(false);
    expect(useGameStore.getState().courseComplete['default']).toBeUndefined();
  });
});

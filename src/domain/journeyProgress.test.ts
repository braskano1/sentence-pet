import { describe, it, expect } from 'vitest';
import type { Unit } from '../data/journey';
import { lessonCleared, unitProgress, isLessonUnlocked, isUnitUnlocked } from './journeyProgress';

const JOURNEY: Unit[] = [
  {
    id: 'a', title: 'A', emoji: '🐣', order: 1,
    lessons: [
      { id: 'a1', drill: 'pattern', level: 1 },
      { id: 'a2', drill: 'grammar', level: 1 },
      { id: 'a-ck', drill: 'mixed', level: 1, isCheckpoint: true },
    ],
  },
  {
    id: 'b', title: 'B', emoji: '🌱', order: 2,
    lessons: [
      { id: 'b1', drill: 'pattern', level: 2 },
      { id: 'b-ck', drill: 'mixed', level: 1, isCheckpoint: true },
    ],
  },
];
const unitA = JOURNEY[0];
const unitB = JOURNEY[1];

describe('lessonCleared', () => {
  it('is true iff the id is present in the stars map', () => {
    expect(lessonCleared({ a1: 3 }, 'a1')).toBe(true);
    expect(lessonCleared({ a1: 0 }, 'a1')).toBe(true); // 0 stars still cleared
    expect(lessonCleared({}, 'a1')).toBe(false);
  });
});

describe('unitProgress', () => {
  it('counts cleared lessons over total', () => {
    expect(unitProgress(unitA, { a1: 3 })).toEqual({ cleared: 1, total: 3 });
    expect(unitProgress(unitA, {})).toEqual({ cleared: 0, total: 3 });
  });
});

describe('isUnitUnlocked', () => {
  it('first unit is always unlocked', () => {
    expect(isUnitUnlocked(JOURNEY, unitA, {})).toBe(true);
  });
  it('later unit locked until previous unit checkpoint cleared', () => {
    expect(isUnitUnlocked(JOURNEY, unitB, {})).toBe(false);
    expect(isUnitUnlocked(JOURNEY, unitB, { a1: 3, a2: 3 })).toBe(false);
    expect(isUnitUnlocked(JOURNEY, unitB, { 'a-ck': 2 })).toBe(true);
  });
});

describe('isLessonUnlocked', () => {
  it('non-checkpoint lessons of an unlocked unit are all open', () => {
    expect(isLessonUnlocked(JOURNEY, unitA, unitA.lessons[0], {})).toBe(true);
    expect(isLessonUnlocked(JOURNEY, unitA, unitA.lessons[1], {})).toBe(true);
  });
  it('checkpoint locked until all non-checkpoint lessons cleared', () => {
    const ck = unitA.lessons[2];
    expect(isLessonUnlocked(JOURNEY, unitA, ck, {})).toBe(false);
    expect(isLessonUnlocked(JOURNEY, unitA, ck, { a1: 3 })).toBe(false);
    expect(isLessonUnlocked(JOURNEY, unitA, ck, { a1: 3, a2: 1 })).toBe(true);
  });
  it('nothing in a locked unit is unlocked', () => {
    expect(isLessonUnlocked(JOURNEY, unitB, unitB.lessons[0], {})).toBe(false);
  });
});

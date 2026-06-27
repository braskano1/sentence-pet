import { describe, it, expect } from 'vitest';
import { orderedUnits } from '../../content/model';
import { SEED } from '../../content/seed';
import {
  DRILL_LABEL, DRILL_TINT, foodEmoji, unitStars, currentLessonId, unitDone,
  serpentineOffset, lessonLabel,
} from './journeyView';

const units = orderedUnits(SEED);
const u1 = units[0]; // Basics

describe('journeyView helpers', () => {
  it('maps each drill to a display label and a food emoji', () => {
    expect(DRILL_LABEL.pattern).toBe('Sentence Pattern');
    expect(foodEmoji('pattern')).toBe('🥩');
    expect(foodEmoji('mixed')).toBe('🍰');
    expect(DRILL_TINT.grammar.bg).toMatch(/^bg-/);
  });

  it('sums a unit\'s earned stars', () => {
    const stars = { 'u1-pattern': 3, 'u1-wordchoice': 2 };
    expect(unitStars(u1, stars)).toBe(5);
    expect(unitStars(u1, {})).toBe(0);
  });

  it('currentLessonId is the first unlocked, not-cleared lesson in order', () => {
    expect(currentLessonId(units, {})).toBe('u1-pattern');
    expect(currentLessonId(units, { 'u1-pattern': 3 })).toBe('u1-wordchoice');
  });

  it('unitDone is true only when every lesson is cleared', () => {
    expect(unitDone(u1, {})).toBe(false);
    const all = Object.fromEntries(u1.lessons.map((l) => [l.id, 3]));
    expect(unitDone(u1, all)).toBe(true);
  });

  it('serpentineOffset cycles a 4-step pattern', () => {
    expect(serpentineOffset(0)).toBe(serpentineOffset(4));
    expect(serpentineOffset(0)).not.toBe(serpentineOffset(2));
  });

  it('lessonLabel preserves the existing aria phrasing', () => {
    expect(lessonLabel(u1, u1.lessons[0], {}, true)).toBe('Basics: pattern lesson, not started');
    expect(lessonLabel(u1, u1.lessons[0], { 'u1-pattern': 3 }, true)).toBe('Basics: pattern lesson, cleared, 3 stars');
    const cp = u1.lessons.find((l) => l.isCheckpoint)!;
    expect(lessonLabel(u1, cp, {}, false)).toBe('Basics: checkpoint, locked');
  });
});

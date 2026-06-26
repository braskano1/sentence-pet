import { describe, it, expect } from 'vitest';
import { devTestLoadout } from './testLoadout';

describe('devTestLoadout', () => {
  it('builds a returning-player progress snapshot', () => {
    const s = devTestLoadout({ clearedLessonIds: ['u1-l1', 'u1-l2'], rng: () => 0.5 });
    expect(s.screen).toBe('petRoom');
    expect(s.pets).toHaveLength(2);
    expect(s.pets.every((p) => p.hatched)).toBe(true);
    expect(s.activePetId).toBe(s.pets[0].id);
    expect(s.pets[0].xp).toBeGreaterThan(0); // mid-level, not a fresh egg
    expect(s.coins).toBe(500);
    expect(Object.values(s.inventory).every((n) => n > 0)).toBe(true);
    expect(s.journey.lessonStars).toEqual({ 'u1-l1': 3, 'u1-l2': 2 });
    expect(s.owned).toContain(s.activeBackground);
  });

  it('defaults to no cleared lessons', () => {
    expect(devTestLoadout().journey.lessonStars).toEqual({});
  });
});

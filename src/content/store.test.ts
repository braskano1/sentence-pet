import { describe, it, expect, beforeEach } from 'vitest';
import { useContentStore } from './store';
import { SEED_COURSE } from './seed';

describe('useContentStore bundle resolution', () => {
  beforeEach(() => {
    useContentStore.getState().setCourse(SEED_COURSE, 'fallback');
  });

  it('exposes synthetic boss units in the active bundle', () => {
    const units = useContentStore.getState().bundle.units;
    const ids = units.map((u) => u.id);
    expect(ids).toContain('boss-unit:gate-midcourse');
    expect(ids).toContain('boss-unit:final-course');
  });

  it('keeps the gated/final boss lessons findable as checkpoints', () => {
    const units = useContentStore.getState().bundle.units;
    const finalUnit = units.find((u) => u.id === 'boss-unit:final-course');
    expect(finalUnit?.lessons[0].isCheckpoint).toBe(true);
    expect(finalUnit?.lessons[0].onClear).toBe('completeCourse');
  });
});

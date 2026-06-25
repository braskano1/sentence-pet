import { describe, expect, it } from 'vitest';
import { DECOR_SPRITES } from './decorSprites';

describe('DECOR_SPRITES', () => {
  it('has all 7 rooms', () => {
    expect(Object.keys(DECOR_SPRITES)).toHaveLength(7);
  });

  it('every id is decor-namespaced and maps to a non-empty string', () => {
    for (const [id, sprite] of Object.entries(DECOR_SPRITES)) {
      expect(id.startsWith('decor:')).toBe(true);
      expect(typeof sprite).toBe('string');
      expect(sprite.length).toBeGreaterThan(0);
    }
  });
});

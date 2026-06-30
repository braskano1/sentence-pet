import { describe, it, expect } from 'vitest';
import { posClasses } from './posColors';

describe('posClasses', () => {
  it('maps known parts of speech to their hue', () => {
    expect(posClasses('Subject')).toContain('sky');
    expect(posClasses('Verb')).toContain('emerald');
    expect(posClasses('Object')).toContain('amber');
  });
  it('falls back to slate for unknown labels', () => {
    expect(posClasses('Adverb')).toContain('slate');
  });
});

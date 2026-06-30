import { describe, it, expect } from 'vitest';
import { posClasses } from './posColors';

describe('posClasses', () => {
  it('maps known parts of speech to their hue', () => {
    expect(posClasses('Subject')).toContain('sky');
    expect(posClasses('Verb')).toContain('emerald');
    expect(posClasses('Object')).toContain('amber');
    expect(posClasses('Be')).toContain('rose');
    expect(posClasses('Adjective')).toContain('violet');
    expect(posClasses('Not')).toContain('slate');
    expect(posClasses('Helper')).toContain('teal');
    expect(posClasses('Question')).toContain('orange');
    expect(posClasses('Place')).toContain('lime');
  });
  it('falls back to slate for unknown labels', () => {
    expect(posClasses('Adverb')).toContain('slate');
  });
});

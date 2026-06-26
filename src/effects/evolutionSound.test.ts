import { describe, it, expect, afterEach } from 'vitest';
import {
  soundAllowed, getEvolutionSound, setEvolutionSoundProvider, type EvolutionSound,
} from './evolutionSound';

describe('soundAllowed', () => {
  it('is true only when enabled and not reduced', () => {
    expect(soundAllowed(true, false)).toBe(true);
    expect(soundAllowed(false, false)).toBe(false);
    expect(soundAllowed(true, true)).toBe(false);
    expect(soundAllowed(false, true)).toBe(false);
  });
});

describe('getEvolutionSound', () => {
  afterEach(() => setEvolutionSoundProvider(null));

  it('returns a sound with all cues that never throw (silent in jsdom — no AudioContext)', () => {
    const s = getEvolutionSound();
    expect(() => { s.strobe(); s.flash(); s.reveal(); s.stop(); }).not.toThrow();
  });

  it('honors a swapped provider', () => {
    const calls: string[] = [];
    const fake: EvolutionSound = {
      strobe: () => calls.push('strobe'),
      flash: () => calls.push('flash'),
      reveal: () => calls.push('reveal'),
      stop: () => calls.push('stop'),
    };
    setEvolutionSoundProvider(() => fake);
    const s = getEvolutionSound();
    s.reveal();
    expect(calls).toEqual(['reveal']);
  });
});

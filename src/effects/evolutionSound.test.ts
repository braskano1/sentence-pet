import { describe, it, expect, afterEach } from 'vitest';
import {
  getEvolutionSound, setEvolutionSoundProvider, type EvolutionSound,
} from './evolutionSound';

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

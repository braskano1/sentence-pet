import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const sound = vi.hoisted(() => ({ strobe: vi.fn(), flash: vi.fn(), reveal: vi.fn(), stop: vi.fn() }));
vi.mock('../effects/evolutionSound', async (orig) => {
  const actual = await orig<typeof import('../effects/evolutionSound')>();
  return { ...actual, getEvolutionSound: () => sound };
});

import confetti from 'canvas-confetti';
import { EvolutionCinematic } from './EvolutionCinematic';
import { useGameStore } from '../state/gameStore';
import { SPRITES } from '../config/sprites';
import { TIMINGS } from '../hooks/useEvolutionSequence';
import { BUILTIN_PET_DEFS, setActivePetDefs } from '../domain/petDef';
import type { PetDef } from '../data/types';

beforeEach(() => {
  useGameStore.getState().resetForTest();
  Object.values(sound).forEach((f) => f.mockClear());
});
afterEach(() => vi.restoreAllMocks());

describe('EvolutionCinematic', () => {
  it('on skip shows the to-stage banner; Continue calls onDone and stops audio', () => {
    const onDone = vi.fn();
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={onDone} />);
    fireEvent.click(screen.getByTestId('evolution-stage')); // tap to skip
    expect(sound.stop).toHaveBeenCalled();
    expect(screen.getByText(/Young/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('plays the reveal cue when sound is on, not when off', () => {
    useGameStore.setState((s) => ({ audio: { ...s.audio, master: { ...s.audio.master, muted: false } } }));
    const { unmount } = render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByTestId('evolution-stage'));
    expect(sound.reveal).toHaveBeenCalled();
    unmount();

    Object.values(sound).forEach((f) => f.mockClear());
    useGameStore.setState((s) => ({ audio: { ...s.audio, master: { ...s.audio.master, muted: true } } }));
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByTestId('evolution-stage'));
    expect(sound.reveal).not.toHaveBeenCalled();
  });

  it('renders a sound toggle that flips master.muted', () => {
    useGameStore.setState((s) => ({ audio: { ...s.audio, master: { ...s.audio.master, muted: false } } }));
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /mute sound/i }));
    expect(useGameStore.getState().audio.master.muted).toBe(true);
  });

  it('stops in-flight audio when muted mid-sequence', () => {
    useGameStore.setState((s) => ({ audio: { ...s.audio, master: { ...s.audio.master, muted: false } } }));
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /mute sound/i }));
    expect(sound.stop).toHaveBeenCalled();
  });

  it('stops audio on unmount', () => {
    const { unmount } = render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    sound.stop.mockClear();
    unmount();
    expect(sound.stop).toHaveBeenCalled();
  });

  it('fires confetti once on reveal', () => {
    vi.mocked(confetti).mockClear();
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByTestId('evolution-stage')); // skip -> reveal
    expect(confetti).toHaveBeenCalledTimes(1);
  });
});

describe('EvolutionCinematic mystery silhouette (hatch)', () => {
  // Pin the catalog to the builtins so the mystery roll pool is deterministic and
  // immune to cross-test registry mutation.
  beforeEach(() => setActivePetDefs(BUILTIN_PET_DEFS));
  afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS));

  it('rolls a random BABY silhouette that does NOT reveal the real pet during the roll', () => {
    vi.useFakeTimers();
    try {
      // rng 0.3 -> floor(0.3*4)=1 -> 2nd obtainable root (fire); real species is 'leaf'
      render(
        <EvolutionCinematic
          from="egg" to="baby" species="leaf"
          mysterySilhouette rng={() => 0.3} onDone={() => {}}
        />,
      );
      act(() => { vi.advanceTimersByTime(TIMINGS.announce); }); // -> silhouette
      const img = screen.getByTestId('evolution-stage');
      // baby-stage silhouette of a different element, not the real pet's sprite
      expect(img.getAttribute('src')).toBe(SPRITES.fire.baby.happy);
      expect(img.getAttribute('src')).not.toBe(SPRITES.leaf.baby.happy);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still reveals the REAL pet at the end', () => {
    render(
      <EvolutionCinematic
        from="egg" to="baby" species="water"
        mysterySilhouette rng={() => 0} onDone={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('evolution-stage')); // skip -> reveal
    expect(screen.getByTestId('evolution-stage').getAttribute('src')).toBe(SPRITES.water.baby.happy);
  });

  it('rolls REAL per-def baby art (not just the 4 element sprites)', () => {
    vi.useFakeTimers();
    // A 5th obtainable leaf-root def with its own baby sprite override. It sits
    // last in obtainablePool([...builtins, mystery]) = [leaf,fire,air,water,mystery],
    // so rng ~1 indexes to it: floor(0.999*5)=4.
    const mystery: PetDef = {
      id: 'def-mystery',
      name: 'Mystery',
      gen: 1,
      dexNo: 99,
      types: ['leaf'],
      element: 'leaf',
      statBands: BUILTIN_PET_DEFS[0].statBands,
      enabled: true,
      sprite: { variants: { baby: { happy: 'https://cdn.test/mystery-baby.webp', sad: 'https://cdn.test/mystery-baby-sad.webp' } } },
    };
    try {
      setActivePetDefs([...BUILTIN_PET_DEFS, mystery]);
      render(
        <EvolutionCinematic
          from="egg" to="baby" species="water"
          mysterySilhouette rng={() => 0.999} onDone={() => {}}
        />,
      );
      act(() => { vi.advanceTimersByTime(TIMINGS.announce); }); // -> silhouette
      const img = screen.getByTestId('evolution-stage');
      // The rolled silhouette is the def's OWN baby art — impossible under the old
      // pickSpecies() code, which could only ever yield the 4 element sprites.
      expect(img.getAttribute('src')).toBe('https://cdn.test/mystery-baby.webp');
    } finally {
      vi.useRealTimers();
    }
  });

  it('WITHOUT the prop (evolution) the silhouette uses the REAL species (regression guard)', () => {
    vi.useFakeTimers();
    try {
      render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
      act(() => { vi.advanceTimersByTime(TIMINGS.announce); }); // -> silhouette shows from=baby leaf
      expect(screen.getByTestId('evolution-stage').getAttribute('src')).toBe(SPRITES.leaf.baby.happy);
    } finally {
      vi.useRealTimers();
    }
  });
});

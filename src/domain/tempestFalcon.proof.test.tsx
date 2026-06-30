import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ALL_PET_DEFS, BUILTIN_PET_DEFS, setActivePetDefs, getActivePetDefs } from './petDef';
import { spriteSrc } from '../config/sprites';
import { DexGrid } from '../components/DexGrid';
import { useGameStore } from '../state/gameStore';

const falcon = ALL_PET_DEFS.find((d) => d.id === 'def-tempest-falcon')!;

beforeEach(() => useGameStore.getState().resetForTest());
afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS)); // restore default catalog

describe('Tempest Falcon import (proof)', () => {
  it('exists with unique (gen, dexNo) and rare rarity', () => {
    expect(falcon).toBeTruthy();
    expect(falcon.gen).toBe(2);
    expect(falcon.rarity).toBe('rare');
    expect(ALL_PET_DEFS.filter((d) => d.gen === 2 && d.dexNo === 1)).toHaveLength(1);
  });

  it('resolves a distinct sprite per stage via the override', () => {
    const baby = spriteSrc('air', 'baby', 'happy', falcon);
    const young = spriteSrc('air', 'young', 'happy', falcon);
    const adult = spriteSrc('air', 'adult', 'happy', falcon);
    expect(baby).toContain('baby');
    expect(young).toContain('young');
    expect(adult).toContain('adult');
    expect(new Set([baby, young, adult]).size).toBe(3);
  });

  it('does not leak its art onto a non-air species (element guard)', () => {
    expect(spriteSrc('leaf', 'baby', 'happy', falcon)).not.toContain('tempest-falcon');
  });

  // End-to-end: the production path is admin save -> Firestore hydration ->
  // setActivePetDefs(...). Simulate that and confirm the Dex renders the new pet.
  it('appears live in the Dex after catalog hydration', () => {
    setActivePetDefs(ALL_PET_DEFS);
    expect(getActivePetDefs().some((d) => d.id === 'def-tempest-falcon')).toBe(true);
    render(<DexGrid />);
    expect(screen.getByText(/caught\s*1\s*\/\s*5/i)).toBeInTheDocument(); // 4 builtin lines + falcon
  });
});

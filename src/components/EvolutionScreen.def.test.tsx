import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the cinematic to expose the `def` prop the screen threads in. Isolated in
// its own file so the real-cinematic tests in EvolutionScreen.test.tsx stay intact.
vi.mock('./EvolutionCinematic', () => ({
  EvolutionCinematic: ({ def }: { def?: { id: string } }) => (
    <div data-testid="cinematic-def">{def?.id ?? 'none'}</div>
  ),
}));

import { EvolutionScreen } from './EvolutionScreen';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { resolvePetDef } from '../domain/petDef';

beforeEach(() => {
  useGameStore.getState().resetForTest();
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
});
afterEach(() => vi.restoreAllMocks());

describe('EvolutionScreen — custom sprite def', () => {
  it('passes the active pet resolved def to the cinematic', () => {
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, screen: 'evolution' });
    // Seed the active pet with a NON-starter built-in def. resolvePetDef falls back to
    // the starter (def-leaf) on a miss, so asserting against the starter can't tell
    // "threaded the real def" from "fell back". def-fire makes the assertion catch a regression.
    const activeId = selectActivePet(useGameStore.getState()).id;
    useGameStore.setState((s) => ({
      pets: s.pets.map((p) => (p.id === activeId ? { ...p, defId: 'def-fire' } : p)),
    }));
    const pet = selectActivePet(useGameStore.getState());
    const expected = resolvePetDef(pet.defId);
    expect(expected.id).toBe('def-fire'); // guard: confirm we seeded a real non-starter def

    render(<EvolutionScreen />);

    const got = screen.getByTestId('cinematic-def').textContent;
    expect(got).not.toBe('none');
    expect(got).toBe('def-fire');
  });
});

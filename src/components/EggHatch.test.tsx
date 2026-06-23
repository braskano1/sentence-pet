import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EggHatch } from './EggHatch';
import { useGameStore } from '../state/gameStore';

beforeEach(() => useGameStore.getState().resetForTest());

describe('EggHatch', () => {
  it('solving the first sentence hatches the pet', async () => {
    render(<EggHatch />);
    // first L1 item answer is ['I','run']
    for (const word of ['I', 'run']) {
      const btns = screen.getAllByRole('button', { name: word });
      await userEvent.click(btns[btns.length - 1]);
    }
    expect(useGameStore.getState().pet.hatched).toBe(true);
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});

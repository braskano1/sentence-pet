import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrillScreen } from './DrillScreen';
import { useGameStore } from '../state/gameStore';
import { itemsForLevel } from '../data/wordBank';

beforeEach(() => useGameStore.getState().resetForTest());

async function solveItem(answer: string[]) {
  for (const word of answer) {
    // there may be duplicate-looking buttons across slots/tray; pick from the tray region
    const buttons = screen.getAllByRole('button', { name: word });
    await userEvent.click(buttons[buttons.length - 1]);
  }
}

describe('DrillScreen', () => {
  it('solving all 5 items finishes the round and records xp', async () => {
    useGameStore.getState().hatch();
    render(<DrillScreen level={1} />);
    for (const item of itemsForLevel(1)) {
      await solveItem(item.answer);
    }
    const s = useGameStore.getState();
    expect(s.pet.xp).toBe(50);
    expect(s.lastReward?.food).toBe(5);
  });
});

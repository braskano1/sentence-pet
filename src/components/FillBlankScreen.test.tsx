import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FillBlankScreen } from './FillBlankScreen';
import { useGameStore } from '../state/gameStore';
import type { FillBlankItem } from '../data/types';

const items: FillBlankItem[] = [
  { id: 'b1', kind: 'fillblank', level: 1, template: 'I ___ rice.', answer: 'eat', l1: { th: 'กิน' } },
];

describe('FillBlankScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('hides Thai when L1 is off: first wrong tile tap shows the first-letter rung', () => {
    render(<FillBlankScreen items={items} unit={{ l1Enabled: false }} />);
    // No typed input — only word-bank tiles. Tap a wrong tile (the answer tile is "eat").
    const wrong = screen.getAllByRole('button').find(
      (b) => b.getAttribute('data-testid')?.startsWith('tile-') && b.textContent !== 'eat',
    )!;
    fireEvent.click(wrong);

    // L1 gate closed (l1Enabled: false) → first ladder step is first-letter, NOT Thai.
    expect(screen.getByText('e…')).toBeInTheDocument();
    expect(screen.queryByText('กิน')).not.toBeInTheDocument();
    // Still on the practice screen — no advance to reward.
    expect(useGameStore.getState().screen).toBe('egg');
  });

  it('shows Thai as first hint when L1 enabled and mode === TH (on a wrong tap)', () => {
    useGameStore.getState().setL1Mode('TH'); // default is 'TH', but be explicit
    render(<FillBlankScreen items={items} unit={{ l1Enabled: true }} />);
    const wrong = screen.getAllByRole('button').find(
      (b) => b.getAttribute('data-testid')?.startsWith('tile-') && b.textContent !== 'eat',
    )!;
    fireEvent.click(wrong);

    // L1 gate open → first ladder step is the Thai helper.
    expect(screen.getByText('กิน')).toBeInTheDocument();
    expect(useGameStore.getState().screen).toBe('egg');
  });

  it('a wrong tile disables and does not advance', () => {
    render(<FillBlankScreen items={items} unit={{ l1Enabled: false }} />);
    const wrong = screen.getAllByRole('button').find(
      (b) => b.getAttribute('data-testid')?.startsWith('tile-') && b.textContent !== 'eat',
    ) as HTMLButtonElement;
    fireEvent.click(wrong);

    expect(wrong).toBeDisabled();
    expect(useGameStore.getState().screen).toBe('egg');
  });

  it('finishes the round when the correct tile is tapped on the last item', () => {
    expect(useGameStore.getState().screen).toBe('egg');
    expect(useGameStore.getState().lastReward).toBeNull();

    render(<FillBlankScreen items={items} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByTestId('tile-eat'));

    expect(useGameStore.getState().screen).toBe('reward');
    expect(useGameStore.getState().lastReward).not.toBeNull();
  });
});

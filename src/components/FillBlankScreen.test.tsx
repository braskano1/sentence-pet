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

  it('shows an escalating hint on a wrong answer (no auto-advance)', () => {
    render(<FillBlankScreen items={items} unit={{ l1Enabled: false }} />);
    fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'drink' } });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));

    // First wrong attempt → first ladder step (the L1 helper).
    expect(screen.getByText('กิน')).toBeInTheDocument();
    // Still on the practice screen — no advance to reward.
    expect(useGameStore.getState().screen).toBe('egg');
  });

  it('finishes the round on a correct answer for the last item', () => {
    expect(useGameStore.getState().screen).toBe('egg');
    expect(useGameStore.getState().lastReward).toBeNull();

    render(<FillBlankScreen items={items} unit={{ l1Enabled: false }} />);
    fireEvent.change(screen.getByLabelText('answer'), { target: { value: '  eat ' } });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));

    expect(useGameStore.getState().screen).toBe('reward');
    expect(useGameStore.getState().lastReward).not.toBeNull();
  });
});

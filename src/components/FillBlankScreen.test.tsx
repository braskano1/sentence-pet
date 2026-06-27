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

  it('hides Thai when L1 is off: first wrong hint is the first-letter rung', () => {
    render(<FillBlankScreen items={items} unit={{ l1Enabled: false }} />);
    fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'drink' } });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));

    // L1 gate closed (l1Enabled: false) → first ladder step is first-letter, NOT Thai.
    expect(screen.getByText('e…')).toBeInTheDocument();
    expect(screen.queryByText('กิน')).not.toBeInTheDocument();
    // Still on the practice screen — no advance to reward.
    expect(useGameStore.getState().screen).toBe('egg');
  });

  it('shows Thai as first hint when L1 enabled and mode === TH', () => {
    useGameStore.getState().setL1Mode('TH'); // default is 'TH', but be explicit
    render(<FillBlankScreen items={items} unit={{ l1Enabled: true }} />);
    fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'drink' } });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));

    // L1 gate open → first ladder step is the Thai helper.
    expect(screen.getByText('กิน')).toBeInTheDocument();
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

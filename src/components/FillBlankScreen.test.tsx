import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const speech = vi.hoisted(() => ({
  speakWord: vi.fn(),
  speakThai: vi.fn(),
  speakSentence: vi.fn(),
}));
vi.mock('../hooks/useSpeech', () => ({ useSpeech: () => speech }));

import { FillBlankScreen } from './FillBlankScreen';
import { useGameStore } from '../state/gameStore';
import type { FillBlankItem } from '../data/types';

const items: FillBlankItem[] = [
  { id: 'b1', kind: 'fillblank', level: 1, template: 'I ___ rice.', answer: 'eat', l1: { th: 'กิน' } },
];

const twoItems: FillBlankItem[] = [
  { id: 'b1', kind: 'fillblank', level: 1, template: 'I ___ rice.', answer: 'eat', l1: { th: 'กิน' } },
  { id: 'b2', kind: 'fillblank', level: 1, template: 'You ___ tea.', answer: 'drink', l1: { th: 'ดื่ม' } },
];

describe('FillBlankScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
    speech.speakSentence.mockClear();
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

  it('shows the "Correct! ✓" beat and does NOT advance immediately on a correct tap', () => {
    vi.useFakeTimers();
    try {
      render(<FillBlankScreen items={items} unit={{ l1Enabled: false }} />);
      act(() => {
        fireEvent.click(screen.getByTestId('tile-eat'));
      });

      // Loud-on-success: emerald status banner is up.
      expect(screen.getByRole('status')).toHaveTextContent('Correct! ✓');
      // The completed sentence is spoken aloud.
      expect(speech.speakSentence).toHaveBeenCalledWith('I eat rice.');
      // But the round has NOT advanced yet — still on the practice screen.
      expect(useGameStore.getState().screen).toBe('egg');
      expect(useGameStore.getState().lastReward).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('finishes the round ~700ms after the correct tile is tapped on the last item', () => {
    vi.useFakeTimers();
    try {
      expect(useGameStore.getState().screen).toBe('egg');
      expect(useGameStore.getState().lastReward).toBeNull();

      render(<FillBlankScreen items={items} unit={{ l1Enabled: false }} />);
      act(() => {
        fireEvent.click(screen.getByTestId('tile-eat'));
      });
      // Still not finished during the beat.
      expect(useGameStore.getState().screen).toBe('egg');

      act(() => {
        vi.advanceTimersByTime(700);
      });

      expect(useGameStore.getState().screen).toBe('reward');
      expect(useGameStore.getState().lastReward).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('advances to the next item ~700ms after a correct tap (not the last item)', () => {
    vi.useFakeTimers();
    try {
      render(<FillBlankScreen items={twoItems} unit={{ l1Enabled: false }} />);
      // First item template visible.
      expect(screen.getByText('rice.', { exact: false })).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByTestId('tile-eat'));
      });
      expect(speech.speakSentence).toHaveBeenCalledWith('I eat rice.');

      act(() => {
        vi.advanceTimersByTime(700);
      });

      // Now on the second item, banner gone.
      expect(screen.getByText('tea.', { exact: false })).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(useGameStore.getState().screen).toBe('egg');
    } finally {
      vi.useRealTimers();
    }
  });
});

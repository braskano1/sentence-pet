import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlashcardScreen } from './FlashcardScreen';
import { useGameStore } from '../state/gameStore';
import type { FlashcardItem } from '../data/types';

const items: FlashcardItem[] = [
  { id: 'f1', kind: 'flashcard', level: 1, front: 'cat', back: 'แมว' },
  { id: 'f2', kind: 'flashcard', level: 1, front: 'dog', back: 'หมา' },
];

describe('FlashcardScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('flips to reveal back, then advances on Got it', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    expect(screen.getByText('cat')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    expect(screen.getByText('แมว')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.getByText('dog')).toBeInTheDocument();
  });

  it('finishes the round on Got it for the last card', () => {
    // After resetForTest the store is on the egg screen with no reward.
    expect(useGameStore.getState().screen).toBe('egg');
    expect(useGameStore.getState().lastReward).toBeNull();

    render(<FlashcardScreen items={[items[0]]} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));

    // finishRound flips the store to the reward screen and records a reward.
    expect(useGameStore.getState().screen).toBe('reward');
    expect(useGameStore.getState().lastReward).not.toBeNull();
  });
});

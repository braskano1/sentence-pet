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

  it('Again on the only card does NOT finish — it re-queues the card', () => {
    expect(useGameStore.getState().screen).toBe('egg');

    render(<FlashcardScreen items={[items[0]]} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /again/i }));

    // Still practicing the same card; nothing was completed.
    expect(useGameStore.getState().screen).toBe('egg');
    expect(useGameStore.getState().lastReward).toBeNull();
    expect(screen.getByText('cat')).toBeInTheDocument();
  });

  it('Again re-queues the front card to the back', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    // cat is front; "Again" sends it behind dog.
    fireEvent.click(screen.getByRole('button', { name: /again/i }));
    expect(screen.getByText('dog')).toBeInTheDocument();
    // Got it on dog removes it; cat (re-queued) comes back, round not finished.
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.getByText('cat')).toBeInTheDocument();
    expect(useGameStore.getState().screen).toBe('egg');
  });

  it('only completing every card via Got it finishes the round', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    // Re-queue cat, then clear the whole queue with Got it: dog, cat.
    fireEvent.click(screen.getByRole('button', { name: /again/i })); // cat → back; dog front
    fireEvent.click(screen.getByRole('button', { name: /got it/i })); // dog done; cat front
    expect(useGameStore.getState().screen).toBe('egg');
    fireEvent.click(screen.getByRole('button', { name: /got it/i })); // cat done; queue empty
    expect(useGameStore.getState().screen).toBe('reward');
    expect(useGameStore.getState().lastReward).not.toBeNull();
  });

  it('resets the flip when the front card changes', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    expect(screen.getByText('แมว')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    // New card shows its front (not carried-over flipped state).
    expect(screen.getByText('dog')).toBeInTheDocument();
    expect(screen.getByText('tap to flip')).toBeInTheDocument();
  });
});

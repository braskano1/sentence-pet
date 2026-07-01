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
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));

    // finishRound flips the store to the reward screen and records a reward.
    expect(useGameStore.getState().screen).toBe('reward');
    expect(useGameStore.getState().lastReward).not.toBeNull();
  });

  it('Again on the only card does NOT finish — it re-queues the card', () => {
    expect(useGameStore.getState().screen).toBe('egg');

    render(<FlashcardScreen items={[items[0]]} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    fireEvent.click(screen.getByRole('button', { name: /again/i }));

    // Still practicing the same card; nothing was completed.
    expect(useGameStore.getState().screen).toBe('egg');
    expect(useGameStore.getState().lastReward).toBeNull();
    expect(screen.getByText('cat')).toBeInTheDocument();
  });

  it('Again re-queues the front card to the back', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    // cat is front; "Again" sends it behind dog.
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    fireEvent.click(screen.getByRole('button', { name: /again/i }));
    expect(screen.getByText('dog')).toBeInTheDocument();
    // Got it on dog removes it; cat (re-queued) comes back, round not finished.
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.getByText('cat')).toBeInTheDocument();
    expect(useGameStore.getState().screen).toBe('egg');
  });

  it('only completing every card via Got it finishes the round', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    // Re-queue cat, then clear the whole queue with Got it: dog, cat.
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    fireEvent.click(screen.getByRole('button', { name: /again/i })); // cat → back; dog front
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    fireEvent.click(screen.getByRole('button', { name: /got it/i })); // dog done; cat front
    expect(useGameStore.getState().screen).toBe('egg');
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
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

  it('hides the grade row until the card is flipped', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    // Fresh card: grade buttons absent, flip hint present.
    expect(screen.queryByRole('button', { name: /again/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /got it/i })).toBeNull();
    expect(screen.getByText('tap to flip')).toBeInTheDocument();
    // After flipping, both grade buttons appear.
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    expect(screen.getByRole('button', { name: /again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
  });

  it('keeps the grade row open after flipping back to the front of the same card', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /flip/i })); // show back
    fireEvent.click(screen.getByRole('button', { name: /flip/i })); // back to front, same card
    // Already saw the back of THIS card — gate stays open.
    expect(screen.getByRole('button', { name: /again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
  });

  it('re-hides the grade row for the next card after Got it (gate reset)', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    fireEvent.click(screen.getByRole('button', { name: /got it/i })); // advance to dog
    expect(screen.getByText('dog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /again/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /got it/i })).toBeNull();
    expect(screen.getByText('tap to flip')).toBeInTheDocument();
  });

  it('re-hides the grade row for the next front card after Again (gate reset)', () => {
    render(<FlashcardScreen items={items} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    fireEvent.click(screen.getByRole('button', { name: /again/i })); // cat → back; dog front
    expect(screen.getByText('dog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /again/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /got it/i })).toBeNull();
    expect(screen.getByText('tap to flip')).toBeInTheDocument();
  });

  it('shows the back image with caption after flipping', () => {
    const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล', image: 'https://x/apple.png' } as const;
    render(<FlashcardScreen items={[item as any]} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByLabelText('flip card'));
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://x/apple.png');
    expect(img).toHaveAttribute('alt', 'แอปเปิล');
    expect(screen.getByText('แอปเปิล')).toBeInTheDocument(); // caption shown by default
  });

  it('shows image only (no caption word) when imageCaption is false', () => {
    const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล', image: 'https://x/apple.png', imageCaption: false } as const;
    render(<FlashcardScreen items={[item as any]} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByLabelText('flip card'));
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.queryByText('แอปเปิล')).toBeNull();
  });

  it('shows the back text when there is no image (unchanged behavior)', () => {
    const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล' } as const;
    render(<FlashcardScreen items={[item as any]} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByLabelText('flip card'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('แอปเปิล')).toBeInTheDocument();
  });

  it('falls back to the back text when the image fails to load', () => {
    const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล', image: 'https://x/broken.png' } as const;
    render(<FlashcardScreen items={[item as any]} unit={{ l1Enabled: false }} />);
    fireEvent.click(screen.getByLabelText('flip card'));
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('แอปเปิล')).toBeInTheDocument();
  });
});

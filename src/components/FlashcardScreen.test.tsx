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
});

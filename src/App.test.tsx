import { describe, it, expect, vi } from 'vitest';

// Mock heavy deps that are pulled in through App's import chain before
// importing the named export.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  MotionConfig: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...rest}>{children}</div>
    ),
  },
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('./firebase/content', () => ({
  saveContent: vi.fn(),
  fetchContent: vi.fn(),
}));

vi.mock('./auth/useAuth', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}));

import React from 'react';
import { screenKeyAndNode } from './App';
import type { DrillType, PosLabel } from './data/types';

const DRILL: DrillType = 'pattern';

describe('screenKeyAndNode — empty-items guard', () => {
  it('returns pickDrill (JourneyMap) when screen is drill but items is empty', () => {
    const result = screenKeyAndNode('drill', /* hatched */ true, DRILL, 1, []);
    expect(result.key).toBe('pickDrill');
  });

  it('returns drill key when screen is drill and items are non-empty', () => {
    const item = {
      id: 'x1',
      drill: DRILL,
      level: 1,
      thaiHint: 'test',
      slots: ['Pronoun' as PosLabel],
      answer: ['I'],
    };
    const result = screenKeyAndNode('drill', true, DRILL, 1, [item]);
    expect(result.key).toBe('drill');
  });
});

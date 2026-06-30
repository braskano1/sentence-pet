import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';

// dnd-kit drag is not reliably simulable in jsdom (no layout/coordinates), so we
// stub the transport ONLY: DndContext captures onDragEnd into a test-visible seam,
// letting us fire a synthetic drop that drives the REAL place()/grading logic.
// The draggable/droppable hooks become inert no-ops so the components still render.
const dnd = vi.hoisted(() => ({ onDragEnd: undefined as ((e: DragEndEvent) => void) | undefined }));
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd?: (e: DragEndEvent) => void }) => {
    dnd.onDragEnd = onDragEnd;
    return <div>{children}</div>;
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: () => [],
  useDraggable: () => ({ setNodeRef: () => {}, listeners: {}, attributes: {}, transform: null }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useSensor: () => ({}),
  useSensors: () => [],
  PointerSensor: function PointerSensor() {},
  TouchSensor: function TouchSensor() {},
  KeyboardSensor: function KeyboardSensor() {},
}));

import { gradeMatching, MatchingScreen } from './MatchingScreen';
import { useGameStore } from '../state/gameStore';
import type { MatchingItem } from '../data/types';

/** Fire a synthetic drop of prompt `left` onto target `right` through the real onDragEnd → place(). */
function drop(left: string, right: string) {
  act(() => {
    dnd.onDragEnd?.({ active: { id: left }, over: { id: right } } as unknown as DragEndEvent);
  });
}

describe('gradeMatching', () => {
  const pairs = [{ left: 'cat', right: 'แมว' }, { left: 'dog', right: 'หมา' }];
  it('all correct → done', () => {
    expect(gradeMatching(pairs, { cat: 'แมว', dog: 'หมา' })).toEqual({ done: true, wrong: [] });
  });
  it('reports wrong prompts, keeps correct', () => {
    expect(gradeMatching(pairs, { cat: 'หมา', dog: 'หมา' })).toEqual({ done: false, wrong: ['cat'] });
  });
  it('not done when unassigned', () => {
    expect(gradeMatching(pairs, { cat: 'แมว' })).toEqual({ done: false, wrong: [] });
  });
});

describe('MatchingScreen — wrong-placement feedback', () => {
  const item: MatchingItem = {
    id: 'm1', kind: 'matching', level: 1,
    pairs: [{ left: 'cat', right: 'AAA' }, { left: 'dog', right: 'BBB' }],
  };

  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('marks the dropped-on target slot with a gentle error treatment on a wrong drop', () => {
    render(<MatchingScreen items={[item]} unit={{ l1Enabled: false }} />);
    // Drop "cat" onto the WRONG slot "BBB" (cat's right is AAA).
    drop('cat', 'BBB');

    const slot = screen.getByTestId('target-BBB');
    expect(slot).toHaveClass('shake-wrong');
    expect(slot).toHaveClass('border-rose-400');
  });

  it('announces a polite "Try again" status to assistive tech on a wrong drop', () => {
    render(<MatchingScreen items={[item]} unit={{ l1Enabled: false }} />);
    drop('cat', 'BBB');

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Try again');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('clears the error treatment and "Try again" message ~600ms later', () => {
    vi.useFakeTimers();
    try {
      render(<MatchingScreen items={[item]} unit={{ l1Enabled: false }} />);
      drop('cat', 'BBB');
      expect(screen.getByTestId('target-BBB')).toHaveClass('shake-wrong');

      act(() => { vi.advanceTimersByTime(600); });

      expect(screen.getByTestId('target-BBB')).not.toHaveClass('shake-wrong');
      expect(screen.queryByText('Try again')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does NOT show the error treatment on a correct drop', () => {
    render(<MatchingScreen items={[item]} unit={{ l1Enabled: false }} />);
    drop('cat', 'AAA');

    expect(screen.getByTestId('target-AAA')).not.toHaveClass('shake-wrong');
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
  });

  it('selective-clear: a wrong drop clears the wrong tile but keeps it on the board, no advance', () => {
    render(<MatchingScreen items={[item]} unit={{ l1Enabled: false }} />);
    drop('cat', 'BBB');

    // The wrong tile was cleared → "cat" prompt is still draggable on the left.
    expect(screen.getByText('cat')).toBeInTheDocument();
    // No success beat, no advance.
    expect(screen.queryByText('Correct! ✓')).not.toBeInTheDocument();
  });

  it('a fully-correct round still shows the success beat and advances (unchanged)', () => {
    vi.useFakeTimers();
    try {
      render(<MatchingScreen items={[item]} unit={{ l1Enabled: false }} />);
      drop('cat', 'AAA');
      drop('dog', 'BBB');

      expect(screen.getByRole('status')).toHaveTextContent('Correct! ✓');
      expect(useGameStore.getState().screen).toBe('egg');

      act(() => { vi.advanceTimersByTime(700); });

      expect(useGameStore.getState().screen).toBe('reward');
    } finally {
      vi.useRealTimers();
    }
  });
});

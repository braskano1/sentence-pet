import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
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

    // The solved pair leaves the board (rolling window) — no error treatment fired:
    // its slot is gone and no remaining slot carries the wrong-placement shake.
    expect(screen.queryByTestId('target-AAA')).not.toBeInTheDocument();
    expect(document.querySelector('.shake-wrong')).toBeNull();
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

describe('MatchingScreen — rolling window (≤3 active pairs)', () => {
  // A 5-pair item: far past the working-memory limit if all shown at once.
  const five: MatchingItem = {
    id: 'm5', kind: 'matching', level: 1,
    pairs: [
      { left: 'a', right: 'A' },
      { left: 'b', right: 'B' },
      { left: 'c', right: 'C' },
      { left: 'd', right: 'D' },
      { left: 'e', right: 'E' },
    ],
  };

  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('shows only the first 3 unsolved pairs initially (3 prompts + 3 targets)', () => {
    render(<MatchingScreen items={[five]} unit={{ l1Enabled: false }} />);

    expect(screen.getAllByTestId(/^target-/)).toHaveLength(3);
    // First 3 prompts visible, pairs 4 & 5 hidden.
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
    expect(screen.queryByText('d')).not.toBeInTheDocument();
    expect(screen.queryByTestId('target-D')).not.toBeInTheDocument();
    expect(screen.queryByText('e')).not.toBeInTheDocument();
    expect(screen.queryByTestId('target-E')).not.toBeInTheDocument();
  });

  it('rolls the next hidden pair in when a visible pair is solved (still 3)', () => {
    render(<MatchingScreen items={[five]} unit={{ l1Enabled: false }} />);

    // Correctly match the first visible pair → it leaves, the 4th rolls in.
    drop('a', 'A');

    expect(screen.getAllByTestId(/^target-/)).toHaveLength(3);
    // Solved pair gone.
    expect(screen.queryByTestId('target-A')).not.toBeInTheDocument();
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    // Previously-hidden 4th pair now visible.
    expect(screen.getByTestId('target-D')).toBeInTheDocument();
    expect(screen.getByText('d')).toBeInTheDocument();
    // 5th still hidden.
    expect(screen.queryByTestId('target-E')).not.toBeInTheDocument();
  });

  it('shows all pairs when the item has ≤3 (no windowing regression)', () => {
    const two: MatchingItem = {
      id: 'm2', kind: 'matching', level: 1,
      pairs: [{ left: 'x', right: 'X' }, { left: 'y', right: 'Y' }],
    };
    render(<MatchingScreen items={[two]} unit={{ l1Enabled: false }} />);

    expect(screen.getAllByTestId(/^target-/)).toHaveLength(2);
    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByText('y')).toBeInTheDocument();
  });

  it('completion still requires ALL pairs across the rolling window', () => {
    vi.useFakeTimers();
    try {
      render(<MatchingScreen items={[five]} unit={{ l1Enabled: false }} />);

      // Solve every pair in order; the window keeps refilling.
      drop('a', 'A');
      drop('b', 'B');
      drop('c', 'C');
      // No success yet — d & e still outstanding.
      expect(screen.queryByText('Correct! ✓')).not.toBeInTheDocument();
      drop('d', 'D');
      expect(screen.queryByText('Correct! ✓')).not.toBeInTheDocument();
      drop('e', 'E');

      // Now every pair is matched → success beat fires, then finishes.
      expect(screen.getByRole('status')).toHaveTextContent('Correct! ✓');
      expect(useGameStore.getState().screen).toBe('egg');
      act(() => { vi.advanceTimersByTime(700); });
      expect(useGameStore.getState().screen).toBe('reward');
    } finally {
      vi.useRealTimers();
    }
  });

  it('wrong-placement feedback still works within the window', () => {
    render(<MatchingScreen items={[five]} unit={{ l1Enabled: false }} />);
    // Drop "a" onto wrong (visible) slot "B".
    drop('a', 'B');

    const slot = screen.getByTestId('target-B');
    expect(slot).toHaveClass('shake-wrong');
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });
});

describe('MatchingScreen — images (display-only)', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders an image on a prompt tile and a target slot when set, with alt = word', () => {
    const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
      { left: 'apple', right: 'A', leftImage: 'https://x/apple.png' },
      { left: 'ball', right: 'B', rightImage: 'https://x/b.png' },
    ] } as const;
    render(<MatchingScreen items={[item as any]} unit={{ l1Enabled: false }} />);
    const imgs = screen.getAllByRole('img');
    const srcs = imgs.map((i) => i.getAttribute('src'));
    expect(srcs).toContain('https://x/apple.png');
    expect(srcs).toContain('https://x/b.png');
    expect(screen.getByAltText('apple')).toBeInTheDocument();
  });

  it('hides the caption word on a side when its caption flag is false', () => {
    const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
      { left: 'apple', right: 'A', leftImage: 'https://x/apple.png', leftImageCaption: false },
      { left: 'ball', right: 'B' },
    ] } as const;
    render(<MatchingScreen items={[item as any]} unit={{ l1Enabled: false }} />);
    // 'apple' image present but the word 'apple' not shown as a caption
    expect(screen.getByAltText('apple')).toBeInTheDocument();
    expect(screen.queryByText('apple')).toBeNull();
  });

  it('falls back to text on a tile when its image fails to load', () => {
    const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
      { left: 'apple', right: 'A', leftImage: 'https://x/broken.png', leftImageCaption: false },
      { left: 'ball', right: 'B' },
    ] } as const;
    render(<MatchingScreen items={[item as any]} unit={{ l1Enabled: false }} />);
    fireEvent.error(screen.getByAltText('apple'));
    expect(screen.queryByAltText('apple')).toBeNull();
    expect(screen.getByText('apple')).toBeInTheDocument(); // text fallback
  });

  it('still grades correctly when images are present (display-only)', () => {
    const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
      { left: 'apple', right: 'A', leftImage: 'https://x/apple.png' },
      { left: 'ball', right: 'B' },
    ] } as const;
    render(<MatchingScreen items={[item as any]} unit={{ l1Enabled: false }} />);
    // drop apple→A (correct): the pair leaves the board; no "Try again"
    drop('apple', 'A');
    expect(screen.queryByText('Try again')).toBeNull();
  });
});

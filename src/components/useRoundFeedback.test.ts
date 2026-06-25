// src/components/useRoundFeedback.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../effects/celebrate', () => ({ fireConfetti: vi.fn(), buzz: vi.fn() }));
import { fireConfetti, buzz } from '../effects/celebrate';
import { useRoundFeedback } from './useRoundFeedback';

describe('useRoundFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('correct: sets feedback, fires confetti, calls onDone after 1100ms, then clears', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useRoundFeedback());

    act(() => result.current.play('correct', onDone));
    expect(result.current.feedback).toBe('correct');
    expect(result.current.locked).toBe(true);
    expect(fireConfetti).toHaveBeenCalledTimes(1);
    expect(buzz).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.feedback).toBeNull();
    expect(result.current.locked).toBe(false);
  });

  it('wrong: buzzes and calls onDone after 700ms', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useRoundFeedback());

    act(() => result.current.play('wrong', onDone));
    expect(result.current.feedback).toBe('wrong');
    expect(buzz).toHaveBeenCalledTimes(1);
    expect(fireConfetti).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(699);
    });
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.feedback).toBeNull();
  });

  it('cancels the pending callback when unmounted mid-hold', () => {
    const onDone = vi.fn();
    const { result, unmount } = renderHook(() => useRoundFeedback());

    act(() => result.current.play('correct', onDone));
    unmount();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('flag: fires confetti (soft accept), does not buzz, clears after hold', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useRoundFeedback());

    act(() => result.current.play('flag', onDone));
    expect(result.current.feedback).toBe('flag');
    expect(result.current.locked).toBe(true);
    expect(fireConfetti).toHaveBeenCalledTimes(1);
    expect(buzz).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.feedback).toBeNull();
    expect(result.current.locked).toBe(false);
  });
});

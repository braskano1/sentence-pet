import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEvolutionSequence, TIMINGS } from './useEvolutionSequence';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useEvolutionSequence', () => {
  it('advances announce -> silhouette -> strobe -> flash -> reveal -> done', () => {
    const { result } = renderHook(() => useEvolutionSequence({ reduced: false }));
    expect(result.current.phase).toBe('announce');
    act(() => { vi.advanceTimersByTime(TIMINGS.announce); });
    expect(result.current.phase).toBe('silhouette');
    act(() => { vi.advanceTimersByTime(TIMINGS.silhouette); });
    expect(result.current.phase).toBe('strobe');
    act(() => { vi.advanceTimersByTime(TIMINGS.strobe + TIMINGS.strobeStart); });
    expect(result.current.phase).toBe('flash');
    act(() => { vi.advanceTimersByTime(TIMINGS.flash); });
    expect(result.current.phase).toBe('reveal');
    act(() => { vi.advanceTimersByTime(TIMINGS.reveal); });
    expect(result.current.phase).toBe('done');
  });

  it('reduced motion goes announce -> reveal -> done with no strobe/flash', () => {
    const { result } = renderHook(() => useEvolutionSequence({ reduced: true }));
    expect(result.current.phase).toBe('announce');
    act(() => { vi.advanceTimersByTime(TIMINGS.announce); });
    expect(result.current.phase).toBe('reveal');
    act(() => { vi.advanceTimersByTime(TIMINGS.reveal); });
    expect(result.current.phase).toBe('done');
  });

  it('skip() jumps straight to reveal', () => {
    const { result } = renderHook(() => useEvolutionSequence({ reduced: false }));
    act(() => { result.current.skip(); });
    expect(result.current.phase).toBe('reveal');
  });
});

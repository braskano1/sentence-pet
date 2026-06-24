// src/effects/useCountUp.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from './useCountUp';

describe('useCountUp', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the initial target immediately', () => {
    const { result } = renderHook(({ t }) => useCountUp(t, 600), { initialProps: { t: 10 } });
    expect(result.current).toBe(10);
  });

  it('animates to a new target and lands exactly on it', () => {
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 600), { initialProps: { t: 0 } });
    rerender({ t: 100 });
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current).toBe(100);
  });

  it('is partway between old and new before the duration elapses', () => {
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 1000), { initialProps: { t: 0 } });
    rerender({ t: 100 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);
  });
});

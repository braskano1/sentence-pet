// src/effects/celebrate.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
import confetti from 'canvas-confetti';
import { fireConfetti, buzz, buzzError } from './celebrate';

describe('fireConfetti', () => {
  beforeEach(() => vi.clearAllMocks());
  it('calls canvas-confetti once', () => {
    fireConfetti();
    expect(confetti).toHaveBeenCalledTimes(1);
  });
});

describe('buzz', () => {
  afterEach(() => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
  });
  it('calls navigator.vibrate with the given duration when available', () => {
    const vibrate = vi.fn();
    (navigator as unknown as { vibrate: unknown }).vibrate = vibrate;
    buzz(50);
    expect(vibrate).toHaveBeenCalledWith(50);
  });
  it('no-ops when navigator.vibrate is unavailable', () => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
    expect(() => buzz()).not.toThrow();
  });
});

describe('buzzError', () => {
  afterEach(() => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
  });
  it('calls navigator.vibrate with a double-buzz pattern when available', () => {
    const vibrate = vi.fn();
    (navigator as unknown as { vibrate: unknown }).vibrate = vibrate;
    buzzError();
    expect(vibrate).toHaveBeenCalledWith([40, 30, 40]);
  });
  it('no-ops when navigator.vibrate is unavailable', () => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
    expect(() => buzzError()).not.toThrow();
  });
});

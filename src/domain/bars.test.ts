// src/domain/bars.test.ts
import { describe, it, expect } from 'vitest';
import { barColor } from './bars';

describe('barColor', () => {
  it('uses the healthy identity color at or above 30', () => {
    expect(barColor(30, 'bg-orange-500')).toBe('bg-orange-500');
    expect(barColor(100, 'bg-rose-500')).toBe('bg-rose-500');
  });
  it('warns amber below 30', () => {
    expect(barColor(29, 'bg-orange-500')).toBe('bg-amber-500');
    expect(barColor(15, 'bg-orange-500')).toBe('bg-amber-500');
  });
  it('alarms red below 15', () => {
    expect(barColor(14, 'bg-orange-500')).toBe('bg-red-500');
    expect(barColor(0, 'bg-rose-500')).toBe('bg-red-500');
  });
});

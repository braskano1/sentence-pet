import { describe, it, expect } from 'vitest';
import { clampPan, centerOffset, isOffscreen } from './panMath';

describe('panMath', () => {
  it('clampPan keeps y within [min, max]', () => {
    expect(clampPan(-50, -100, 0)).toBe(-50); // in range
    expect(clampPan(20, -100, 0)).toBe(0);     // above max
    expect(clampPan(-200, -100, 0)).toBe(-100); // below min
  });

  it('centerOffset centers an element and clamps at the bounds', () => {
    // el at world-top 500, height 100, viewport 600 -> want -(500 - (300-50)) = -250
    expect(centerOffset(500, 100, 600, -1000, 0)).toBe(-250);
    // element near the top -> want is positive -> clamped to max (0)
    expect(centerOffset(0, 100, 600, -1000, 0)).toBe(0);
    // element far down -> clamped to min
    expect(centerOffset(5000, 100, 600, -1000, 0)).toBe(-1000);
  });

  it('isOffscreen is true when the element is fully above/below the window', () => {
    expect(isOffscreen(700, 60, 0, 600)).toBe(true);   // below the window
    expect(isOffscreen(100, 60, 0, 600)).toBe(false);  // visible
    expect(isOffscreen(100, 60, -200, 600)).toBe(true); // panned up, now above
  });
});

/**
 * Pure pan-camera math for the Journey trail. `y` is the world's translateY:
 * 0 = top of the world at the top of the viewport; negative pans content up.
 * The valid range is [min, max] with max === 0 and min <= 0.
 */

/** Clamp a pan offset into [min, max]. */
export function clampPan(y: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, y));
}

/**
 * The clamped translateY that vertically centers an element of height `elHeight`
 * sitting at world-offset `elTop` within a viewport of `viewportHeight`.
 */
export function centerOffset(
  elTop: number,
  elHeight: number,
  viewportHeight: number,
  min: number,
  max: number,
): number {
  const want = -(elTop - (viewportHeight / 2 - elHeight / 2));
  return clampPan(want, min, max);
}

/**
 * Whether an element (world-offset `elTop`, height `elHeight`) is fully outside
 * the visible window given the current pan `y` and `viewportHeight`.
 */
export function isOffscreen(
  elTop: number,
  elHeight: number,
  y: number,
  viewportHeight: number,
): boolean {
  const top = elTop + y; // element top in viewport coordinates
  const bottom = top + elHeight;
  return bottom <= 0 || top >= viewportHeight;
}

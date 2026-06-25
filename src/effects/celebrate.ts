// src/effects/celebrate.ts
import confetti from 'canvas-confetti';

/** Fire a celebratory confetti burst from just below center. */
export function fireConfetti(): void {
  confetti({
    particleCount: 80,
    spread: 70,
    startVelocity: 35,
    origin: { y: 0.6 },
  });
}

/** Short haptic buzz on devices that support it; no-op otherwise. */
export function buzz(ms = 60): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
  }
}

/** Distinct error haptic (double buzz); no-op on unsupported devices. */
export function buzzError(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([40, 30, 40]);
  }
}

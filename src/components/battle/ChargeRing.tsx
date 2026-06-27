import { useReducedMotion } from 'framer-motion';

/** Boss charge-timer ring. `fraction` is 0..1; the ring sweeps and reddens as it fills. */
export function ChargeRing({ fraction }: { fraction: number }) {
  const reduced = useReducedMotion();
  const r = 16;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  const danger = f > 0.8;
  const stroke = danger ? '#ef4444' : f > 0.5 ? '#f59e0b' : '#fbbf24';
  return (
    <svg
      viewBox="0 0 40 40"
      className={`h-10 w-10 -rotate-90 ${danger && !reduced ? 'animate-pulse' : ''}`}
      aria-hidden
    >
      <circle cx="20" cy="20" r={r} fill="none" stroke="#0f172a" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - f)}
      />
    </svg>
  );
}

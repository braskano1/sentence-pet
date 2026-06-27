import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, animate } from 'framer-motion';
import { PressButton } from '../PressButton';
import { clampPan, centerOffset, isOffscreen } from './panMath';

interface PanViewportProps {
  /** Id of the focal node to center on (and a re-center trigger when it changes), or null. */
  currentId: string | null;
  /** Tailwind padding/classes for the inner pannable world. Defaults to the Journey trail's. */
  contentClassName?: string;
  children: React.ReactNode;
}

const SPRING = { type: 'spring' as const, stiffness: 260, damping: 30 };

/**
 * Drag-to-pan camera over a tall "world". Replaces native scroll: the viewport
 * clips, the world translates on Y via framer drag (momentum + rubber-band),
 * with auto-centering on the current node, a recenter button, wheel-to-pan,
 * keyboard-focus centering, and an instant path under reduced motion.
 */
export function PanViewport({ currentId, contentClassName = 'px-4 pb-10 pt-2', children }: PanViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const reduce = useReducedMotion();
  const [minY, setMinY] = useState(0);
  const [recenterVisible, setRecenterVisible] = useState(false);

  /** Re-measure the pan range; returns the viewport height + min offset. */
  const measure = useCallback(() => {
    const vp = viewportRef.current;
    const world = worldRef.current;
    if (!vp || !world) return { vph: 0, min: 0 };
    const vph = vp.clientHeight;
    const min = Math.min(0, vph - world.scrollHeight);
    setMinY(min);
    return { vph, min };
  }, []);

  /** Current node position within the world (translate-independent) + viewport height. */
  const currentMetrics = useCallback(() => {
    const vp = viewportRef.current;
    const world = worldRef.current;
    if (!vp || !world) return null;
    const el = world.querySelector<HTMLElement>('[data-current="true"]');
    if (!el) return null;
    const er = el.getBoundingClientRect();
    const wr = world.getBoundingClientRect();
    return { elTop: er.top - wr.top, elHeight: er.height, vph: vp.clientHeight };
  }, []);

  const moveTo = useCallback(
    (target: number, animated: boolean) => {
      if (animated && !reduce) animate(y, target, SPRING);
      else y.set(target);
    },
    [reduce, y],
  );

  const center = useCallback(
    (animated: boolean) => {
      const { vph, min } = measure();
      const m = currentMetrics();
      const target = m ? centerOffset(m.elTop, m.elHeight, vph, min, 0) : 0;
      moveTo(target, animated);
      setRecenterVisible(false);
    },
    [measure, currentMetrics, moveTo],
  );

  const refreshRecenter = useCallback(() => {
    const m = currentMetrics();
    setRecenterVisible(m ? isOffscreen(m.elTop, m.elHeight, y.get(), m.vph) : false);
  }, [currentMetrics, y]);

  // Center on the current node after first paint, and whenever it changes.
  useLayoutEffect(() => {
    center(false);
  }, [center, currentId]);

  // Re-measure on world resize (fold/expand, content changes) and re-clamp y.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const world = worldRef.current;
    if (!world) return;
    const ro = new ResizeObserver(() => {
      const { min } = measure();
      y.set(clampPan(y.get(), min, 0));
      refreshRecenter();
    });
    ro.observe(world);
    return () => ro.disconnect();
  }, [measure, refreshRecenter, y]);

  // Keep the recenter button in sync as the camera moves.
  useEffect(() => {
    const unsub = y.on('change', refreshRecenter);
    return () => unsub();
  }, [y, refreshRecenter]);

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    const { min } = measure();
    y.set(clampPan(y.get() - e.deltaY, min, 0));
  };

  // Keyboard tab: bring a focused off-screen node into view.
  const onFocusCapture: React.FocusEventHandler<HTMLDivElement> = (e) => {
    const vp = viewportRef.current;
    const world = worldRef.current;
    if (!vp || !world) return;
    const er = (e.target as HTMLElement).getBoundingClientRect();
    const wr = world.getBoundingClientRect();
    const elTop = er.top - wr.top;
    if (isOffscreen(elTop, er.height, y.get(), vp.clientHeight)) {
      const { min } = measure();
      moveTo(centerOffset(elTop, er.height, vp.clientHeight, min, 0), true);
    }
  };

  return (
    <div ref={viewportRef} onWheel={onWheel} className="relative h-full overflow-hidden">
      <motion.div
        ref={worldRef}
        style={{ y }}
        // Only draggable when the content overflows; firm bounds (no elastic
        // over-drag) so content can't be pulled past its edges into the fixed
        // header/footer.
        drag={minY < 0 ? 'y' : false}
        dragConstraints={{ top: minY, bottom: 0 }}
        dragElastic={0}
        dragMomentum={!reduce}
        onDragEnd={refreshRecenter}
        onFocusCapture={onFocusCapture}
        className={contentClassName}
      >
        {children}
      </motion.div>

      <PressButton
        onClick={() => center(true)}
        aria-label="Recenter on current lesson"
        aria-hidden={!recenterVisible}
        tabIndex={recenterVisible ? 0 : -1}
        className={`absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-opacity ${
          recenterVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        ↑ You are here
      </PressButton>
    </div>
  );
}

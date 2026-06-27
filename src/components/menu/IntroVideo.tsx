import { useEffect, useRef, useState } from 'react';
import { MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { INTRO_VIDEO_SRC, INTRO_VIDEO_WEBM, INTRO_VIDEO_POSTER } from '../../config/intro';
import { useAudio } from '../../hooks/useAudio';

/** Full-screen intro cutscene. Placeholder until INTRO_VIDEO_SRC is set. Skip / end / error → onDone. */
export function IntroVideo({ onDone }: { onDone: () => void }) {
  // Stop the title loop while the intro plays — the video has its own audio.
  const { setZone } = useAudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    setZone(null);
  }, [setZone]);

  // Autoplay with sound. The intro mounts after the tap-to-start gesture chain so
  // sound is usually allowed, but mobile Safari can still block it — retry muted so
  // the clip always plays, and offer a tap-to-unmute. Under reduced-motion we don't
  // autoplay at all (the <video controls> lets the player start it deliberately).
  useEffect(() => {
    if (!INTRO_VIDEO_SRC || prefersReduced) return;
    const v = videoRef.current;
    if (!v) return;
    const p = v.play?.();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        v.muted = true;
        setMuted(true);
        const p2 = v.play?.();
        if (p2 && typeof p2.catch === 'function') p2.catch(() => { /* give up; Skip / onEnded still work */ });
      });
    }
  }, [prefersReduced]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#0b1020] text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* warm horizon wash, echoing the title scene */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(120%_80%_at_50%_100%,rgba(251,191,36,0.25),transparent_70%)]" />
        {/* cinematic letterbox bars */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[8vh] bg-black" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[8vh] bg-black" />

        {INTRO_VIDEO_SRC ? (
          <video
            ref={videoRef}
            poster={INTRO_VIDEO_POSTER}
            playsInline
            autoPlay={!prefersReduced}
            muted={muted}
            controls={!!prefersReduced}
            onEnded={onDone}
            onError={onDone}
            data-testid="intro-video"
            className="max-h-full max-w-full"
          >
            <source src={INTRO_VIDEO_WEBM} type="video/webm" />
            <source src={INTRO_VIDEO_SRC} type="video/mp4" />
          </video>
        ) : (
          <motion.div
            className="relative flex flex-col items-center gap-4"
            data-testid="intro-placeholder"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          >
            <motion.span
              className="text-7xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
              animate={{ y: [0, -10, 0], rotate: [-3, 3, -3] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            >
              🐣
            </motion.span>
            <p className="text-base font-medium tracking-wide text-teal-50/90">
              Your adventure begins
              <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5 }}>…</motion.span>
            </p>
          </motion.div>
        )}

        {muted && (
          <motion.button
            type="button"
            onClick={() => {
              const v = videoRef.current;
              if (v) { v.muted = false; setMuted(false); }
            }}
            whileTap={{ scale: 0.95 }}
            className="absolute bottom-[10vh] left-6 z-10 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            🔇 Tap for sound
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={onDone}
          whileTap={{ scale: 0.95 }}
          className="absolute bottom-[10vh] right-6 z-10 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          Skip ▸
        </motion.button>
      </motion.div>
    </MotionConfig>
  );
}

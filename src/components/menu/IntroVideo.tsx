import { MotionConfig, motion } from 'framer-motion';
import { INTRO_VIDEO_SRC } from '../../config/intro';

/** Full-screen intro cutscene. Placeholder until INTRO_VIDEO_SRC is set. Skip or end → onDone. */
export function IntroVideo({ onDone }: { onDone: () => void }) {
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
          <video src={INTRO_VIDEO_SRC} autoPlay playsInline onEnded={onDone} className="max-h-full max-w-full" />
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

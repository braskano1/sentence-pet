import { INTRO_VIDEO_SRC } from '../../config/intro';

/** Full-screen intro cutscene. Placeholder until INTRO_VIDEO_SRC is set. Skip or end → onDone. */
export function IntroVideo({ onDone }: { onDone: () => void }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-slate-900 text-white">
      {INTRO_VIDEO_SRC ? (
        <video src={INTRO_VIDEO_SRC} autoPlay playsInline onEnded={onDone} className="max-h-full max-w-full" />
      ) : (
        <div className="flex flex-col items-center gap-3" data-testid="intro-placeholder">
          <span className="text-6xl">🎬</span>
          <p className="text-sm opacity-80">Your adventure begins…</p>
        </div>
      )}
      <button
        type="button"
        onClick={onDone}
        className="absolute bottom-6 right-6 rounded-full bg-white/15 px-4 py-2 text-sm"
      >
        Skip ▸
      </button>
    </div>
  );
}

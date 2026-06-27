import { motion } from 'framer-motion';
import { TitleLogo } from './TitleLogo';

/**
 * Hero title art — the "twilight hatch world".
 *
 * A deep-indigo night sky settles into a warm horizon glow; the hero egg sits
 * in that pool of light while the game's own atoms (parts-of-speech word tiles)
 * drift slowly behind it. Presentational only.
 *
 * `active` = this is the foreground title (show the TAP TO START hint + full
 * brightness). When the reveal sheet is open the scene becomes a dimmed
 * backdrop, so the hint is hidden and the parent overlay handles the dimming.
 *
 * Real pet/egg/logo art lands later via the partner's pipeline — the emoji hero
 * and the wordmark are the seam.
 */

/** Parts-of-speech tiles drifting in the backdrop. Color-coded by POS, like the game's tray. */
type Tile = { word: string; pos: 'noun' | 'verb' | 'adj' | 'fn'; x: number; y: number; delay: number; dur: number };

const TILES: Tile[] = [
  { word: 'dragon', pos: 'noun', x: 12, y: 16, delay: 0.0, dur: 7.5 },
  { word: 'jumps', pos: 'verb', x: 70, y: 12, delay: 0.8, dur: 8.5 },
  { word: 'brave', pos: 'adj', x: 78, y: 30, delay: 1.6, dur: 6.8 },
  { word: 'the', pos: 'fn', x: 46, y: 7, delay: 0.4, dur: 9.0 },
  { word: 'hero', pos: 'noun', x: 8, y: 60, delay: 1.1, dur: 7.8 },
  { word: 'runs', pos: 'verb', x: 82, y: 58, delay: 0.2, dur: 8.2 },
  { word: 'bright', pos: 'adj', x: 64, y: 72, delay: 1.4, dur: 7.2 },
  { word: 'a', pos: 'fn', x: 30, y: 78, delay: 0.6, dur: 9.4 },
];

const POS_STYLES: Record<Tile['pos'], string> = {
  noun: 'bg-sky-300/15 text-sky-100 ring-sky-200/20',
  verb: 'bg-emerald-300/15 text-emerald-100 ring-emerald-200/20',
  adj: 'bg-amber-300/15 text-amber-100 ring-amber-200/20',
  fn: 'bg-slate-200/10 text-slate-200 ring-slate-100/15',
};

export function TitleScene({ active = true }: { active?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#171a3a]">
      {/* Sky: deep indigo night settling onto a warm teal horizon */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#171a3a] via-[#243a6b] to-[#0f766e]" />
      {/* Sunrise glow pool behind the egg */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(120%_80%_at_50%_100%,rgba(251,191,36,0.45),rgba(45,212,191,0.18)_45%,transparent_70%)]" />

      {/* Drifting POS word-tiles — the game's atoms, alive in the backdrop */}
      <div aria-hidden className="absolute inset-0">
        {TILES.map((t) => (
          <motion.span
            key={t.word}
            className={`absolute select-none rounded-lg px-2.5 py-1 text-sm font-semibold tracking-wide ring-1 backdrop-blur-[2px] ${POS_STYLES[t.pos]}`}
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: [0, 1, 1, 0.85], y: [10, -10, 10] }}
            transition={{
              opacity: { duration: 1.2, delay: t.delay },
              y: { repeat: Infinity, repeatType: 'mirror', duration: t.dur, delay: t.delay, ease: 'easeInOut' },
            }}
          >
            {t.word}
          </motion.span>
        ))}
      </div>

      {/* Hero logo */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className="relative flex flex-col items-center">
          {/* breathing glow behind the logo */}
          <motion.div
            aria-hidden
            className="absolute h-56 w-56 rounded-full bg-amber-200/35 blur-3xl"
            animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.75, 0.45] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
          />
          <div className="relative">
            <TitleLogo />
          </div>
          <motion.p
            className="mt-4 text-sm font-medium leading-relaxed tracking-wide text-teal-50/80"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
          >
            Build a sentence. Hatch a pet.
            <br />
            Battle your friends.
          </motion.p>
        </div>
      </div>

      {/* Tap-to-start hint — only as the live foreground title */}
      {active && (
        <motion.div
          className="absolute inset-x-0 bottom-12 flex flex-col items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <motion.span
            className="text-base font-bold uppercase tracking-[0.25em] text-white"
            animate={{ opacity: [0.55, 1, 0.55], y: [0, -2, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          >
            Tap to start
          </motion.span>
          <motion.span
            className="text-xl text-amber-300"
            animate={{ y: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          >
            ▾
          </motion.span>
        </motion.div>
      )}
    </div>
  );
}

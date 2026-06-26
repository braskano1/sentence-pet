import { useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AppShell } from '../AppShell';
import { TitleScene } from './TitleScene';
import { SignUpForm } from '../account/SignUpForm';
import { SignInForm } from '../account/SignInForm';

type View = 'title' | 'choose' | 'signup' | 'signin';

const SPRING = { type: 'spring' as const, stiffness: 380, damping: 34 };

/**
 * Signed-out title screen — Direction B ("tap to start → reveal").
 *
 * The TitleScene is a persistent background layer. Tapping it dims the scene
 * and slides a sheet up from the bottom with New Game (sign up) / Continue
 * (sign in); the auth forms swap inside that same sheet. The scene never
 * unmounts, so the title art stays behind every step.
 */
export function MainMenu({ onSignedUp }: { onSignedUp: () => void }) {
  const [view, setView] = useState<View>('title');
  const isForm = view === 'signup' || view === 'signin';

  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        <div className="relative flex min-h-[100dvh] flex-col">
          <TitleScene active={view === 'title'} />

          {/* Full-surface tap target — only the live title accepts a tap-to-start */}
          <AnimatePresence>
            {view === 'title' && (
              <motion.button
                type="button"
                aria-label="Tap to start"
                onClick={() => setView('choose')}
                className="absolute inset-0 z-10 cursor-pointer"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </AnimatePresence>

          {/* Reveal: dim/blur scrim + slide-up sheet hosting choose / forms */}
          <AnimatePresence>
            {view !== 'title' && (
              <div className="absolute inset-0 z-20 flex flex-col justify-end">
                <motion.button
                  type="button"
                  aria-label="Close"
                  tabIndex={-1}
                  onClick={() => setView(isForm ? 'choose' : 'title')}
                  className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                />

                <motion.div
                  className="relative rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.35)]"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={SPRING}
                  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                  {/* grab handle */}
                  <div aria-hidden className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-slate-300" />

                  <AnimatePresence mode="wait" initial={false}>
                    {view === 'choose' && (
                      <motion.div
                        key="choose"
                        className="px-6 pb-8 pt-4"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h2 className="text-center text-2xl font-black text-slate-900">Ready to play?</h2>
                        <p className="mt-1 text-center text-sm text-slate-500">
                          New here? Start a new game. Coming back? Continue your adventure.
                        </p>
                        <div className="mt-6 flex flex-col gap-3">
                          <motion.button
                            type="button"
                            onClick={() => setView('signup')}
                            whileTap={{ scale: 0.97 }}
                            className="rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-black text-white shadow-lg shadow-emerald-500/30 transition-colors hover:bg-emerald-600"
                          >
                            New Game
                          </motion.button>
                          <motion.button
                            type="button"
                            onClick={() => setView('signin')}
                            whileTap={{ scale: 0.97 }}
                            className="rounded-2xl bg-amber-50 px-5 py-4 text-lg font-bold text-amber-900 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-100"
                          >
                            Continue
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {isForm && (
                      <motion.div
                        key="form"
                        className="px-5 pb-7 pt-2"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.2 }}
                      >
                        <button
                          type="button"
                          onClick={() => setView('choose')}
                          aria-label="Back"
                          className="-ml-1 mb-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                        >
                          ‹ Back
                        </button>
                        {view === 'signup'
                          ? <SignUpForm onDone={onSignedUp} />
                          : <SignInForm onDone={() => { /* routing flips on the auth change */ }} />}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </AppShell>
    </MotionConfig>
  );
}

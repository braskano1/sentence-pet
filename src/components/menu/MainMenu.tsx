import { useState } from 'react';
import { AppShell } from '../AppShell';
import { TitleScene } from './TitleScene';
import { SignUpForm } from '../account/SignUpForm';
import { SignInForm } from '../account/SignInForm';

type View = 'title' | 'choose' | 'signup' | 'signin';

/** Signed-out title screen: tap to start, then New Game (sign up) or Continue (sign in). */
export function MainMenu({ onSignedUp }: { onSignedUp: () => void }) {
  const [view, setView] = useState<View>('title');

  return (
    <AppShell>
      <div className="flex min-h-[100dvh] flex-col">
        {view === 'title' && (
          <button type="button" onClick={() => setView('choose')} aria-label="Tap to start" className="flex flex-1 flex-col">
            <TitleScene />
          </button>
        )}

        {view === 'choose' && (
          <div className="flex flex-1 flex-col justify-end gap-3 p-5">
            <button type="button" onClick={() => setView('signup')} className="rounded-2xl bg-emerald-500 px-4 py-4 text-lg font-black text-emerald-950 shadow">
              ▶ New Game
            </button>
            <button type="button" onClick={() => setView('signin')} className="rounded-2xl bg-amber-400 px-4 py-4 text-lg font-black text-amber-950 shadow">
              ↪ Continue
            </button>
          </div>
        )}

        {(view === 'signup' || view === 'signin') && (
          <div className="flex flex-1 flex-col justify-end">
            <button type="button" onClick={() => setView('choose')} aria-label="Back" className="m-3 self-start rounded-full border px-3 py-1">
              ‹ Back
            </button>
            {view === 'signup'
              ? <SignUpForm onDone={onSignedUp} />
              : <SignInForm onDone={() => { /* routing flips on the auth change */ }} />}
          </div>
        )}
      </div>
    </AppShell>
  );
}

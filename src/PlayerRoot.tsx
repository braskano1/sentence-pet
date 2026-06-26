import { useState } from 'react';
import { useAuth } from './auth/useAuth';
import { AppShell } from './components/AppShell';
import { MainMenu } from './components/menu/MainMenu';
import { IntroVideo } from './components/menu/IntroVideo';
import { DevPanel } from './components/DevPanel';
import App from './App';

/** Top-level player router: loading → splash, signed-out → menu, just-signed-up → intro, signed-in → game. */
export function PlayerRoot() {
  const { loading, isAnonymous } = useAuth();
  const [pendingIntro, setPendingIntro] = useState(false);

  const view = loading ? (
    <AppShell>
      <div className="flex flex-1 items-center justify-center text-5xl">🥚</div>
    </AppShell>
  ) : isAnonymous && !pendingIntro ? (
    <MainMenu onSignedUp={() => setPendingIntro(true)} />
  ) : pendingIntro ? (
    <IntroVideo onDone={() => setPendingIntro(false)} />
  ) : (
    <App />
  );

  // DEV-only cheat panel lives here (not inside App) so it is reachable on the
  // title/intro screens too — e.g. "VIEW AS" can sign you straight in.
  return (
    <>
      {view}
      {import.meta.env.DEV && <DevPanel />}
    </>
  );
}

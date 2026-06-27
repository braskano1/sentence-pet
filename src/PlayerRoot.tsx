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
  const [pendingIntro, setPendingIntro] = useState(false); // first run, right after a new-game sign-up
  const [replayIntro, setReplayIntro] = useState(false);   // explicit rewatch (menu link / in-game button)

  // The intro takes precedence over both menu and game so a rewatch overlays
  // whichever surface the player came from; on done we return to it.
  const showIntro = pendingIntro || replayIntro;
  const endIntro = () => { setPendingIntro(false); setReplayIntro(false); };

  const view = loading ? (
    <AppShell>
      <div className="flex flex-1 items-center justify-center text-5xl">🥚</div>
    </AppShell>
  ) : showIntro ? (
    <IntroVideo onDone={endIntro} />
  ) : isAnonymous ? (
    <MainMenu onSignedUp={() => setPendingIntro(true)} onReplayIntro={() => setReplayIntro(true)} />
  ) : (
    <App onReplayIntro={() => setReplayIntro(true)} />
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

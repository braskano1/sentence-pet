import { useState } from 'react';
import { useAuth } from './auth/useAuth';
import { AppShell } from './components/AppShell';
import { MainMenu } from './components/menu/MainMenu';
import { IntroVideo } from './components/menu/IntroVideo';
import { DevPanel } from './components/DevPanel';
import App from './App';

/** Top-level player router: loading → splash, signed-out → menu, just-signed-up
 *  or guest → intro then game, signed-in → game. */
export function PlayerRoot() {
  const { loading, isAnonymous } = useAuth();
  const [pendingIntro, setPendingIntro] = useState(false); // first run, right after new-game / play-as-guest
  const [replayIntro, setReplayIntro] = useState(false);   // explicit rewatch (menu link / in-game button)
  const [guestPlay, setGuestPlay] = useState(false);       // an anon chose "Play as guest"

  // The intro takes precedence over both menu and game so a rewatch overlays
  // whichever surface the player came from; on done we return to it.
  const showIntro = pendingIntro || replayIntro;
  const endIntro = () => { setPendingIntro(false); setReplayIntro(false); };

  // Anyone non-anon is in the game; an anon who picked "Play as guest" is too.
  // A fresh anon who hasn't chosen sees the menu. Sign-out/exit resets guestPlay
  // (see onExitToMenu) so a stale flag can't trap a fresh anon in the game.
  const inGame = !isAnonymous || guestPlay;

  const view = loading ? (
    <AppShell>
      <div className="flex flex-1 items-center justify-center text-5xl">🥚</div>
    </AppShell>
  ) : showIntro ? (
    <IntroVideo onDone={endIntro} />
  ) : inGame ? (
    <App
      onReplayIntro={() => setReplayIntro(true)}
      onExitToMenu={() => setGuestPlay(false)}
    />
  ) : (
    <MainMenu
      onSignedUp={() => setPendingIntro(true)}
      onPlayGuest={() => { setGuestPlay(true); setPendingIntro(true); }}
      onReplayIntro={() => setReplayIntro(true)}
    />
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

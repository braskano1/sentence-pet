import { useState } from 'react';
import { useAuth } from './auth/useAuth';
import { AppShell } from './components/AppShell';
import { MainMenu } from './components/menu/MainMenu';
import { IntroVideo } from './components/menu/IntroVideo';
import App from './App';

/** Top-level player router: loading → splash, signed-out → menu, just-signed-up → intro, signed-in → game. */
export function PlayerRoot() {
  const { loading, isAnonymous } = useAuth();
  const [pendingIntro, setPendingIntro] = useState(false);

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center text-5xl">🥚</div>
      </AppShell>
    );
  }
  if (isAnonymous) {
    return <MainMenu onSignedUp={() => setPendingIntro(true)} />;
  }
  if (pendingIntro) {
    return <IntroVideo onDone={() => setPendingIntro(false)} />;
  }
  return <App />;
}

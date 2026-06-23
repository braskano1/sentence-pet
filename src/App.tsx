import { useGameStore } from './state/gameStore';
import { AppShell } from './components/AppShell';
import { EggHatch } from './components/EggHatch';
import { PetRoom } from './components/PetRoom';
import { DrillScreen } from './components/DrillScreen';
import { RewardScreen } from './components/RewardScreen';

function CurrentScreen() {
  const screen = useGameStore((s) => s.screen);
  const hatched = useGameStore((s) => s.pet.hatched);

  if (!hatched) return <EggHatch />;
  switch (screen) {
    case 'drill': return <DrillScreen level={1} />;
    case 'reward': return <RewardScreen />;
    case 'petRoom':
    default: return <PetRoom />;
  }
}

export default function App() {
  return (
    <AppShell>
      <CurrentScreen />
    </AppShell>
  );
}

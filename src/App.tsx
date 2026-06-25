import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useGameStore, selectActivePet } from './state/gameStore';
import { AppShell } from './components/AppShell';
import { EggHatch } from './components/EggHatch';
import { PetRoom } from './components/PetRoom';
import { DrillScreen } from './components/DrillScreen';
import { RewardScreen } from './components/RewardScreen';
import { DrillPicker } from './components/DrillPicker';
import { Shop } from './components/Shop';
import { DevPanel } from './components/DevPanel';
import type { DrillType } from './data/types';

function screenKeyAndNode(screen: string, hatched: boolean, drill: DrillType, level: number) {
  if (!hatched) return { key: 'egg', node: <EggHatch /> };
  switch (screen) {
    case 'pickDrill': return { key: 'pickDrill', node: <DrillPicker /> };
    case 'drill': return { key: 'drill', node: <DrillScreen drill={drill} level={level} /> };
    case 'reward': return { key: 'reward', node: <RewardScreen /> };
    case 'shop': return { key: 'shop', node: <Shop /> };
    case 'petRoom':
    default: return { key: 'petRoom', node: <PetRoom /> };
  }
}

function CurrentScreen() {
  const screen = useGameStore((s) => s.screen);
  const hatched = useGameStore((s) => selectActivePet(s).hatched);
  const drill = useGameStore((s) => s.selectedDrill);
  const level = useGameStore((s) => s.selectedLevel);
  const { key, node } = screenKeyAndNode(screen, hatched, drill, level);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        className="flex flex-1 flex-col"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        {node}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        <CurrentScreen />
      </AppShell>
      {import.meta.env.DEV && <DevPanel />}
    </MotionConfig>
  );
}

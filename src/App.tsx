import { useMemo } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useGameStore, selectActivePet } from './state/gameStore';
import { AppShell } from './components/AppShell';
import { EggHatch } from './components/EggHatch';
import { PetRoom } from './components/PetRoom';
import { DrillScreen } from './components/DrillScreen';
import { RewardScreen } from './components/RewardScreen';
import { JourneyMap } from './components/JourneyMap';
import { Shop } from './components/Shop';
import { Gacha } from './components/Gacha';
import { Collection } from './components/Collection';
import { DevPanel } from './components/DevPanel';
import { AccountButton } from './components/account/AccountButton';
import type { DrillItem, DrillType } from './data/types';
import { useContentStore } from './content/store';
import { findLesson, itemsForLesson, itemsForDrill } from './content/model';

export function screenKeyAndNode(screen: string, hatched: boolean, drill: DrillType, level: number, items: DrillItem[]) {
  if (!hatched) return { key: 'egg', node: <EggHatch /> };
  switch (screen) {
    case 'pickDrill': return { key: 'pickDrill', node: <JourneyMap /> };
    case 'drill':
      return items.length === 0
        ? { key: 'pickDrill', node: <JourneyMap /> }
        : { key: 'drill', node: <DrillScreen items={items} drill={drill} level={level} /> };
    case 'reward': return { key: 'reward', node: <RewardScreen /> };
    case 'shop': return { key: 'shop', node: <Shop /> };
    case 'gacha': return { key: 'gacha', node: <Gacha /> };
    case 'collection': return { key: 'collection', node: <Collection /> };
    case 'petRoom':
    default: return { key: 'petRoom', node: <PetRoom /> };
  }
}

function CurrentScreen() {
  const screen = useGameStore((s) => s.screen);
  const hatched = useGameStore((s) => selectActivePet(s).hatched);
  const drill = useGameStore((s) => s.selectedDrill);
  const level = useGameStore((s) => s.selectedLevel);
  const bundle = useContentStore((s) => s.bundle);
  const currentLessonId = useGameStore((s) => s.currentLessonId);
  const lesson = currentLessonId ? findLesson(bundle, currentLessonId)?.lesson : undefined;
  const items = useMemo(
    () => (lesson ? itemsForLesson(bundle, lesson) : itemsForDrill(bundle, drill, level)),
    [bundle, lesson, drill, level],
  );
  const { key, node } = screenKeyAndNode(screen, hatched, drill, level, items);

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
        <div className="px-3 pt-2"><AccountButton /></div>
        <CurrentScreen />
      </AppShell>
      {import.meta.env.DEV && <DevPanel />}
    </MotionConfig>
  );
}

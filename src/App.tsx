import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useGameStore, selectActivePet } from './state/gameStore';
import { useAudio } from './hooks/useAudio';
import type { Zone } from './effects/music';
import { AppShell } from './components/AppShell';
import { EggHatch } from './components/EggHatch';
import { PetRoom } from './components/PetRoom';
import { DrillScreen } from './components/DrillScreen';
import { RewardScreen } from './components/RewardScreen';
import { EvolutionScreen } from './components/EvolutionScreen';
import { JourneyMap } from './components/JourneyMap';
import { Shop } from './components/Shop';
import { Gacha } from './components/Gacha';
import { Collection } from './components/Collection';
import { BossPrepScreen } from './components/battle/BossPrepScreen';
import { BattleScreen } from './components/battle/BattleScreen';
import { SettingsSheet } from './components/SettingsSheet';
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
    case 'evolution': return { key: 'evolution', node: <EvolutionScreen /> };
    case 'shop': return { key: 'shop', node: <Shop /> };
    case 'gacha': return { key: 'gacha', node: <Gacha /> };
    case 'collection': return { key: 'collection', node: <Collection /> };
    case 'bossPrep': return { key: 'bossPrep', node: <BossPrepScreen /> };
    case 'battle': return { key: 'battle', node: <BattleScreen /> };
    case 'petRoom':
    default: return { key: 'petRoom', node: <PetRoom /> };
  }
}

/**
 * Pure mapping from a resolved screen key (+ checkpoint flag) to a music Zone.
 * The overworld screens share one seamless loop (same-zone setZone is a no-op),
 * while drill/boss/title crossfade. `null` stops music (evolution cinematic; the
 * reward screen, where the cleared/win/lose sting plays instead). Unknown keys
 * fall back to overworld.
 */
export function zoneForScreen(key: string, isCheckpoint: boolean): Zone | null {
  switch (key) {
    case 'egg':
      return 'title';
    case 'drill':
      return isCheckpoint ? 'boss' : 'drill';
    case 'bossPrep':
    case 'battle':
      return 'boss';
    case 'evolution':
      return null; // stop music during the cinematic; overworld resumes after
    case 'reward':
      return null; // no overworld loop on level-cleared; the sting plays instead
    case 'pickDrill':
    case 'petRoom':
    case 'shop':
    case 'gacha':
    case 'collection':
      return 'overworld';
    default:
      return 'overworld';
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

  const { setZone } = useAudio();
  const zone = zoneForScreen(key, !!lesson?.isCheckpoint);
  useEffect(() => {
    setZone(zone);
  }, [zone, setZone]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        className="flex flex-1 flex-col min-h-0"
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

export default function App({ onReplayIntro, onExitToMenu }: { onReplayIntro?: () => void; onExitToMenu?: () => void } = {}) {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        {/* Global settings entry — a persistent chrome slot, identical on every
            screen. Pinned to the top-center notch, the one band left clear by
            every screen's HUD (which loads its title/back on the left and its
            coins/stars/progress pill on the right). Lives in AppShell's
            positioned <main>, above each screen's HUD (z-40 > the z-20 HUDs). */}
        <button
          type="button"
          aria-label="Settings"
          onClick={() => setShowSettings(true)}
          className="absolute left-1/2 top-2 z-40 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full bg-white/85 text-[15px] leading-none shadow ring-1 ring-black/5 backdrop-blur-sm transition-colors hover:bg-white"
        >
          ⚙️
        </button>
        <CurrentScreen />
        {showSettings && (
          <SettingsSheet
            onClose={() => setShowSettings(false)}
            onReplayIntro={onReplayIntro}
            onExitToMenu={onExitToMenu}
          />
        )}
      </AppShell>
    </MotionConfig>
  );
}

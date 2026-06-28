import { useEffect, useMemo } from 'react';
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
import { RewardHatchScreen } from './components/RewardHatchScreen';
import { JourneyMap } from './components/JourneyMap';
import { Shop } from './components/Shop';
import { Gacha } from './components/Gacha';
import { Collection } from './components/Collection';
import { BossPrepScreen } from './components/battle/BossPrepScreen';
import { BattleScreen } from './components/battle/BattleScreen';
import { SettingsSheet } from './components/SettingsSheet';
import { useUiStore } from './state/uiStore';
import type { ContentItem, DrillType, ContentKind } from './data/types';
import { isDragDrop, isFlashcard, isMatching, isFillBlank } from './data/types';
import { useContentStore } from './content/store';
import { findLesson, itemsForLesson, itemsForDrill } from './content/model';
import { CourseSelect } from './components/CourseSelect';
import { ComingSoon } from './components/ComingSoon';
import { FlashcardScreen } from './components/FlashcardScreen';
import { MatchingScreen } from './components/MatchingScreen';
import { FillBlankScreen } from './components/FillBlankScreen';

export function screenKeyAndNode(
  screen: string,
  hatched: boolean,
  drill: DrillType,
  level: number,
  items: ContentItem[],
  kind: ContentKind,
  unit: { l1Enabled?: boolean } = {},
) {
  if (!hatched) return { key: 'egg', node: <EggHatch /> };
  switch (screen) {
    case 'pickCourse': return { key: 'pickCourse', node: <CourseSelect /> };
    case 'pickDrill': return { key: 'pickDrill', node: <JourneyMap /> };
    case 'drill': {
      if (items.length === 0) return { key: 'pickDrill', node: <JourneyMap /> };
      // Boss lessons route via startBoss → bossPrep/battle, never the drill screen.
      // Guard defensively so a boss-kind node never renders the ComingSoon placeholder.
      if (kind === 'boss') return { key: 'pickDrill', node: <JourneyMap /> };
      if (kind === 'dragdrop') return { key: 'drill', node: <DrillScreen items={items.filter(isDragDrop)} drill={drill} level={level} /> };
      if (kind === 'flashcard') return { key: 'flashcard', node: <FlashcardScreen items={items.filter(isFlashcard)} unit={unit} /> };
      if (kind === 'matching') return { key: 'matching', node: <MatchingScreen items={items.filter(isMatching)} unit={unit} /> };
      if (kind === 'fillblank') return { key: 'fillblank', node: <FillBlankScreen items={items.filter(isFillBlank)} unit={unit} /> };
      return { key: 'comingSoon', node: <ComingSoon kind={kind} /> };
    }
    case 'reward': return { key: 'reward', node: <RewardScreen /> };
    case 'evolution': return { key: 'evolution', node: <EvolutionScreen /> };
    case 'rewardHatch': return { key: 'rewardHatch', node: <RewardHatchScreen /> };
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
    case 'rewardHatch':
      return null; // stop music during the cinematic; overworld resumes after
    case 'reward':
      return null; // no overworld loop on level-cleared; the sting plays instead
    case 'pickCourse':
    case 'comingSoon':
    case 'flashcard':
    case 'matching':
    case 'fillblank':
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
  const found = currentLessonId ? findLesson(bundle, currentLessonId) : undefined;
  const lesson = found?.lesson;
  // The active unit gates the L1 (TH/ENG) helper; free-practice has no lesson/unit
  // → l1Enabled undefined → L1 helper stays off. Dep on the primitive so the object
  // reference passed to the screen stays stable across renders.
  const unit = useMemo(() => ({ l1Enabled: found?.unit.l1Enabled }), [found?.unit.l1Enabled]);
  const items = useMemo(
    () => (lesson ? itemsForLesson(bundle, lesson) : itemsForDrill(bundle, drill, level)),
    [bundle, lesson, drill, level],
  );
  const kind: ContentKind = lesson?.kind ?? 'dragdrop';
  // Pass the full widened pool; each kind branch narrows it (dragdrop/flashcard/...).
  const { key, node } = screenKeyAndNode(screen, hatched, drill, level, items, kind, unit);

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
  // The Settings entry (gear) lives in each hub screen's own top-right cluster
  // via <SettingsButton>, so it reads as a peer of that screen's chrome instead
  // of a floating orphan. The sheet itself is rendered once here off the shared
  // UI flag, which both the per-screen gears and this render read.
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        <CurrentScreen />
        {settingsOpen && (
          <SettingsSheet
            onClose={() => setSettingsOpen(false)}
            onReplayIntro={onReplayIntro}
            onExitToMenu={onExitToMenu}
          />
        )}
      </AppShell>
    </MotionConfig>
  );
}

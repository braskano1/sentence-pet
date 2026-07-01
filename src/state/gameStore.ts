import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultAudioSettings, clampLevel, type AudioSettings, type ChannelName } from '../audio/mixer';
import { GAME_CONFIG } from '../config/gameConfig';
import { DRILL_FOOD, KIND_FOOD } from '../data/food';
import type { BattleStats, ContentKind, DrillType, FoodGroup, NutritionBars, PetDef, PetInstance, PetStage, Screen, StageChange } from '../data/types';
import { decayBars, decayHappiness, feedBar } from '../domain/pet';
import { sanitizePetName } from '../domain/petName';
import { levelForXp, stageForXp, stageUp, xpPerCorrect } from '../domain/xp';
import { purchase } from '../domain/shop';
import type { TreatItem, DecorItem, MusicTrackItem } from '../domain/shop';
import { buyDecor } from '../domain/decor';
import { buyMusic } from '../domain/music';
import { allocateStatPoints, makePet, rollStats, rollStatsFromBands, rarityForStats } from '../domain/pets';
import { defaultDefForElement, starterDef, obtainablePool, resolvePetDef, getActivePetDefs } from '../domain/petDef';
import { evolvePetDef } from '../domain/evolution';
import { addCaught } from '../domain/dex';
import { pullEgg as pullEggDomain } from '../domain/gacha';
import { hydrateCourse } from '../content/load';
import { findLesson } from '../content/model';
import { useContentStore } from '../content/store';
import type { L1Mode } from '../content/l1';
import type { StingerKind } from '../effects/music';

export const STARTER_ID = 'starter-leaf';

/** App-side RNG. Kept out of pure domain so domain stays deterministically testable. */
function rng(): number {
  return Math.random();
}

interface RewardSummary {
  level: number;
  stars: number;
  food: number;
  coins: number;
  group: FoodGroup;
}

interface RoundResult {
  drill: DrillType;
  /** Activity kind (flashcard/matching/fillblank/dragdrop). When present and not
   * 'boss', it drives the awarded food group via KIND_FOOD; otherwise the
   * per-variant DRILL_FOOD[drill] is used (dragdrop/DrillScreen pass no kind). */
  kind?: ContentKind;
  level: number;
  stars: number;
  correctCount: number;
}

export interface GameState {
  screen: Screen;
  pets: PetInstance[];
  activePetId: string;
  coins: number; // account-level wallet
  /** Def-chain dex: defIds the player has ever obtained. Accumulates; never shrinks. */
  caughtDefIds: string[];
  inventory: Record<FoodGroup, number>;
  selectedDrill: DrillType;
  selectedLevel: number;
  lastReward: RewardSummary | null;
  // Last gacha pull, for the reveal. The Gacha screen gates the reveal on its own local
  // state, so this is intentionally NOT cleared on navigation; persisting it is harmless
  // (the pet is already in pets[]). Only freshState/resetForTest reset it.
  lastPull: PetInstance | null;
  lastHatch: PetInstance | null;   // P4c: transient — the freshly-granted reward pet awaiting its hatch cinematic
  owned: string[];
  activeBackground: string | null;
  activeTrack: string | null; // equipped overworld music track id; null = free default
  lastLevelUp: { toLevel: number; gained: (keyof BattleStats)[] } | null;
  lastStageChange: StageChange | null;
  audio: AudioSettings;
  l1Mode: L1Mode; // per-user TH/ENG language-helper toggle (Spec §4)
  journey: { lessonStars: Record<string, number> };
  courseComplete: Record<string, boolean>; // per-player completed courses (v15); unlocks the next course
  currentLessonId: string | null;
  currentCourseId: string | null;
  // Transient: a boss (checkpoint) outcome stinger to play once, consumed by a
  // mount effect in RewardScreen. NOT persisted (excluded from PersistedState).
  pendingStinger: StingerKind | null;
  // actions
  setScreen: (s: Screen) => void;
  hatch: () => void;
  startDrill: (drill: DrillType, level: number) => void;
  finishRound: (r: RoundResult) => void;
  feed: (group: FoodGroup) => void;
  buyTreat: (item: TreatItem) => void;
  buyDecor: (item: DecorItem) => void;
  buyMusic: (item: MusicTrackItem) => void;
  pullEgg: () => void;
  equipBackground: (id: string | null) => void;
  equipTrack: (id: string | null) => void;
  switchPet: (id: string) => void;
  renamePet: (id: string, name: string) => void;
  clearLevelUp: () => void;
  clearStageChange: () => void;
  clearHatch: () => void;
  clearPendingStinger: () => void;
  setChannelLevel: (ch: 'master' | ChannelName, v: number) => void;
  toggleChannelMute: (ch: 'master' | ChannelName) => void;
  setL1Mode: (m: L1Mode) => void;
  startLesson: (lessonId: string) => void;
  selectCourse: (courseId: string) => void;
  currentBossLessonId: string | null;
  startBoss: (lessonId: string) => void;
  finishBoss: (won: boolean) => void;
  stage: () => PetStage;
  // test helpers
  addXpForTest: (xp: number) => void;
  addCoinsForTest: (coins: number) => void;
  resetForTest: () => void;
}

/** Single source of truth for the persist schema version. */
export const PERSIST_VERSION = 17;

/** The persisted data fields (the cloud-save payload) — excludes transient + actions. */
export type PersistedState = Pick<
  GameState,
  | 'screen' | 'currentCourseId' | 'pets' | 'activePetId' | 'coins' | 'courseComplete' | 'inventory' | 'selectedDrill'
  | 'selectedLevel' | 'lastReward' | 'lastPull' | 'owned' | 'activeBackground' | 'activeTrack' | 'journey' | 'audio' | 'l1Mode'
  | 'caughtDefIds'
>;

/** Project a full store snapshot down to the persisted payload. */
export function selectPersisted(s: GameState): PersistedState {
  return {
    screen: s.screen,
    // Persist the active course so a restored `screen: 'pickDrill'` has its course
    // to re-hydrate on load; without it the journey falls back to the seed course.
    currentCourseId: s.currentCourseId ?? null,
    pets: s.pets,
    activePetId: s.activePetId,
    coins: s.coins,
    courseComplete: s.courseComplete,
    inventory: s.inventory,
    selectedDrill: s.selectedDrill,
    selectedLevel: s.selectedLevel,
    lastReward: s.lastReward,
    lastPull: s.lastPull,
    owned: s.owned,
    activeBackground: s.activeBackground,
    activeTrack: s.activeTrack,
    journey: s.journey,
    audio: s.audio,
    l1Mode: s.l1Mode,
    caughtDefIds: s.caughtDefIds,
  };
}

/** Active pet. Invariant: activePetId always resolves; fall back to pets[0] defensively. */
export const selectActivePet = (s: { pets: PetInstance[]; activePetId: string }): PetInstance =>
  s.pets.find((p) => p.id === s.activePetId) ?? s.pets[0];

/**
 * The caught-dex as a Set for O(1) membership. NOTE: returns a new Set each call —
 * do NOT pass directly to `useGameStore(selectCaughtSet)` as a reactive selector
 * (new reference every render → infinite loop). Subscribe to `caughtDefIds` with
 * `useShallow` and derive the Set via `useMemo` instead (see DexGrid). Safe for
 * one-off reads: `selectCaughtSet(useGameStore.getState())`.
 */
export const selectCaughtSet = (s: { caughtDefIds: string[] }): Set<string> =>
  new Set(s.caughtDefIds);

/** Immutably replace the active pet via a transform. */
function updateActive(s: GameState, fn: (p: PetInstance) => PetInstance): PetInstance[] {
  return s.pets.map((p) => (p.id === s.activePetId ? fn(p) : p));
}

/** Apply an XP gain to one pet, allocating +1 growth per level crossed. */
function applyXp(pet: PetInstance, xpGain: number, rng: () => number): { pet: PetInstance; levelUp: { toLevel: number; gained: (keyof BattleStats)[] } | null; stageChange: StageChange | null } {
  const before = levelForXp(pet.xp);
  const beforeStage = stageForXp(pet.xp, pet.hatched);
  const xp = pet.xp + xpGain;
  const after = levelForXp(xp);
  const afterStage = stageForXp(xp, pet.hatched);
  // Stages are level-threshold-defined, so a stage change always coincides with a level-up (see early return below keeps stageChange for that invariant's symmetry).
  const stageChange = stageUp(beforeStage, afterStage) ? { from: beforeStage, to: afterStage } : null;
  if (after <= before) return { pet: { ...pet, xp }, levelUp: null, stageChange };
  const gained: (keyof BattleStats)[] = [];
  let growth = pet.growth;
  for (let l = before; l < after; l++) {
    const next = allocateStatPoints(growth, 1, rng);
    (Object.keys(next) as (keyof BattleStats)[]).forEach((k) => { if (next[k] !== growth[k]) gained.push(k); });
    growth = next;
  }
  return { pet: { ...pet, xp, growth }, levelUp: { toLevel: after, gained }, stageChange };
}

function freshPet(): PetInstance {
  const sdef = starterDef();
  const rarity = sdef.rarity ?? 'common';
  const stats = sdef.rarity ? rollStatsFromBands(sdef.statBands[rarity], rng) : rollStats(rng);
  return makePet({ id: STARTER_ID, defId: sdef.id, species: 'leaf', stats, rarity, hatched: false });
}

function freshInventory(): Record<FoodGroup, number> {
  return { protein: 0, veggie: 0, vitamin: 0, treat: 0 };
}

function freshState() {
  return {
    screen: 'egg' as Screen,
    pets: [freshPet()],
    activePetId: STARTER_ID,
    coins: 0,
    inventory: freshInventory(),
    selectedDrill: 'pattern' as DrillType,
    selectedLevel: 1,
    lastReward: null,
    lastPull: null as PetInstance | null,
    lastHatch: null as PetInstance | null,
    owned: [] as string[],
    caughtDefIds: [starterDef().id],
    activeBackground: null as string | null,
    activeTrack: null as string | null,
    lastLevelUp: null as { toLevel: number; gained: (keyof BattleStats)[] } | null,
    lastStageChange: null as StageChange | null,
    audio: defaultAudioSettings(),
    l1Mode: 'TH' as L1Mode,
    journey: { lessonStars: {} as Record<string, number> },
    courseComplete: {} as Record<string, boolean>,
    currentLessonId: null as string | null,
    currentCourseId: null as string | null,
    currentBossLessonId: null as string | null,
    pendingStinger: null as StingerKind | null,
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...freshState(),

      setScreen: (screen) => set({ screen }),

      hatch: () =>
        set((s) => ({
          pets: updateActive(s, (p) => ({ ...p, hatched: true })),
          lastStageChange: { from: 'egg', to: 'baby' },
          screen: 'evolution',
        })),

      startDrill: (drill, level) => set({ selectedDrill: drill, selectedLevel: level, screen: 'drill' }),

      startLesson: (lessonId) => {
        const bundle = useContentStore.getState().bundle;
        const found = findLesson(bundle, lessonId);
        if (!found) return; // unknown id — defensive no-op
        get().startDrill(found.lesson.drill, found.lesson.level);
        set({ currentLessonId: lessonId });
      },

      selectCourse: (courseId) => {
        // Optimistic: route now; hydrateCourse swaps content in when it resolves (mirrors startLesson).
        void hydrateCourse(courseId);
        set({ currentCourseId: courseId, currentLessonId: null, screen: 'pickDrill' });
      },

      startBoss: (lessonId) => {
        const found = findLesson(useContentStore.getState().bundle, lessonId);
        if (!found?.lesson.boss) return; // not a boss checkpoint — defensive no-op
        set({ currentBossLessonId: lessonId, screen: 'bossPrep' });
      },

      finishBoss: (won) =>
        set((s) => {
          const lessonId = s.currentBossLessonId;
          if (!lessonId) return s;
          if (!won) {
            return {
              ...s,
              currentBossLessonId: null,
              pendingStinger: 'lose' as StingerKind,
              screen: 'reward' as Screen,
              lastReward: { level: 1, stars: 0, food: 0, coins: 0, group: 'protein' as FoodGroup },
            };
          }
          const cleared = findLesson(useContentStore.getState().bundle, lessonId)?.lesson;
          const lvl = cleared?.level ?? 1;
          const completesCourse = cleared?.onClear === 'completeCourse' && !!s.currentCourseId;
          const courseComplete = completesCourse
            ? { ...s.courseComplete, [s.currentCourseId as string]: true }
            : s.courseComplete;
          const firstClear = !(lessonId in s.journey.lessonStars);
          const r = GAME_CONFIG.battle.reward;
          const coinsGain = firstClear ? r.firstClearCoins : r.replayCoins;
          let pets = s.pets;
          let lastPull = s.lastPull;
          let lastHatch: PetInstance | null = s.lastHatch;
          let lastLevelUp: GameState['lastLevelUp'] = null;
          let lastStageChange: StageChange | null = null;
          let caughtDefIds = s.caughtDefIds;
          if (firstClear) {
            pets = updateActive(s, (p) => {
              const withXp = applyXp(p, r.firstClearXp, rng);
              lastLevelUp = withXp.levelUp;
              lastStageChange = withXp.stageChange;
              let next = withXp.pet;
              if (withXp.stageChange && withXp.stageChange.from !== 'egg') {
                const before = next.defId;
                next = evolvePetDef(next, getActivePetDefs(), withXp.stageChange.to, rng);
                if (next.defId !== before) caughtDefIds = addCaught(caughtDefIds, next.defId);
              }
              return next;
            });
            const rewardId = cleared?.rewardPetDefId;
            let def: PetDef;
            if (rewardId) {
              def = resolvePetDef(rewardId); // starter-fallback if dangling — never blank
            } else {
              const pool = obtainablePool();
              def = pool[Math.floor(rng() * pool.length)];
            }
            const rarity = def.rarity ?? 'common';
            const egg = makePet({
              id: crypto.randomUUID(),
              species: def.element,
              defId: def.id,
              stats: rollStatsFromBands(def.statBands[rarity], rng),
              rarity,
            });
            pets = [...pets, egg];
            lastPull = egg;
            lastHatch = egg;
            caughtDefIds = addCaught(caughtDefIds, egg.defId);
          }
          return {
            pets,
            coins: s.coins + coinsGain,
            lastPull,
            lastHatch,
            lastLevelUp,
            lastStageChange,
            caughtDefIds,
            lastReward: { level: lvl, stars: 3, food: 0, coins: coinsGain, group: 'protein' as FoodGroup },
            journey: { ...s.journey, lessonStars: { ...s.journey.lessonStars, [lessonId]: Math.max(s.journey.lessonStars[lessonId] ?? 0, 3) } },
            courseComplete,
            currentBossLessonId: null,
            pendingStinger: 'win' as StingerKind,
            screen: 'reward' as Screen,
          };
        }),

      finishRound: ({ drill, kind, level, stars, correctCount }) =>
        set((s) => {
          const group = kind && kind !== 'boss' ? KIND_FOOD[kind] : DRILL_FOOD[drill];
          const lessonId = s.currentLessonId;
          // Resolve whether the finished lesson was a boss (checkpoint) BEFORE we
          // clear currentLessonId; if so, queue a win/lose stinger for RewardScreen.
          const wasBoss = lessonId
            ? !!findLesson(useContentStore.getState().bundle, lessonId)?.lesson?.isCheckpoint
            : false;
          // TODO refine win/lose/cleared threshold
          // Boss → win/lose; a normal lesson → the 'cleared' jingle; no active
          // lesson at all → nothing to celebrate, so leave it null.
          const pendingStinger: StingerKind | null = !lessonId
            ? null
            : wasBoss
              ? (stars >= 1 ? 'win' : 'lose')
              : 'cleared';
          const journey = lessonId
            ? { lessonStars: { ...s.journey.lessonStars, [lessonId]: Math.max(s.journey.lessonStars[lessonId] ?? 0, stars) } }
            : s.journey;
          const xpGain = correctCount * xpPerCorrect(level);
          const coinsGain = GAME_CONFIG.coins.base + GAME_CONFIG.coins.perStar * stars;
          let levelUp: GameState['lastLevelUp'] = null;
          let stageChange: StageChange | null = null;
          let evolvedDefId: string | null = null;
          const pets = updateActive(s, (p) => {
            const happiness =
              decayHappiness(p.happiness) +
              GAME_CONFIG.happiness.onClear +
              (stars === 3 ? GAME_CONFIG.happiness.onThreeStars : 0);
            const withXp = applyXp(p, xpGain, rng);
            levelUp = withXp.levelUp;
            stageChange = withXp.stageChange;
            let next = withXp.pet;
            if (withXp.stageChange && withXp.stageChange.from !== 'egg') {
              const before = next.defId;
              next = evolvePetDef(next, getActivePetDefs(), withXp.stageChange.to, rng);
              if (next.defId !== before) evolvedDefId = next.defId;
            }
            return {
              ...next,
              happiness: Math.min(GAME_CONFIG.happiness.max, happiness),
              bars: decayBars(p.bars),
            };
          });
          return {
            pets,
            coins: s.coins + coinsGain,
            inventory: { ...s.inventory, [group]: s.inventory[group] + correctCount },
            lastReward: { level, stars, food: correctCount, coins: coinsGain, group },
            lastLevelUp: levelUp,
            lastStageChange: stageChange,
            caughtDefIds: evolvedDefId ? addCaught(s.caughtDefIds, evolvedDefId) : s.caughtDefIds,
            journey,
            currentLessonId: null,
            pendingStinger,
            screen: 'reward',
          };
        }),

      feed: (group) =>
        set((s) => ({
          pets: updateActive(s, (p) => ({ ...p, bars: feedBar(p.bars, group, s.inventory[group]) })),
          inventory: { ...s.inventory, [group]: 0 },
        })),

      buyTreat: (item) =>
        set((s) => {
          const active = selectActivePet(s);
          const res = purchase({ coins: s.coins, happiness: active.happiness }, item, GAME_CONFIG.happiness.max);
          if (!res.ok) return s; // no-op; UI disables the button, this is defensive
          return { coins: res.coins, pets: updateActive(s, (p) => ({ ...p, happiness: res.happiness })) };
        }),

      buyDecor: (item) =>
        set((s) => {
          const res = buyDecor({ coins: s.coins, owned: s.owned }, item);
          if (!res.ok) return s; // no-op; UI disables Buy when owned/too poor
          return { coins: res.coins, owned: res.owned };
        }),

      buyMusic: (item) =>
        set((s) => {
          const res = buyMusic({ coins: s.coins, owned: s.owned }, item);
          if (!res.ok) return s; // no-op; UI disables Buy when owned/too poor. SFX at call site.
          return { coins: res.coins, owned: res.owned };
        }),

      pullEgg: () =>
        set((s) => {
          const defs = obtainablePool();
          const res = pullEggDomain(
            { coins: s.coins },
            { price: GAME_CONFIG.gacha.eggPrice, id: crypto.randomUUID(), rng, table: GAME_CONFIG.gacha.rarities, defs },
          );
          if (!res.ok) return s; // no-op; UI disables Pull when too poor
          return {
            pets: [...s.pets, res.pet],
            coins: res.coins,
            lastPull: res.pet,
            caughtDefIds: addCaught(s.caughtDefIds, res.pet.defId),
          };
        }),

      equipBackground: (id) => set({ activeBackground: id }),

      equipTrack: (id) => set({ activeTrack: id }),

      switchPet: (id) => set((s) => (s.pets.some((p) => p.id === id) ? { activePetId: id } : s)),

      clearLevelUp: () => set({ lastLevelUp: null }),

      clearStageChange: () => set({ lastStageChange: null }),

      clearHatch: () => set({ lastHatch: null }),

      clearPendingStinger: () => set({ pendingStinger: null }),

      setChannelLevel: (ch, v) =>
        set((s) => ({ audio: { ...s.audio, [ch]: { ...s.audio[ch], level: clampLevel(v) } } })),

      toggleChannelMute: (ch) =>
        set((s) => ({ audio: { ...s.audio, [ch]: { ...s.audio[ch], muted: !s.audio[ch].muted } } })),

      setL1Mode: (l1Mode) => set({ l1Mode }),

      renamePet: (id, name) =>
        set((s) => {
          const clean = sanitizePetName(name);
          return {
            pets: s.pets.map((p) => (p.id === id ? { ...p, name: clean } : p)),
            // keep the gacha-reveal snapshot in sync so its headline reflects the new name
            lastPull: s.lastPull?.id === id ? { ...s.lastPull, name: clean } : s.lastPull,
          };
        }),

      stage: () => {
        const p = selectActivePet(get());
        return stageForXp(p.xp, p.hatched);
      },

      addXpForTest: (xp) =>
        set((s) => {
          let levelUp: GameState['lastLevelUp'] = null;
          let stageChange: StageChange | null = null;
          const pets = updateActive(s, (p) => {
            const r = applyXp(p, xp, rng);
            levelUp = r.levelUp;
            stageChange = r.stageChange;
            return r.pet;
          });
          return { pets, lastLevelUp: levelUp, lastStageChange: stageChange };
        }),
      addCoinsForTest: (coins) => set((s) => ({ coins: s.coins + coins })),
      resetForTest: () => set(freshState()),
    }),
    {
      name: 'sentence-pet',
      version: PERSIST_VERSION,
      partialize: (s) => {
        const { lastLevelUp, lastStageChange, lastHatch, currentLessonId, currentBossLessonId, pendingStinger, ...rest } = s;
        void lastLevelUp; // transient — not persisted
        void lastStageChange; // transient — not persisted
        void lastHatch; // transient — not persisted
        void currentLessonId; // transient — not persisted
        void currentBossLessonId; // transient — not persisted
        void pendingStinger; // transient — not persisted
        // currentCourseId IS persisted (see selectPersisted): a saved pickDrill screen
        // needs its course, else the journey reverts to the seed fallback on reload.
        return rest as Omit<GameState, 'lastLevelUp' | 'lastStageChange' | 'lastHatch' | 'currentLessonId' | 'currentBossLessonId' | 'pendingStinger'>;
      },
      // v1->v2 inventory groups; v2->v3 pet.species; v3->v4 owned[]+activeBackground;
      // v4->v5 single `pet` (+pet.coins) restructured into pets[]+activePetId+wallet.
      // v5->v6 backfills pet.rarity (derived from stats). v6->v7 backfills pet.name (default '').
      // v7->v8 backfills pet.growth (zeroed BattleStats for pets that predate the field).
      // v8->v9 backfills journey { lessonStars: {} }.
      // v9->v10 backfills soundEnabled (default true).
      // v10->v11 replaces soundEnabled with the audio mixer slice.
      // v11->v12 backfills activeTrack (default null = free overworld loop).
      // v12->v13 drops audio.allMuted (Master mute IS the global mute): a save with
      //   allMuted:true lands as master.muted:true; the allMuted field is removed.
      // v13->v14 backfills l1Mode (per-user TH/ENG language-helper toggle; default 'TH').
      // v14->v15 backfills courseComplete (per-player completed-course map; default {}).
      // v15->v16: backfill defId (the authored creature) keyed off species/element; default 'def-<element>'.
      // v16->v17: seed caughtDefIds (the def-chain dex) from owned pets' defIds.
      migrate: (persisted: unknown) => {
        const st = persisted as
          | {
              pet?: {
                hatched?: boolean;
                species?: PetInstance['species'];
                xp?: number;
                coins?: number;
                happiness?: number;
                bars?: Partial<NutritionBars>;
              };
              pets?: PetInstance[];
              inventory?: Partial<Record<FoodGroup, number>>;
              owned?: string[];
              activeBackground?: string | null;
              activeTrack?: string | null;
              journey?: { lessonStars?: Record<string, number> };
              l1Mode?: L1Mode;
              courseComplete?: Record<string, boolean>;
            }
          | null;
        // Zustand treats a null migrate return as "reset to initial state".
        if (!st) return st as unknown as GameState;

        // Normalize additive fields shared by all versions.
        const base = {
          selectedDrill: 'pattern' as DrillType,
          ...st,
          inventory: { ...freshInventory(), ...(st.inventory ?? {}) },
          owned: st.owned ?? [],
          activeBackground: st.activeBackground ?? null,
          // v11->v12: backfill the equipped overworld track (null = free default loop).
          activeTrack: st.activeTrack ?? null,
          journey: { lessonStars: (st as { journey?: { lessonStars?: Record<string, number> } }).journey?.lessonStars ?? {} },
          // v13->v14: backfill the per-user TH/ENG language-helper toggle (default 'TH').
          l1Mode: (st as { l1Mode?: L1Mode }).l1Mode ?? 'TH',
          // v14->v15: backfill per-player course-completion map (default {}).
          courseComplete: (st as { courseComplete?: Record<string, boolean> }).courseComplete ?? {},
          audio: (() => {
            const saved = (st as { audio?: AudioSettings & { allMuted?: boolean } }).audio;
            const a = saved ? { ...saved } : defaultAudioSettings();
            if (!saved) {
              // v10->v11: derive the mixer from the old boolean. soundEnabled:false -> master mute.
              const legacy = (st as { soundEnabled?: boolean }).soundEnabled;
              if (legacy === false) a.master = { ...a.master, muted: true };
            } else if ((saved as { allMuted?: boolean }).allMuted) {
              // v12->v13: a legacy global-mute save folds into Master mute.
              a.master = { ...a.master, muted: true };
            }
            // v12->v13: the allMuted field no longer exists on AudioSettings.
            delete (a as { allMuted?: boolean }).allMuted;
            return a;
          })(),
        };

        // v<5 (no pets[]): restructure the legacy single pet into pets[] + wallet.
        if (!st.pets && st.pet) {
          const legacy = st.pet;
          const fresh = makePet({
            id: STARTER_ID,
            species: legacy.species ?? 'leaf',
            stats: rollStats(rng),
            rarity: 'common', // overwritten below from the merged stats
            hatched: legacy.hatched ?? false,
          });
          const migrated: PetInstance = {
            ...fresh,
            xp: legacy.xp ?? 0,
            happiness: legacy.happiness ?? GAME_CONFIG.happiness.start,
            bars: { ...fresh.bars, ...(legacy.bars ?? {}) },
            rarity: rarityForStats(fresh.stats, GAME_CONFIG.gacha.rarities),
          };
          const next = { ...base, pets: [migrated], activePetId: STARTER_ID, coins: legacy.coins ?? 0 };
          delete (next as { pet?: unknown }).pet;
          return next as unknown as GameState;
        }

        // v5->v6: backfill rarity on any pet that predates the field.
        // Skip pets already tagged, and defensively skip any (corrupt) pet missing stats.
        if (Array.isArray(base.pets)) {
          base.pets = base.pets.map((p) =>
            (p as PetInstance).rarity || !(p as PetInstance).stats
              ? p
              : { ...p, rarity: rarityForStats((p as PetInstance).stats, GAME_CONFIG.gacha.rarities) },
          );
        }

        // v6->v7: backfill name on any pet that predates the field.
        if (Array.isArray(base.pets)) {
          base.pets = base.pets.map((p) =>
            typeof (p as PetInstance).name === 'string' ? p : { ...p, name: '' },
          );
        }

        // v7->v8: backfill growth on any pet that predates the field.
        if (Array.isArray(base.pets)) {
          base.pets = base.pets.map((p) =>
            (p as PetInstance).growth
              ? p
              : { ...(p as PetInstance), growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 } },
          );
        }

        // v15->v16: backfill defId on any pet that predates the field (key off species/element).
        if (Array.isArray(base.pets)) {
          base.pets = base.pets.map((p) =>
            (p as PetInstance).defId
              ? p
              : { ...(p as PetInstance), defId: defaultDefForElement((p as PetInstance).species).id },
          );
        }

        // v16->v17: seed the caught-dex from owned pets (key off each pet's defId).
        if (!(base as { caughtDefIds?: string[] }).caughtDefIds) {
          const ids = Array.isArray(base.pets)
            ? (base.pets as PetInstance[]).map((p) => p.defId)
            : [];
          (base as { caughtDefIds?: string[] }).caughtDefIds = Array.from(new Set(ids));
        }

        // Drop any stale legacy `pet` key (e.g. a hand-edited save with both shapes).
        delete (base as { pet?: unknown }).pet;
        delete (base as { soundEnabled?: unknown }).soundEnabled;
        return base as unknown as GameState;
      },
    },
  ),
);

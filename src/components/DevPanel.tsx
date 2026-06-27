// src/components/DevPanel.tsx
// Dev-only cheat panel. Rendered by App ONLY when import.meta.env.DEV is true,
// so it is tree-shaken out of production builds. Pairs with `window.store`
// (set in main.tsx) for console access. All mutations are inline setState —
// no production store API is added for dev tooling.
import { useState } from 'react';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { pickSpecies } from '../domain/species';
import { makePet, rollStats, rollRarity, rollStatsForRarity } from '../domain/pets';
import { totalXpForLevel, STAGE_LEVEL } from '../domain/xp';
import type { BattleStats, PetStage, PetInstance } from '../data/types';
import { useAuth } from '../auth/useAuth';
import { useContentStore } from '../content/store';
import { orderedUnits } from '../content/model';
import { devTestLoadout } from '../dev/testLoadout';
import { viewAsTestAccount } from '../dev/testAccount';

const rng = () => Math.random();
const STAT_KEYS: (keyof BattleStats)[] = ['hp', 'atk', 'def', 'spd', 'luk'];

function clampHappiness(v: number) {
  return Math.max(GAME_CONFIG.happiness.min, Math.min(GAME_CONFIG.happiness.max, v));
}

function mapActive(fn: (p: PetInstance) => PetInstance) {
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => (p.id === s.activePetId ? fn(p) : p)) }));
}

function bumpHappiness(delta: number) {
  mapActive((p) => ({ ...p, happiness: clampHappiness(p.happiness + delta) }));
}

function rerollSpecies() {
  mapActive((p) => ({ ...p, species: pickSpecies() }));
}

function rollActiveStats() {
  mapActive((p) => ({ ...p, stats: rollStats(rng) }));
}

function setStat(key: keyof BattleStats, value: number) {
  mapActive((p) => ({ ...p, stats: { ...p.stats, [key]: value } }));
}

function setStage(stage: Exclude<PetStage, 'egg'>) {
  mapActive((p) => ({ ...p, xp: totalXpForLevel(STAGE_LEVEL[stage]) }));
}

function addPet() {
  useGameStore.setState((s) => {
    const id = crypto.randomUUID();
    const rarity = rollRarity(rng, GAME_CONFIG.gacha.rarities);
    const stats = rollStatsForRarity(rarity, rng, GAME_CONFIG.gacha.rarities);
    const pet = makePet({ id, species: pickSpecies(), stats, rarity, hatched: true });
    return { pets: [...s.pets, pet], activePetId: id };
  });
}

function removeActivePet() {
  useGameStore.setState((s) => {
    if (s.pets.length <= 1) return s;
    const remaining = s.pets.filter((p) => p.id !== s.activePetId);
    return { pets: remaining, activePetId: remaining[0].id };
  });
}

function nextPet() {
  const s = useGameStore.getState();
  const i = s.pets.findIndex((p) => p.id === s.activePetId);
  s.switchPet(s.pets[(i + 1) % s.pets.length].id);
}

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const pet = useGameStore((s) => selectActivePet(s));
  const petCount = useGameStore((s) => s.pets.length);
  const coins = useGameStore((s) => s.coins);
  const stage = useGameStore((s) => s.stage());
  const addXp = useGameStore((s) => s.addXpForTest);
  const addCoins = useGameStore((s) => s.addCoinsForTest);
  const reset = useGameStore((s) => s.resetForTest);
  const hatch = useGameStore((s) => s.hatch);
  const { signIn, signOut } = useAuth();
  const bundle = useContentStore((s) => s.bundle);
  const startBoss = useGameStore((s) => s.startBoss);

  // First few real (non-checkpoint) lesson ids, marked cleared in the loadout.
  const clearedLessonIds = orderedUnits(bundle)
    .flatMap((u) => u.lessons.filter((l) => !l.isCheckpoint).map((l) => l.id))
    .slice(0, 3);

  const applyLoadout = () => useGameStore.setState(devTestLoadout({ clearedLessonIds }));
  const viewAsTest = () =>
    void viewAsTestAccount({ signIn, seed: applyLoadout }).catch((e) => console.error('[dev] test account:', e));

  // Every checkpoint (boss) in journey order.
  const checkpoints = orderedUnits(bundle).flatMap((u) =>
    u.lessons.filter((l) => l.isCheckpoint).map((l) => ({ unit: u, lesson: l })),
  );

  // Unlock the journey right up to `targetId` and jump into that boss's prep.
  // Clears every unit's non-checkpoint lessons (opens each checkpoint) and every
  // checkpoint BEFORE the target (unlocks later units), leaving the target itself
  // uncleared so it plays as a fresh fight.
  function unlockTo(targetId: string) {
    const targetIdx = checkpoints.findIndex((c) => c.lesson.id === targetId);
    const stars: Record<string, number> = {};
    checkpoints.forEach(({ unit }, i) => {
      for (const l of unit.lessons) if (!l.isCheckpoint) stars[l.id] = 3;
      if (i < targetIdx) stars[checkpoints[i].lesson.id] = 3;
    });
    if (!useGameStore.getState().pets.some((p) => p.hatched)) applyLoadout();
    useGameStore.setState((s) => ({ journey: { ...s.journey, lessonStars: stars } }));
    startBoss(targetId);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-2 right-2 z-50 rounded-full bg-fuchsia-700/80 px-3 py-1 text-xs font-mono text-white shadow"
      >
        dev
      </button>
    );
  }

  const btn = 'rounded bg-slate-700 px-2 py-1 text-xs font-mono text-white hover:bg-slate-600';

  return (
    <div className="fixed bottom-2 right-2 z-50 w-64 rounded-lg bg-slate-900/95 p-3 text-xs font-mono text-slate-100 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold text-fuchsia-300">DEV</span>
        <button type="button" onClick={() => setOpen(false)} className={btn}>×</button>
      </div>
      <div className="mb-2 leading-5">
        <div>pets: <b>{petCount}</b> · active: <b>{pet.id.slice(0, 8)}</b></div>
        <div>species: <b>{pet.species}</b> · stage: <b>{stage}</b></div>
        <div>xp: <b>{pet.xp}</b> · 🪙 <b>{coins}</b></div>
        <div>😊 <b>{pet.happiness}</b> · hatched: <b>{String(pet.hatched)}</b></div>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-1">
        <button type="button" className={btn} onClick={() => addXp(50)}>+50xp</button>
        <button type="button" className={btn} onClick={() => setStage('young')}>young</button>
        <button type="button" className={btn} onClick={() => setStage('adult')}>adult</button>
        <button type="button" className={btn} onClick={() => setStage('baby')}>baby</button>
        <button type="button" className={btn} onClick={() => addCoins(100)}>+100🪙</button>
        <button type="button" className={btn} onClick={() => bumpHappiness(-25)}>😊-25</button>
        <button type="button" className={btn} onClick={() => bumpHappiness(25)}>😊+25</button>
        <button type="button" className={btn} onClick={rerollSpecies}>reroll</button>
        <button type="button" className={btn} onClick={rollActiveStats}>roll stats</button>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-1">
        <button type="button" className={btn} onClick={addPet}>+pet</button>
        <button type="button" className={btn} onClick={nextPet}>next</button>
        <button type="button" className={btn} onClick={removeActivePet}>−pet</button>
      </div>

      <div className="mb-2 grid grid-cols-5 gap-1">
        {STAT_KEYS.map((k) => (
          <label key={k} className="flex flex-col items-center gap-0.5">
            <span className="uppercase text-fuchsia-300">{k}</span>
            <input
              type="number"
              aria-label={`set ${k}`}
              value={pet.stats[k]}
              onChange={(e) => setStat(k, Number(e.target.value))}
              className="w-11 rounded bg-slate-700 px-1 py-0.5 text-center text-slate-100"
            />
          </label>
        ))}
      </div>

      <div className="mb-1 text-fuchsia-300">VIEW AS</div>
      <div className="mb-2 grid grid-cols-2 gap-1">
        <button type="button" className={btn} onClick={reset}>👶 new player</button>
        <button type="button" className={btn} onClick={() => void signOut().catch((e) => console.error('[dev] sign out:', e))}>🚪 sign out</button>
        <button type="button" className={btn} onClick={applyLoadout}>🎒 loadout</button>
        <button type="button" className={btn} onClick={viewAsTest}>🧪 test acct</button>
      </div>

      {checkpoints.length > 0 && (
        <>
          <div className="mb-1 text-fuchsia-300">JOURNEY → BOSS</div>
          <div className="mb-2 grid grid-cols-1 gap-1">
            {checkpoints.map(({ unit, lesson }) => (
              <button
                key={lesson.id}
                type="button"
                className={btn}
                onClick={() => unlockTo(lesson.id)}
              >
                ⚔️ {unit.title}: {lesson.boss?.name ?? lesson.id}
              </button>
            ))}
          </div>
        </>
      )}

      {!pet.hatched && (
        <div className="grid grid-cols-3 gap-1">
          <button type="button" className={btn} onClick={hatch}>hatch</button>
        </div>
      )}
    </div>
  );
}

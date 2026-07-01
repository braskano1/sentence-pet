import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { useBattleStore } from '../../state/battleStore';
import { useContentStore } from '../../content/store';
import { findLesson, itemsForLesson } from '../../content/model';
import { isDragDrop } from '../../data/types';
import { findTier, recommendedPower } from '../../domain/bossTiers';
import { petPower, petDisplayName, ELEMENT_EMOJI, petStageSprite } from '../../config/petDisplay';
import { usePetDefs } from '../../state/usePetDefs';
import { PressButton } from '../PressButton';

export function BossPrepScreen() {
  // Subscribe to the pet-def catalog so a post-paint Firestore hydration swap
  // re-renders and petStageSprite recomputes with the real def — otherwise the
  // pet-picker thumbnails stay stuck on element fallback art.
  usePetDefs();
  const lessonId = useGameStore((s) => s.currentBossLessonId);
  const pets = useGameStore((s) => s.pets);
  const setScreen = useGameStore((s) => s.setScreen);
  const bundle = useContentStore((s) => s.bundle);
  const begin = useBattleStore((s) => s.begin);

  const lessonObj = lessonId ? findLesson(bundle, lessonId)?.lesson : undefined;
  const boss = lessonObj?.boss;
  // Battles use the dragdrop engine; narrow the widened pool to dragdrop items.
  const items = lessonObj ? itemsForLesson(bundle, lessonObj).filter(isDragDrop) : [];
  const tier = boss ? findTier(boss.tierId) : undefined;
  const hatched = useMemo(() => pets.filter((p) => p.hatched), [pets]);
  const [picked, setPicked] = useState(hatched[0]?.id ?? '');
  const pet = hatched.find((p) => p.id === picked) ?? hatched[0];

  if (!boss || !tier || !pet) return null; // defensive — routed only for real boss lessons

  const rec = recommendedPower(tier);
  const power = petPower(pet);
  const under = power < rec;

  return (
    <div className="flex h-full flex-col gap-4 bg-gradient-to-b from-indigo-100 to-fuchsia-50 p-4">
      <h2 className="text-center text-xl font-extrabold text-slate-800">{ELEMENT_EMOJI[boss.element]} {boss.name}</h2>
      <p className="text-center text-sm text-slate-600">
        Recommended power <b>{rec}</b> · your pet <b className={under ? 'text-rose-600' : 'text-emerald-600'}>{power}</b>
        {under && <span className="block text-rose-600">This one&apos;s tough — but you can still try! 💪</span>}
      </p>

      <div className="grid grid-cols-3 gap-2 overflow-y-auto">
        {hatched.map((p) => (
          <button key={p.id} type="button" onClick={() => setPicked(p.id)}
            className={`flex flex-col items-center rounded-xl border-2 p-2 ${p.id === picked ? 'border-indigo-500 bg-white' : 'border-transparent bg-white/60'}`}>
            <img src={petStageSprite(p)} alt={petDisplayName(p)} className="h-12 w-auto" draggable={false} />
            <span className="text-xs font-bold">{ELEMENT_EMOJI[p.species]} {petDisplayName(p)}</span>
            <span className="text-[10px] text-slate-500">PWR {petPower(p)}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto flex gap-2">
        <PressButton onClick={() => setScreen('pickDrill')}
          className="min-h-12 flex-1 rounded-xl bg-slate-200 font-bold text-slate-700">Back</PressButton>
        <PressButton onClick={() => { begin(pet, boss, undefined, items); setScreen('battle'); }}
          className="min-h-12 flex-[2] rounded-xl bg-indigo-600 font-extrabold text-white">Fight! ⚔️</PressButton>
      </div>
    </div>
  );
}

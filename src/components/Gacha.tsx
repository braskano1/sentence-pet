import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { useCountUp } from '../effects/useCountUp';
import { PressButton } from './PressButton';
import { EGG_SPRITE, SPRITES } from '../config/sprites';
import { PET_NAME, RARITY_BADGE, BATTLE_STAT_LABELS, petDisplayName } from '../config/petDisplay';
import { MAX_PET_NAME } from '../domain/petName';
import { EvolutionCinematic } from './EvolutionCinematic';
import { useAudio } from '../hooks/useAudio';

export function Gacha() {
  const coins = useGameStore((s) => s.coins);
  const pullEgg = useGameStore((s) => s.pullEgg);
  const setScreen = useGameStore((s) => s.setScreen);
  const lastPull = useGameStore((s) => s.lastPull);
  const renamePet = useGameStore((s) => s.renamePet);
  const shownCoins = useCountUp(coins);
  const price = GAME_CONFIG.gacha.eggPrice;
  const [revealed, setRevealed] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [hatching, setHatching] = useState(false);
  const { play } = useAudio();

  const onPull = () => {
    pullEgg();
    play('pull');
    setRevealed(true);
    setHatching(true);
  };

  const pulled = revealed ? lastPull : null;

  if (hatching && lastPull) {
    return (
      <EvolutionCinematic
        from="egg"
        to="baby"
        species={lastPull.species}
        onDone={() => setHatching(false)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-indigo-50 p-6">
      <h2 className="text-xl font-bold text-slate-700">Mystery Egg</h2>
      <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-amber-50 tabular-nums">
        🪙 {shownCoins}
      </span>

      {!pulled ? (
        <>
          <motion.img
            src={EGG_SPRITE}
            alt="mystery egg"
            draggable={false}
            className="h-40 w-auto object-contain"
            animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          />
          <PressButton
            onClick={onPull}
            disabled={coins < price}
            aria-label={`Pull for ${price} coins`}
            className="min-h-12 rounded-2xl border-b-4 border-violet-800 bg-violet-500 px-8 py-3 text-lg font-extrabold text-white shadow active:translate-y-0.5 active:border-b-2 disabled:opacity-40"
          >
            Pull · {price} 🪙
          </PressButton>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <img
            src={SPRITES[pulled.species].baby.happy}
            alt={PET_NAME[pulled.species]}
            className="h-40 w-auto object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.3)]"
          />
          <p className="text-lg font-bold text-slate-700">{petDisplayName(pulled)}!</p>
          <span className={`rounded-full px-3 py-1 text-sm font-extrabold uppercase ${RARITY_BADGE[pulled.rarity]}`}>
            {pulled.rarity}
          </span>
          <div role="group" aria-label="Battle stats" className="flex gap-1">
            {BATTLE_STAT_LABELS.map(([label, key]) => (
              <div key={key} className="flex flex-col items-center rounded-lg bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700">
                <span className="text-slate-500">{label}</span>
                <span className="tabular-nums">{pulled.stats[key]}</span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex w-full items-center gap-2">
            <input
              type="text"
              aria-label="Name your pet"
              placeholder="Name your pet"
              maxLength={MAX_PET_NAME}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <PressButton
              onClick={() => renamePet(pulled.id, nameDraft)}
              aria-label="Name"
              className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-bold text-white"
            >
              Name
            </PressButton>
          </div>
        </div>
      )}

      <PressButton
        onClick={() => setScreen('petRoom')}
        aria-label="Back to room"
        className="min-h-12 rounded-xl bg-slate-600 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        ← Back
      </PressButton>
    </div>
  );
}

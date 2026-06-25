import { useGameStore, selectActivePet } from '../state/gameStore';
import { PressButton } from './PressButton';
import { StatRadar } from './StatRadar';
import { BATTLE_STAT_LABELS, ELEMENT_EMOJI, PET_NAME, RARITY_BADGE, RARITY_HEX, RARITY_RING, petLevel, petStageSprite } from '../config/petDisplay';
import { strongAgainst, weakAgainst } from '../domain/elements';

/**
 * The pet collection: a detail panel for the active pet (portrait, rarity, stat radar +
 * numbers) over a roster strip. Tap a roster pet to make it active. Reached from PetRoom.
 */
export function Collection() {
  const pets = useGameStore((s) => s.pets);
  const active = useGameStore(selectActivePet);
  const switchPet = useGameStore((s) => s.switchPet);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="flex h-full flex-col bg-amber-50">
      <div className="flex items-center justify-between border-b-2 border-amber-900/15 px-5 py-3">
        <h2 className="text-lg font-extrabold text-amber-950">My Pets ({pets.length})</h2>
        <PressButton
          onClick={() => setScreen('petRoom')}
          aria-label="Back to room"
          className="rounded-xl bg-amber-900/15 px-3 py-1.5 text-sm font-bold text-amber-950"
        >
          ← Room
        </PressButton>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* ── detail: active pet, rarity, radar + stat numbers ── */}
        <div
          className="flex flex-col items-center gap-2 rounded-3xl border-b-4 border-amber-900/20 p-4 shadow"
          style={{ background: 'linear-gradient(180deg,#fcecc9 0%,#f4dba9 100%)' }}
        >
          <img
            src={petStageSprite(active)}
            alt={PET_NAME[active.species]}
            className="h-28 w-28 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)]"
          />
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold text-amber-950">{PET_NAME[active.species]}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${RARITY_BADGE[active.rarity]}`}>
              {active.rarity}
            </span>
            <span className="text-xs font-semibold text-amber-900/60">Lv {petLevel(active)}</span>
          </div>

          <p className="text-xs font-semibold text-amber-900/70">
            <span>Strong vs {ELEMENT_EMOJI[strongAgainst(active.species)]} {PET_NAME[strongAgainst(active.species)]}</span>
            <span className="mx-1 text-amber-900/30">·</span>
            <span>Weak vs {ELEMENT_EMOJI[weakAgainst(active.species)]} {PET_NAME[weakAgainst(active.species)]}</span>
          </p>

          <StatRadar stats={active.stats} color={RARITY_HEX[active.rarity]} />

          <div className="flex w-full gap-1">
            {BATTLE_STAT_LABELS.map(([label, key]) => (
              <div key={key} className="flex flex-1 flex-col items-center rounded-lg bg-amber-900/10 px-1 py-1 text-xs font-bold text-amber-950">
                <span className="text-amber-900/60">{label}</span>
                <span className="tabular-nums">{active.stats[key]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── roster: tap to raise a different pet ── */}
        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-amber-900/60">Roster</p>
        <div className="grid grid-cols-4 gap-2">
          {pets.map((p) => {
            const isActive = p.id === active.id;
            return (
              <PressButton
                key={p.id}
                onClick={() => switchPet(p.id)}
                aria-label={isActive ? `${PET_NAME[p.species]} (active)` : `Raise ${PET_NAME[p.species]}`}
                className={`flex flex-col items-center rounded-xl p-1.5 ${
                  isActive ? 'bg-amber-200/80 ring-2 ring-amber-500' : 'bg-white/70'
                }`}
              >
                <span className={`rounded-full p-0.5 ring-2 ${RARITY_RING[p.rarity]}`}>
                  <img src={petStageSprite(p)} alt="" aria-hidden className="h-11 w-11 object-contain" />
                </span>
                <span className="mt-0.5 text-[10px] font-bold text-amber-950">{PET_NAME[p.species]}</span>
                <span className="text-[10px]" aria-hidden="true">{ELEMENT_EMOJI[p.species]}</span>
              </PressButton>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { PressButton } from './PressButton';
import { StatRadar } from './StatRadar';
import { useCountUp } from '../effects/useCountUp';
import { BATTLE_STAT_LABELS, ELEMENT_EMOJI, PET_NAME, RARITY_BADGE, RARITY_HEX, RARITY_RING, displayStats, petDisplayName, petLevel, petSpecialty, petStageSprite } from '../config/petDisplay';
import { strongAgainst, weakAgainst } from '../domain/elements';
import { MAX_PET_NAME } from '../domain/petName';
import type { Rarity } from '../data/types';

/** A single battle-stat number that rolls when it changes (pet switch). */
function StatNum({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <span className="tabular-nums">{shown}</span>;
}

/** Rarity pill; epic/legendary get a periodic shine-sweep. */
function RarityBadge({ rarity }: { rarity: Rarity }) {
  const shiny = rarity === 'epic' || rarity === 'legendary';
  return (
    <span className={`relative overflow-hidden rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${RARITY_BADGE[rarity]}`}>
      {rarity}
      {shiny && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -skew-x-12"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)' }}
          initial={{ x: '-130%' }}
          animate={{ x: '130%' }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut', repeatDelay: 1.4 }}
        />
      )}
    </span>
  );
}

/**
 * The pet collection: a detail panel for the active pet (portrait, rarity, stat radar +
 * numbers) over a roster strip. Tap a roster pet to make it active. Reached from PetRoom.
 */
export function Collection() {
  const pets = useGameStore((s) => s.pets);
  const active = useGameStore(selectActivePet);
  const switchPet = useGameStore((s) => s.switchPet);
  const setScreen = useGameStore((s) => s.setScreen);
  const renamePet = useGameStore((s) => s.renamePet);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

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
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="flex flex-col items-center gap-2 rounded-3xl border-b-4 border-amber-900/20 p-4 shadow"
          style={{ background: 'linear-gradient(180deg,#fcecc9 0%,#f4dba9 100%)' }}
        >
          {/* gentle idle float; the sprite cross-fades when the active pet changes */}
          <motion.div
            className="h-28"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={active.id}
                src={petStageSprite(active)}
                alt={PET_NAME[active.species]}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.25 }}
                className="h-28 w-28 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)]"
              />
            </AnimatePresence>
          </motion.div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <input
                  type="text"
                  aria-label="Pet name"
                  maxLength={MAX_PET_NAME}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-amber-900/30 bg-amber-50 px-2 py-1 text-base"
                />
                <PressButton
                  onClick={() => { renamePet(active.id, draft); setEditing(false); }}
                  aria-label="Save"
                  className="rounded-lg bg-amber-600 px-2 py-1 text-sm font-bold text-white"
                >
                  Save
                </PressButton>
              </>
            ) : (
              <>
                <span className="text-lg font-extrabold text-amber-950">{petDisplayName(active)}</span>
                {active.name.trim() && <span className="text-[10px] font-semibold text-amber-900/50">({PET_NAME[active.species]})</span>}
                <PressButton
                  onClick={() => { setDraft(active.name); setEditing(true); }}
                  aria-label="Rename"
                  className="rounded-md bg-amber-900/15 px-2 py-0.5 text-sm"
                >
                  ✎
                </PressButton>
                <RarityBadge rarity={active.rarity} />
                <span className="text-xs font-semibold text-amber-900/60">Lv {petLevel(active)}</span>
              </>
            )}
          </div>

          <p className="text-xs font-semibold text-amber-900/70">
            <span>Strong vs {ELEMENT_EMOJI[strongAgainst(active.species)]} {PET_NAME[strongAgainst(active.species)]}</span>
            <span className="mx-1 text-amber-900/30">·</span>
            <span>Weak vs {ELEMENT_EMOJI[weakAgainst(active.species)]} {PET_NAME[weakAgainst(active.species)]}</span>
          </p>

          <StatRadar stats={displayStats(active)} color={RARITY_HEX[active.rarity]} specialty={petSpecialty(active)} />

          <div className="flex w-full gap-1">
            {BATTLE_STAT_LABELS.map(([label, key]) => (
              <div key={key} className="flex flex-1 flex-col items-center rounded-lg bg-amber-900/10 px-1 py-1 text-xs font-bold text-amber-950">
                <span className="text-amber-900/60">{label}</span>
                <StatNum value={displayStats(active)[key]} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── roster: tap to raise a different pet ── */}
        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-amber-900/60">Roster</p>
        <div className="grid grid-cols-4 gap-2">
          {pets.map((p, i) => {
            const isActive = p.id === active.id;
            return (
              <PressButton
                key={p.id}
                onClick={() => switchPet(p.id)}
                aria-label={isActive ? `${petDisplayName(p)} (active)` : `Raise ${petDisplayName(p)}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
                whileHover={{ y: -2 }}
                className={`relative flex flex-col items-center rounded-xl p-1.5 ${
                  isActive ? 'bg-amber-200/80' : 'bg-white/70'
                }`}
              >
                {isActive && (
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-amber-500"
                    animate={{ opacity: [0.45, 1, 0.45] }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                  />
                )}
                <span className={`rounded-full p-0.5 ring-2 ${RARITY_RING[p.rarity]}`}>
                  <img src={petStageSprite(p)} alt="" aria-hidden className="h-11 w-11 object-contain" />
                </span>
                <span className="mt-0.5 text-[10px] font-bold text-amber-950">{petDisplayName(p)}</span>
                <span className="text-[10px]" aria-hidden="true">{ELEMENT_EMOJI[p.species]}</span>
              </PressButton>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState, type KeyboardEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { PressButton } from './PressButton';
import { SettingsButton } from './SettingsButton';
import { StatRadar } from './StatRadar';
import {
  BATTLE_STAT_LABELS,
  ELEMENT_EMOJI,
  ELEMENT_FLAVOR,
  PET_NAME,
  RARITY_BADGE,
  RARITY_HEX,
  RARITY_RING,
  SPECIALTY_WORD,
  displayStats,
  petDisplayName,
  petElementSprite,
  petLevel,
  petPower,
  petSpecialty,
  petStageSprite,
} from '../config/petDisplay';
import { strongAgainst, weakAgainst } from '../domain/elements';
import { resolvePetDef } from '../domain/petDef';
import { SPECIES } from '../domain/species';
import { MAX_PET_NAME } from '../domain/petName';
import type { PetInstance, Rarity, Species } from '../data/types';
import { DexGrid } from './DexGrid';
import { PanViewport } from './journey/PanViewport';
import { usePetDefs } from '../state/usePetDefs';

const COLLECTION_TABS = ['pets', 'dex'] as const;
type CollectionTab = (typeof COLLECTION_TABS)[number];

type ElementFilter = 'all' | Species;
type SortKey = 'recent' | 'rarity' | 'level' | 'name';

/** Rarity rank for sorting (legendary highest). Mirrors the gacha rarity order. */
const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
const SORT_OPTIONS: ReadonlyArray<readonly [SortKey, string]> = [
  ['recent', 'Recent'],
  ['rarity', 'Rarity'],
  ['level', 'Level'],
  ['name', 'Name'],
];

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
  const [justSaved, setJustSaved] = useState(false);
  const [tab, setTab] = useState<CollectionTab>('pets');
  const [statsOpen, setStatsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [element, setElement] = useState<ElementFilter>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const reduce = useReducedMotion();
  // Subscribe to the pet-def catalog so a post-paint Firestore hydration swap
  // re-renders this screen and petStageSprite recomputes with the real def —
  // otherwise the My Pets portrait/roster stay stuck on element fallback art.
  // (The My Pets tab has no other petDefs subscription; DexGrid only mounts on the Dex tab.)
  const defs = usePetDefs();

  const cancelRename = () => { setEditing(false); setDraft(''); };
  const saveRename = () => {
    if (!draft.trim()) return;
    renamePet(active.id, draft);
    setEditing(false);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1500);
  };
  const onRenameKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveRename(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
  };

  // Filtered + sorted roster for the pan world. "recent" = newest-appended first.
  const roster = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = pets.filter(
      (p) =>
        (element === 'all' || p.species === element) &&
        (q === '' || petDisplayName(p).toLowerCase().includes(q)),
    );
    const byName = (a: PetInstance, b: PetInstance) =>
      petDisplayName(a).localeCompare(petDisplayName(b));
    switch (sort) {
      case 'recent': return list.reverse();
      case 'rarity': return list.sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || byName(a, b));
      case 'level': return list.sort((a, b) => petLevel(b) - petLevel(a) || byName(a, b));
      case 'name': return list.sort(byName);
      default: return list;
    }
  }, [pets, query, element, sort]);

  const dexName = resolvePetDef(active.defId, defs).name;
  const specialtyWord = SPECIALTY_WORD[petSpecialty(active)];
  const rosterElementChips: ElementFilter[] = ['all', ...SPECIES];

  const onTabKey = (e: KeyboardEvent, current: CollectionTab) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = COLLECTION_TABS.indexOf(current);
    const next = e.key === 'ArrowRight'
      ? COLLECTION_TABS[(i + 1) % COLLECTION_TABS.length]
      : COLLECTION_TABS[(i - 1 + COLLECTION_TABS.length) % COLLECTION_TABS.length];
    setTab(next);
    document.getElementById(`collection-tab-${next}`)?.focus();
  };

  return (
    <div className="flex h-full flex-col bg-amber-50">
      <div className="flex items-center justify-between border-b-2 border-amber-900/15 px-5 py-3">
        <h2 className="text-lg font-extrabold text-amber-950">
          {tab === 'dex' ? 'Pet Dex' : `My Pets (${pets.length})`}
        </h2>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Collection view" className="flex rounded-xl bg-amber-900/10 p-0.5 text-sm font-bold">
            <button
              id="collection-tab-pets"
              role="tab"
              aria-selected={tab === 'pets'}
              aria-controls="collection-panel"
              tabIndex={tab === 'pets' ? 0 : -1}
              onClick={() => setTab('pets')}
              onKeyDown={(e) => onTabKey(e, 'pets')}
              className={`rounded-lg px-2.5 py-1 ${tab === 'pets' ? 'bg-amber-200 text-amber-950' : 'text-amber-900/60'}`}
            >
              My Pets
            </button>
            <button
              id="collection-tab-dex"
              role="tab"
              aria-selected={tab === 'dex'}
              aria-controls="collection-panel"
              tabIndex={tab === 'dex' ? 0 : -1}
              onClick={() => { setEditing(false); setTab('dex'); }}
              onKeyDown={(e) => onTabKey(e, 'dex')}
              className={`rounded-lg px-2.5 py-1 ${tab === 'dex' ? 'bg-amber-200 text-amber-950' : 'text-amber-900/60'}`}
            >
              Dex
            </button>
          </div>
          <PressButton
            onClick={() => setScreen('petRoom')}
            aria-label="Back to room"
            className="rounded-xl bg-amber-900/15 px-3 py-1.5 text-sm font-bold text-amber-950"
          >
            ← Room
          </PressButton>
          <SettingsButton className="bg-amber-900/10 ring-amber-900/15" />
        </div>
      </div>

      <div
        id="collection-panel"
        role="tabpanel"
        aria-labelledby={`collection-tab-${tab}`}
        // Both tabs host a PanViewport (its own clipping camera): each needs full
        // height and must NOT sit inside a padded overflow-y-auto scroller (that
        // double-scrolls and breaks its measurement). Padding lives inside the tab.
        className="flex-1 overflow-hidden"
      >
        {tab === 'dex' ? (
          <DexGrid />
        ) : (
          <div className="relative grid h-full grid-rows-[auto_1fr] bg-amber-50">
        {/* ── auto rows: calm hero (active pet) + collapsible stats + roster controls ── */}
        <div className="shrink-0 border-b-2 border-amber-900/10 px-4 pb-3 pt-4">
          {/* CALM hero: affection-first, compact */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="flex flex-col items-center gap-2 rounded-3xl border-b-4 border-amber-900/20 p-4 shadow"
            style={{ background: 'linear-gradient(180deg,#fcecc9 0%,#f4dba9 100%)' }}
          >
            {/* gentle idle float; the sprite cross-fades when the active pet changes */}
            <motion.div
              className="h-24"
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={active.id}
                  src={petStageSprite(active)}
                  alt={PET_NAME[active.species]}
                  onError={(e) => {
                    const fb = petElementSprite(active);
                    if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
                  }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.25 }}
                  className="h-24 w-24 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)]"
                />
              </AnimatePresence>
            </motion.div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {editing ? (
                <>
                  <input
                    type="text"
                    aria-label="Pet name"
                    autoFocus
                    maxLength={MAX_PET_NAME}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onRenameKey}
                    className="min-w-0 flex-1 rounded-lg border border-amber-900/30 bg-amber-50 px-2 py-1 text-base"
                  />
                  <PressButton
                    onClick={saveRename}
                    disabled={!draft.trim()}
                    aria-label="Save"
                    className="rounded-lg bg-amber-600 px-2 py-1 text-sm font-bold text-white disabled:opacity-40"
                  >
                    Save
                  </PressButton>
                  <PressButton
                    onClick={cancelRename}
                    aria-label="Cancel"
                    className="rounded-lg bg-amber-900/15 px-2 py-1 text-sm font-bold text-amber-950"
                  >
                    ✕
                  </PressButton>
                </>
              ) : (
                <>
                  <span className="text-lg font-extrabold text-amber-950">{petDisplayName(active)}</span>
                  {active.name.trim() && active.name.trim() !== dexName && (
                    <span className="text-[10px] font-semibold text-amber-900/50">({dexName})</span>
                  )}
                  <PressButton
                    onClick={() => { setDraft(active.name); setEditing(true); }}
                    aria-label="Rename"
                    className="rounded-md bg-amber-900/15 px-2 py-0.5 text-sm"
                  >
                    ✎
                  </PressButton>
                  <RarityBadge rarity={active.rarity} />
                  <span className="text-xs font-semibold text-amber-900/60">Lv {petLevel(active)}</span>
                  {justSaved && (
                    <motion.span
                      role="status"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white"
                    >
                      Saved!
                    </motion.span>
                  )}
                </>
              )}
            </div>

            {/* warm one-liner (affinity + friendly specialty) — no battle jargon */}
            <p className="text-center text-xs font-semibold text-amber-900/70">
              {ELEMENT_EMOJI[active.species]} {ELEMENT_FLAVOR[active.species]}
              <span className="mx-1 text-amber-900/30">·</span>
              Best at {specialtyWord}
            </p>

            {/* Stats toggle: combat detail is behind this tap */}
            <PressButton
              onClick={() => setStatsOpen((v) => !v)}
              aria-expanded={statsOpen}
              className="mt-1 rounded-full bg-amber-900/10 px-3 py-1.5 text-xs font-bold text-amber-900/80"
            >
              Stats {statsOpen ? '▴' : '▾'}
            </PressButton>

            {/* ── B) stats panel — collapsed by default, reduced-motion safe ── */}
            <AnimatePresence initial={false}>
              {statsOpen && (
                <motion.div
                  key="stats"
                  initial={reduce ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reduce ? { opacity: 1, height: 0 } : { opacity: 0, height: 0 }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 30 }}
                  className="w-full overflow-hidden"
                >
                  <div className="flex flex-col items-center gap-2 pt-3">
                    <p className="text-xs font-semibold text-amber-900/70">
                      <span>Strong vs {ELEMENT_EMOJI[strongAgainst(active.species)]} {PET_NAME[strongAgainst(active.species)]}</span>
                      <span className="mx-1 text-amber-900/30">·</span>
                      <span>Weak vs {ELEMENT_EMOJI[weakAgainst(active.species)]} {PET_NAME[weakAgainst(active.species)]}</span>
                    </p>

                    <StatRadar stats={displayStats(active)} color={RARITY_HEX[active.rarity]} specialty={petSpecialty(active)} />

                    <div className="flex w-full gap-2">
                      <div className="flex-1 rounded-xl bg-amber-900/10 px-3 py-2">
                        <div className="text-[8px] font-extrabold uppercase tracking-wide text-amber-900/60">Level</div>
                        <div className="mt-1 text-xl font-extrabold leading-none text-amber-950">{petLevel(active)}<span className="text-[10px] font-bold text-amber-900/60"> / 50</span></div>
                      </div>
                      <div className="flex-1 rounded-xl bg-amber-900/10 px-3 py-2">
                        <div className="text-[8px] font-extrabold uppercase tracking-wide text-amber-900/60">⚔ Power</div>
                        <div className="mt-1 text-xl font-extrabold leading-none text-amber-950 tabular-nums">{petPower(active)}</div>
                      </div>
                      <div className="flex-1 rounded-xl bg-amber-900/10 px-3 py-2">
                        <div className="text-[8px] font-extrabold uppercase tracking-wide text-amber-900/60">★ Specialty</div>
                        <div className="mt-1 text-base font-extrabold leading-none text-amber-700">{BATTLE_STAT_LABELS.find(([, k]) => k === petSpecialty(active))?.[0] ?? 'HP'}</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── C) roster controls: search + element chips + sort ── */}
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="text"
              aria-label="Search your pets"
              placeholder="Search your pets…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 rounded-xl border border-amber-900/20 bg-white/80 px-3 text-sm font-semibold text-amber-950 placeholder:text-amber-900/40"
            />
            <div className="flex flex-wrap gap-1.5">
              {rosterElementChips.map((el) => {
                const on = element === el;
                return (
                  <PressButton
                    key={el}
                    aria-pressed={on}
                    aria-label={el === 'all' ? 'All elements' : PET_NAME[el]}
                    onClick={() => setElement(el)}
                    className={`flex min-h-[40px] items-center gap-1 rounded-full px-3 text-sm font-bold ${
                      on ? 'bg-amber-500 text-white shadow' : 'bg-amber-900/10 text-amber-900/70'
                    }`}
                  >
                    {el !== 'all' && <span aria-hidden="true">{ELEMENT_EMOJI[el]}</span>}
                    {el === 'all' ? 'All' : PET_NAME[el]}
                  </PressButton>
                );
              })}
            </div>
            <div role="group" aria-label="Sort your pets" className="flex rounded-xl bg-amber-900/10 p-0.5 text-sm font-bold">
              {SORT_OPTIONS.map(([key, label]) => {
                const on = sort === key;
                return (
                  <PressButton
                    key={key}
                    aria-pressed={on}
                    onClick={() => setSort(key)}
                    className={`min-h-[40px] flex-1 rounded-lg px-2 ${
                      on ? 'bg-amber-200 text-amber-950 shadow-sm' : 'text-amber-900/60'
                    }`}
                  >
                    {label}
                  </PressButton>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── D) roster in the pan world (1fr row) — drag to pan, jumps to active ── */}
        <PanViewport currentId={active.id} contentClassName="px-4 pb-10 pt-3">
          {roster.length === 0 ? (
            <div className="flex h-full min-h-[8rem] items-center justify-center px-6 text-center">
              <p className="text-sm font-bold text-amber-900/60">
                {query.trim()
                  ? `No pets match "${query.trim()}"`
                  : element !== 'all'
                    ? `No ${ELEMENT_EMOJI[element]} ${PET_NAME[element]} pets`
                    : 'No pets yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {roster.map((p, i) => {
                const isActive = p.id === active.id;
                return (
                  <PressButton
                    key={p.id}
                    onClick={() => switchPet(p.id)}
                    data-current={isActive ? 'true' : undefined}
                    aria-label={isActive ? `${petDisplayName(p)} (active)` : `Raise ${petDisplayName(p)}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 8) * 0.03, type: 'spring', stiffness: 300, damping: 24 }}
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
                      <img
                        src={petStageSprite(p)}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        onError={(e) => {
                          const fb = petElementSprite(p);
                          if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
                        }}
                        className="h-11 w-11 object-contain"
                      />
                    </span>
                    <span className="mt-0.5 w-full truncate text-center text-[10px] font-bold text-amber-950" title={petDisplayName(p)}>{petDisplayName(p)}</span>
                    <span className="text-[10px]" aria-hidden="true">{ELEMENT_EMOJI[p.species]}</span>
                  </PressButton>
                );
              })}
            </div>
          )}
        </PanViewport>
          </div>
        )}
      </div>
    </div>
  );
}

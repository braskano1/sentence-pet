import { useState, useMemo, type KeyboardEvent } from 'react';
import { SettingsButton } from './SettingsButton';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { PetSprite } from './PetSprite';
import { useCountUp } from '../effects/useCountUp';
import { FOOD_GROUPS, FOOD_META } from '../data/food';
import { PressButton } from './PressButton';
import { DECOR_SPRITES } from '../config/decorSprites';
import { petDisplayName, STAGE_NAME, ELEMENT_EMOJI, RARITY_RING, petLevel, RARITY_HEX, displayStats, petPower, petSpecialty, BATTLE_STAT_LABELS } from '../config/petDisplay';
import { StatRadar } from './StatRadar';
import { xpProgress } from '../domain/xp';
import { petDialogue } from '../domain/petDialogue';
import { SpeechBubble } from './SpeechBubble';
import type { PetInstance } from '../data/types';
import { useAudio } from '../hooks/useAudio';

const TABS = ['care', 'power'] as const;
type Tab = (typeof TABS)[number];

export function PetRoom() {
  const activePet = useGameStore((s) => selectActivePet(s));
  const walletCoins = useGameStore((s) => s.coins);
  const inventory = useGameStore((s) => s.inventory);
  const stage = useGameStore((s) => s.stage());
  const feed = useGameStore((s) => s.feed);
  const setScreen = useGameStore((s) => s.setScreen);
  const activeBackground = useGameStore((s) => s.activeBackground);
  const pets = useGameStore((s) => s.pets);
  const bgSprite = activeBackground ? DECOR_SPRITES[activeBackground] : null;
  const [feedTrigger, setFeedTrigger] = useState(0);
  const [tab, setTab] = useState<Tab>('care');
  const { play } = useAudio();

  const coins = useCountUp(walletCoins);

  const xpp = xpProgress(activePet.xp);
  const level = petLevel(activePet);
  const lowest = FOOD_GROUPS.reduce((a, g) => (activePet.bars[g] < activePet.bars[a] ? g : a), FOOD_GROUPS[0]);

  // Stable dialogue line: recomputes only when meaningful inputs change, not on every animation frame.
  const line = useMemo(() => petDialogue({
    name: petDisplayName(activePet),
    species: activePet.species,
    stage,
    lowestGroup: lowest,
    lowestValue: activePet.bars[lowest],
    happiness: activePet.happiness,
    justFed: false,
    leveledTo: null,
    gainedStat: null,
    nearEvolution: false,
  }, () => 0.5), [activePet.id, lowest, activePet.bars[lowest] <= 30, activePet.happiness >= 70, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTabKey = (e: KeyboardEvent, current: Tab) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.indexOf(current);
    const next = e.key === 'ArrowRight'
      ? TABS[(i + 1) % TABS.length]
      : TABS[(i - 1 + TABS.length) % TABS.length];
    setTab(next);
    document.getElementById(`petroom-tab-${next}`)?.focus();
  };

  return (
    <div className={`relative flex h-full flex-col overflow-hidden ${bgSprite ? '' : 'bg-emerald-50'}`}>
      {/* ── scene: room art + HUD overlay + pet ── */}
      {bgSprite && (
        <img
          data-testid="room-bg"
          src={bgSprite}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* soft glow lifts the pet off busy art without dimming the whole room */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 52% 40% at 50% 46%, rgba(255,255,255,0.45), rgba(255,255,255,0) 70%)',
          }}
        />

        {/* HUD corners */}
        <div className="absolute inset-x-2 top-2 z-20 flex items-start justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-white/85 py-0.5 pl-0.5 pr-2 shadow">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sm ring-2 ${RARITY_RING[activePet.rarity]}`}>{ELEMENT_EMOJI[activePet.species]}</span>
            <span className="text-[11px] font-extrabold leading-tight text-amber-950">{petDisplayName(activePet)} · Lv {level}
              <small className="block text-[8px] font-bold text-amber-900/70">{activePet.rarity.toUpperCase()} · {activePet.species.toUpperCase()} · {STAGE_NAME[stage].toUpperCase()}</small>
            </span>
          </span>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-amber-950/85 px-2.5 py-1 text-[11px] font-bold text-amber-50 tabular-nums">🪙 {coins}</span>
            <div className="flex items-center gap-1">
              <PressButton onClick={() => setScreen('collection')} aria-label="My pets" className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-extrabold text-amber-950 shadow">🐾 My Pets · {pets.length}</PressButton>
              <SettingsButton className="h-7 w-7 text-[13px]" />
            </div>
          </div>
        </div>

        {/* bubble + pet (keep the existing glow div; place pet lower-center) */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-end px-6 pb-14">
          <div className="mb-2"><SpeechBubble name={petDisplayName(activePet)} line={line} /></div>
          <div className="relative drop-shadow-[0_14px_26px_rgba(0,0,0,0.4)]">
            <PetSprite stage={stage} species={activePet.species} happiness={activePet.happiness} feedTrigger={feedTrigger} defId={activePet.defId} />
          </div>
        </div>

        {/* XP bar */}
        <div className="absolute inset-x-3 bottom-2 z-20">
          <div className="mb-0.5 flex justify-between text-[9px] font-extrabold text-white drop-shadow">
            <span>{xpp.atMax ? 'FULLY GROWN' : `XP → LV ${level + 1}`}</span>
            <span>{xpp.atMax ? 'MAX ✨' : `${xpp.into} / ${xpp.span}`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/30">
            <div className={`h-full rounded-full ${xpp.atMax ? 'bg-gradient-to-r from-amber-500 to-amber-300' : 'bg-gradient-to-r from-green-400 to-green-500'}`}
              style={{ width: `${xpp.atMax ? 100 : Math.round((xpp.into / xpp.span) * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* ── carved warm panel: Care | Power tabs + actions ── */}
      <div
        className="relative z-10 rounded-t-[2rem] border-t-4 border-amber-900/30 px-5 pb-6 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
        style={{ background: 'linear-gradient(180deg,#fcecc9 0%,#f4dba9 60%,#ebcb91 100%)' }}
      >
        <div role="tablist" aria-label="Pet details" className="mb-3 flex gap-1 rounded-xl bg-amber-900/12 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              id={`petroom-tab-${t}`}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`petroom-panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={(e) => onTabKey(e, t)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-extrabold ${tab === t ? 'bg-white text-amber-950 shadow' : 'text-amber-900/70'}`}>
              {t === 'care' ? 'Care' : 'Power ⬡'}
            </button>
          ))}
        </div>

        {tab === 'care' ? (
          <div role="tabpanel" id="petroom-panel-care" aria-labelledby="petroom-tab-care">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">😊</span>
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-extrabold text-amber-900/70"><span>Happiness</span><span className="tabular-nums">{activePet.happiness}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-amber-950/15"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${activePet.happiness}%` }} /></div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {FOOD_GROUPS.map((g) => {
                const owned = inventory[g];
                return (
                  <div key={g} className="flex flex-col items-center gap-1">
                    <span className="text-xl">{FOOD_META[g].emoji}</span>
                    <span className="text-xs font-extrabold tabular-nums text-amber-950">{activePet.bars[g]}</span>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-950/15"><div className={`h-full rounded-full ${FOOD_META[g].color}`} style={{ width: `${activePet.bars[g]}%` }} /></div>
                    <PressButton aria-label={`Feed ${FOOD_META[g].label}`} disabled={owned === 0}
                      onClick={() => { if (owned === 0) return; feed(g); play('feed'); setFeedTrigger((n) => n + 1); }}
                      className={`relative w-full rounded-lg py-1 text-xs font-extrabold text-white ${owned === 0 ? 'bg-amber-900/15 text-amber-900/40' : 'border-b-2 border-black/25 bg-green-600'}`}>
                      ＋<span className="absolute -right-1 -top-1 rounded-full bg-slate-900 px-1 text-[7px] text-white">{owned}</span>
                    </PressButton>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div role="tabpanel" id="petroom-panel-power" aria-labelledby="petroom-tab-power">
            <PowerPanel pet={activePet} />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <PressButton onClick={() => setScreen('gacha')} aria-label="Eggs" className="min-h-12 flex-1 rounded-2xl border-b-4 border-violet-800 bg-violet-500 px-3 py-3 text-base font-extrabold text-white shadow active:translate-y-0.5 active:border-b-2">Eggs 🥚</PressButton>
          <PressButton onClick={() => setScreen('shop')} className="min-h-12 flex-1 rounded-2xl border-b-4 border-amber-900/50 bg-amber-500 px-3 py-3 text-base font-extrabold text-white shadow active:translate-y-0.5 active:border-b-2">Shop 🛒</PressButton>
          <PressButton onClick={() => setScreen('pickCourse')} className="min-h-12 flex-1 rounded-2xl border-b-4 border-emerald-800 bg-emerald-500 px-3 py-3 text-base font-extrabold text-white shadow active:translate-y-0.5 active:border-b-2">Play ▶</PressButton>
        </div>
      </div>
    </div>
  );
}

function PowerPanel({ pet }: { pet: PetInstance }) {
  const stats = displayStats(pet);
  const spec = petSpecialty(pet);
  const specLabel = BATTLE_STAT_LABELS.find(([, k]) => k === spec)?.[0] ?? 'HP';
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex flex-1 justify-center">
        <StatRadar stats={stats} color={RARITY_HEX[pet.rarity]} size={200} specialty={spec} />
      </div>
      <div className="flex w-28 flex-none flex-col gap-2">
        <div className="rounded-xl bg-amber-900/10 px-3 py-2">
          <div className="text-[8px] font-extrabold uppercase tracking-wide text-amber-900/60">Level</div>
          <div className="mt-1 text-xl font-extrabold leading-none text-amber-950">{petLevel(pet)}<span className="text-[10px] font-bold text-amber-900/60"> / 50</span></div>
        </div>
        <div className="rounded-xl bg-amber-900/10 px-3 py-2">
          <div className="text-[8px] font-extrabold uppercase tracking-wide text-amber-900/60">⚔ Power</div>
          <div className="mt-1 text-xl font-extrabold leading-none text-amber-950 tabular-nums">{petPower(pet)}</div>
        </div>
        <div className="rounded-xl bg-amber-900/10 px-3 py-2">
          <div className="text-[8px] font-extrabold uppercase tracking-wide text-amber-900/60">★ Specialty</div>
          <div className="mt-1 text-base font-extrabold leading-none text-amber-700">{specLabel}</div>
        </div>
      </div>
    </div>
  );
}

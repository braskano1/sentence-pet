import { useEffect, useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { useCountUp } from '../effects/useCountUp';
import { useAudio } from '../hooks/useAudio';
import { TreatCard } from './TreatCard';
import { DecorCard } from './DecorCard';
import { MusicCard, type MusicRow } from './MusicCard';
import { isOwned } from '../domain/decor';
import { DEFAULT_OVERWORLD_TRACK_URL } from '../domain/music';

type Tab = 'treats' | 'decor' | 'music';

const TABS: Tab[] = ['treats', 'decor', 'music'];

// Music list = the free default ("Cozy Theme", id null) + the buyable catalog.
const MUSIC_ROWS: MusicRow[] = [
  { id: null, name: 'Cozy Theme', src: DEFAULT_OVERWORLD_TRACK_URL },
  ...GAME_CONFIG.shop.music.map((m) => ({ id: m.id, name: m.name, src: m.src, price: m.price })),
];

export function Shop() {
  const coins = useGameStore((s) => s.coins);
  const happiness = useGameStore((s) => selectActivePet(s).happiness);
  const owned = useGameStore((s) => s.owned);
  const activeBackground = useGameStore((s) => s.activeBackground);
  const activeTrack = useGameStore((s) => s.activeTrack);
  const setScreen = useGameStore((s) => s.setScreen);
  const shownCoins = useCountUp(coins);
  const full = happiness >= GAME_CONFIG.happiness.max;
  const [tab, setTab] = useState<Tab>('treats');
  // The id of the row currently being previewed (string id, or the literal
  // 'default' for the null-id Cozy Theme so a single key space works). null = none.
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const { previewTrack, stopPreview } = useAudio();

  // Stop any preview when leaving the Music tab, and on unmount, so audio never
  // keeps playing after the player navigates away.
  useEffect(() => {
    if (tab !== 'music' && previewingId !== null) {
      stopPreview();
      setPreviewingId(null);
    }
  }, [tab, previewingId, stopPreview]);

  useEffect(() => () => { stopPreview(); }, [stopPreview]);

  const onTabKey = (e: KeyboardEvent, current: Tab) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.indexOf(current);
    const next = e.key === 'ArrowRight'
      ? TABS[(i + 1) % TABS.length]
      : TABS[(i - 1 + TABS.length) % TABS.length];
    setTab(next);
    document.getElementById(`shop-tab-${next}`)?.focus();
  };

  const togglePreview = (row: MusicRow) => {
    const key = row.id ?? 'default';
    if (previewingId === key) {
      stopPreview();
      setPreviewingId(null);
    } else {
      previewTrack(row.src);
      setPreviewingId(key);
    }
  };

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] bg-amber-50">
      {/* sticky header: title + coins + tabs */}
      <header className="z-10 bg-amber-50/95 px-5 pt-5 pb-3 shadow-[0_6px_12px_-10px_rgba(0,0,0,.4)] backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight text-slate-800">Shop</h2>
          <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-amber-200">
            <span className="text-lg leading-none" aria-hidden="true">🪙</span>
            <span className="font-bold text-slate-700 tabular-nums">{shownCoins}</span>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Shop categories"
          className="mt-3 flex gap-1.5 rounded-xl bg-amber-100/70 p-1"
        >
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`shop-tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`shop-panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={(e) => onTabKey(e, t)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold capitalize transition ${
                tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* scroll zone */}
      <main className="min-h-0 overflow-y-auto px-5 py-4">
        {tab === 'treats' && (
          <div
            role="tabpanel"
            id="shop-panel-treats"
            aria-labelledby="shop-tab-treats"
            tabIndex={0}
            className="flex flex-col gap-3"
          >
            <p className="text-sm text-slate-600">
              Feed your pet to lift its mood.{' '}
              <span className="font-semibold text-slate-700 tabular-nums">
                {happiness}/{GAME_CONFIG.happiness.max} right now.
              </span>
            </p>
            {GAME_CONFIG.shop.treats.map((item, index) => (
              <TreatCard
                key={item.id}
                item={item}
                coins={coins}
                full={full}
                happiness={happiness}
                index={index}
              />
            ))}
          </div>
        )}

        {tab === 'decor' && (
          <div
            role="tabpanel"
            id="shop-panel-decor"
            aria-labelledby="shop-tab-decor"
            tabIndex={0}
            className="grid grid-cols-2 content-start gap-3"
          >
            {GAME_CONFIG.shop.decor.map((item, index) => (
              <DecorCard
                key={item.id}
                item={item}
                coins={coins}
                owned={isOwned(owned, item.id)}
                active={activeBackground === item.id}
                index={index}
              />
            ))}
          </div>
        )}

        {tab === 'music' && (
          <div
            role="tabpanel"
            id="shop-panel-music"
            aria-labelledby="shop-tab-music"
            tabIndex={0}
            className="flex flex-col gap-2.5"
          >
            <p className="text-sm text-slate-600">Set the tune for your room. Tap ▶ to preview.</p>
            {MUSIC_ROWS.map((row, index) => (
              <MusicCard
                key={row.id ?? 'default'}
                item={row}
                coins={coins}
                owned={row.id === null || isOwned(owned, row.id)}
                active={activeTrack === row.id}
                index={index}
                previewing={previewingId === (row.id ?? 'default')}
                onPreviewToggle={() => togglePreview(row)}
              />
            ))}
          </div>
        )}
      </main>

      {/* sticky back */}
      <footer className="z-10 border-t border-amber-200/70 bg-amber-50/95 px-5 py-3 backdrop-blur">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => setScreen('petRoom')}
          className="min-h-12 w-full rounded-xl bg-slate-700 px-6 py-3 text-base font-bold text-white shadow-md transition"
        >
          ← Back
        </motion.button>
      </footer>
    </div>
  );
}

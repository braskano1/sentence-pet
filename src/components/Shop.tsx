import { useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { useCountUp } from '../effects/useCountUp';
import { TreatCard } from './TreatCard';
import { DecorCard } from './DecorCard';
import { isOwned } from '../domain/decor';

type Tab = 'treats' | 'decor';

const TABS: Tab[] = ['treats', 'decor'];

export function Shop() {
  const coins = useGameStore((s) => s.coins);
  const happiness = useGameStore((s) => selectActivePet(s).happiness);
  const owned = useGameStore((s) => s.owned);
  const activeBackground = useGameStore((s) => s.activeBackground);
  const setScreen = useGameStore((s) => s.setScreen);
  const shownCoins = useCountUp(coins);
  const full = happiness >= GAME_CONFIG.happiness.max;
  const [tab, setTab] = useState<Tab>('treats');

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

  return (
    <div className="flex h-full flex-col bg-amber-50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-700">Shop</h2>
        <p className="text-slate-500">🪙 {shownCoins}</p>
      </div>

      <div role="tablist" aria-label="Shop categories" className="mt-3 flex gap-2">
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
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
              tab === t ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'treats' ? (
        <div
          role="tabpanel"
          id={`shop-panel-${tab}`}
          aria-labelledby={`shop-tab-${tab}`}
          tabIndex={0}
          className="flex flex-1 flex-col justify-center gap-3"
        >
          {GAME_CONFIG.shop.treats.map((item, index) => (
            <TreatCard key={item.id} item={item} coins={coins} full={full} index={index} />
          ))}
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`shop-panel-${tab}`}
          aria-labelledby={`shop-tab-${tab}`}
          tabIndex={0}
          className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto py-3"
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

      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => setScreen('petRoom')}
        className="mt-3 min-h-12 w-full rounded-xl bg-slate-600 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        ← Back
      </motion.button>
    </div>
  );
}

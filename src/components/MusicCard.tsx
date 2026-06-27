import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { PressButton } from './PressButton';
import type { MusicTrackItem } from '../domain/shop';
import { useAudio } from '../hooks/useAudio';

/**
 * A music row accepts either a real catalog {@link MusicTrackItem} or the
 * synthetic free default ("Cozy Theme"). The default is modelled as `id: null`
 * with no price — always owned, equipped via `equipTrack(null)`.
 */
export interface MusicRow {
  id: string | null; // null = the free default track
  name: string;
  src: string;
  price?: number; // absent for the free default
}

interface MusicCardProps {
  item: MusicRow;
  coins: number; // live store coins (for affordability)
  owned: boolean; // id === null || isOwned(owned, id)
  active: boolean; // activeTrack === id (null matches the default)
  index: number; // stagger-in delay
  previewing: boolean; // is THIS row the currently-playing preview?
  onPreviewToggle: () => void;
}

// Per-track presentational metadata. Keyed by track id; `default` covers the
// free Cozy Theme. Lives here so the domain MusicTrackItem stays presentation-free.
const META: Record<string, { emoji: string; grad: string; genre: string }> = {
  default: { emoji: '🎵', grad: 'from-amber-300 to-orange-300', genre: 'Default' },
  'music:lofi': { emoji: '🎧', grad: 'from-indigo-300 to-violet-300', genre: 'Chill beats' },
  'music:jazz': { emoji: '🎷', grad: 'from-rose-300 to-pink-300', genre: 'Smooth jazz' },
  'music:arcade': { emoji: '👾', grad: 'from-emerald-300 to-teal-300', genre: 'Chiptune' },
  'music:musicbox': { emoji: '🎶', grad: 'from-violet-300 to-fuchsia-300', genre: 'Lullaby' },
  'music:celtic': { emoji: '🪕', grad: 'from-teal-300 to-cyan-300', genre: 'Folk' },
  'music:bossa': { emoji: '🌴', grad: 'from-orange-300 to-amber-300', genre: 'Bossa nova' },
};

export function MusicCard({
  item,
  coins,
  owned,
  active,
  index,
  previewing,
  onPreviewToggle,
}: MusicCardProps) {
  const buyMusic = useGameStore((s) => s.buyMusic);
  const equipTrack = useGameStore((s) => s.equipTrack);
  const { play } = useAudio();

  const meta = META[item.id ?? 'default'] ?? META.default;
  const price = item.price ?? 0;
  const afford = coins >= price;

  // label drives the visible text AND the accessible name (button text + aria-label)
  const label = active ? 'Equipped' : owned ? 'Equip' : 'Buy';
  const disabled = active || (!owned && !afford);

  function handleAction() {
    if (active) return;
    if (owned) {
      equipTrack(item.id); // equip: no SFX (free action)
    } else if (afford) {
      // Only real catalog tracks reach here (the default is always owned).
      buyMusic({ id: item.id as string, name: item.name, kind: 'music', src: item.src, price });
      play('purchase');
    }
  }

  const buttonStyle = active
    ? 'bg-emerald-600 text-white'
    : owned
      ? 'bg-emerald-500 text-white'
      : afford
        ? 'bg-amber-500 text-white'
        : 'bg-amber-200 text-amber-800';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-sm ring-1 ${
        active ? 'ring-emerald-300' : 'ring-amber-100'
      }`}
    >
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${meta.grad} text-2xl shadow-inner`}
        aria-hidden="true"
      >
        {meta.emoji}
      </div>

      <PressButton
        onClick={onPreviewToggle}
        aria-label={`${previewing ? 'Stop preview of' : 'Preview'} ${item.name}`}
        aria-pressed={previewing}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-slate-700 shadow ring-1 ring-black/5 active:scale-95"
      >
        <span aria-hidden="true">{previewing ? '⏸' : '▶'}</span>
      </PressButton>

      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-slate-800">{item.name}</div>
        <div className="truncate text-xs text-slate-500">{meta.genre}</div>
      </div>

      <PressButton
        onClick={handleAction}
        disabled={disabled}
        aria-label={`${label} ${item.name}`}
        className={`min-h-9 shrink-0 rounded-lg px-3 py-2 text-xs font-bold shadow ${buttonStyle} ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        {label === 'Buy' ? <>Buy 🪙{price}</> : label}
      </PressButton>
    </motion.div>
  );
}

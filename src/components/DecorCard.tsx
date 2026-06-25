import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { PressButton } from './PressButton';
import type { DecorItem } from '../domain/shop';

interface DecorCardProps {
  item: DecorItem;
  coins: number;   // live store coins (for affordability)
  owned: boolean;  // isOwned(owned, item.id)
  active: boolean; // activeBackground === item.id
  index: number;   // stagger-in delay
}

export function DecorCard({ item, coins, owned, active, index }: DecorCardProps) {
  const buyDecor = useGameStore((s) => s.buyDecor);
  const equipBackground = useGameStore((s) => s.equipBackground);
  const afford = coins >= item.price;

  // label drives the visible text AND the accessible name (button text + aria-label)
  const label = active ? 'Equipped' : owned ? 'Equip' : 'Buy';
  const disabled = active || (!owned && !afford);

  function handleClick() {
    if (active) return;
    if (owned) equipBackground(item.id);
    else if (afford) buyDecor(item);
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
      className="flex flex-col gap-2 rounded-xl bg-white/70 p-2 shadow"
    >
      <img
        src={item.sprite}
        alt={`${item.name} room`}
        className="h-24 w-full rounded-lg object-cover"
      />
      <div className="flex items-center justify-between px-1">
        <span className="font-semibold text-slate-700">{item.name}</span>
        {!owned && <span className="text-sm text-slate-500">🪙 {item.price}</span>}
      </div>
      <PressButton
        onClick={handleClick}
        disabled={disabled}
        aria-label={`${label} ${item.name}`}
        className={`min-h-10 w-full rounded-lg px-3 py-2 text-sm font-semibold shadow ${buttonStyle} ${disabled ? 'opacity-60' : ''}`}
      >
        {label}
      </PressButton>
    </motion.div>
  );
}

import type { DrillType, FoodGroup } from './types';

/** Which nutrition bar each drill's food feeds. */
export const DRILL_FOOD: Record<DrillType, FoodGroup> = {
  pattern: 'protein',
  wordChoice: 'veggie',
};

export interface FoodMeta {
  emoji: string;
  label: string;
  color: string; // tailwind bg-* for the bar fill
}

export const FOOD_META: Record<FoodGroup, FoodMeta> = {
  protein: { emoji: '🥩', label: 'Protein', color: 'bg-orange-500' },
  veggie: { emoji: '🥦', label: 'Veggie', color: 'bg-green-500' },
  vitamin: { emoji: '💊', label: 'Vitamin', color: 'bg-sky-500' },
  treat: { emoji: '🍰', label: 'Treat', color: 'bg-pink-500' },
};

export const FOOD_GROUPS: FoodGroup[] = ['protein', 'veggie', 'vitamin', 'treat'];

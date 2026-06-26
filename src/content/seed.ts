import type { ContentBundle, Unit } from './model';
import type { DrillItem } from '../data/types';
import { WORD_BANK, itemsFor } from '../data/wordBank';
import { JOURNEY } from '../data/journey';

const pool: Record<string, DrillItem> = Object.fromEntries(WORD_BANK.map((i) => [i.id, i]));

const units: Unit[] = JOURNEY.map((u) => ({
  id: u.id,
  title: u.title,
  emoji: u.emoji,
  order: u.order,
  lessons: u.lessons.map((l) => ({
    id: l.id,
    drill: l.drill,
    level: l.level,
    isCheckpoint: l.isCheckpoint,
    itemIds: itemsFor(l.drill, l.level).map((i) => i.id),
  })),
}));

/** The migrated static content. Bundled fallback for first paint AND the seed-script source. */
export const SEED: ContentBundle = { pool, units };

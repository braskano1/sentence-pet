import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from './db';
import type { ContentBundle, Unit } from '../content/model';
import type { DrillItem } from '../data/types';

const POOL_DOC = doc(db, 'content', 'pool');
const JOURNEY_DOC = doc(db, 'content', 'journey');

/** Read both aggregate docs and assemble a ContentBundle. */
export async function fetchContent(): Promise<ContentBundle> {
  const [poolSnap, journeySnap] = await Promise.all([getDoc(POOL_DOC), getDoc(JOURNEY_DOC)]);
  const pool = (poolSnap.data()?.items ?? {}) as Record<string, DrillItem>;
  const units = (journeySnap.data()?.units ?? []) as Unit[];
  return { pool, units };
}

/** Atomically write both aggregate docs (admin-only, enforced by rules). */
export async function saveContent(bundle: ContentBundle): Promise<void> {
  const batch = writeBatch(db);
  batch.set(POOL_DOC, { items: bundle.pool });
  batch.set(JOURNEY_DOC, { units: bundle.units });
  await batch.commit();
}

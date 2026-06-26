// Tracer-bullet repo: a single read+write round-trip on ping/{uid}. Removable later.
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './db';

export interface Ping {
  at: number;
}

export async function writePing(uid: string): Promise<void> {
  await setDoc(doc(db, 'ping', uid), { at: Date.now() } satisfies Ping);
}

export async function readPing(uid: string): Promise<Ping | null> {
  const snap = await getDoc(doc(db, 'ping', uid));
  return snap.exists() ? (snap.data() as Ping) : null;
}

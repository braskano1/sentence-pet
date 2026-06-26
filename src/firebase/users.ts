import { doc, collection, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './db';
import type { CloudSave, ProfileDoc, PetDoc } from '../sync/mapping';

const PROFILE = ['meta', 'profile'] as const;

export async function saveProfile(uid: string, profile: ProfileDoc): Promise<void> {
  await setDoc(doc(db, 'users', uid, ...PROFILE), { ...profile, updatedAt: serverTimestamp() });
}

export async function savePet(uid: string, pet: PetDoc): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'pets', pet.id), { ...pet, updatedAt: serverTimestamp() });
}

export async function loadCloudSave(uid: string): Promise<CloudSave | null> {
  const profileSnap = await getDoc(doc(db, 'users', uid, ...PROFILE));
  if (!profileSnap.exists()) return null;
  const { updatedAt: _p, ...profile } = profileSnap.data() as ProfileDoc & { updatedAt?: unknown };
  void _p;
  const petsSnap = await getDocs(collection(db, 'users', uid, 'pets'));
  const pets = petsSnap.docs.map((d) => {
    const { updatedAt: _q, ...rest } = d.data() as PetDoc & { updatedAt?: unknown };
    void _q;
    return rest as PetDoc;
  });
  return { profile: profile as ProfileDoc, pets };
}

import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { PetMood, PetStage } from '../data/types';
import { firebaseApp } from './app';

export const storage = getStorage(firebaseApp);

// Point at the local Storage emulator when explicitly enabled (mirrors db.ts).
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  const host = import.meta.env.VITE_EMULATOR_HOST ?? '127.0.0.1';
  connectStorageEmulator(storage, host, 9199);
}

// Egg is never overridable, so it is never an upload slot.
type SpriteStage = Exclude<PetStage, 'egg'>;
export type SpriteSlot = 'default' | `${SpriteStage}-${PetMood}`;

/** Extension for the object name: filename ext → mime subtype → "img". Cosmetic only (download URL is opaque). */
function extOf(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (fromName) return fromName;
  const fromType = file.type.split('/')[1];
  return fromType || 'img';
}

/** Upload a sprite image raw and return its download URL. Path: petDefs/{defId}/{slot}.{ext}. */
export async function uploadSprite(defId: string, slot: SpriteSlot, file: File): Promise<string> {
  const objRef = ref(storage, `petDefs/${defId}/${slot}.${extOf(file)}`);
  await uploadBytes(objRef, file);
  return getDownloadURL(objRef);
}

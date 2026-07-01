import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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

/** Best-effort delete of a stored sprite by its download URL (ref() accepts the
 *  https download URL directly). Throws on failure — callers decide whether to swallow. */
export async function deleteSpriteByUrl(url: string): Promise<void> {
  await deleteObject(ref(storage, url));
}

export type LessonImageSlot = 'image' | 'leftImage' | 'rightImage';

/** Upload a lesson image raw and return its download URL. Path: lessonImages/{itemId}/{slot}.{ext}. */
export async function uploadLessonImage(itemId: string, slot: LessonImageSlot, file: File): Promise<string> {
  const objRef = ref(storage, `lessonImages/${itemId}/${slot}.${extOf(file)}`);
  await uploadBytes(objRef, file);
  return getDownloadURL(objRef);
}

/** Neutral alias — lesson code reads honestly. deleteSpriteByUrl already deletes any object by its
 *  download URL, so lesson images reuse it verbatim. Keep the sprite export for SpriteUpload. */
export const deleteByUrl = deleteSpriteByUrl;

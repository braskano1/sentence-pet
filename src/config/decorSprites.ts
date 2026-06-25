import beach from '../assets/sprites/decor/beach.webp';
import forestPath from '../assets/sprites/decor/forest-path.webp';
import nightRoom from '../assets/sprites/decor/night-room.webp';
import forestRoom from '../assets/sprites/decor/forest-room.webp';
import skyRoom from '../assets/sprites/decor/sky-room.webp';
import fireRoom from '../assets/sprites/decor/fire-room.webp';
import waterRoom from '../assets/sprites/decor/water-room.webp';

/** Decor id (namespaced) -> imported room webp. Single source of truth for room art. */
export const DECOR_SPRITES: Record<string, string> = {
  'decor:beach': beach,
  'decor:forest-path': forestPath,
  'decor:night-room': nightRoom,
  'decor:forest-room': forestRoom,
  'decor:sky-room': skyRoom,
  'decor:fire-room': fireRoom,
  'decor:water-room': waterRoom,
};

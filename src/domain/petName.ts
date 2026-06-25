export const MAX_PET_NAME = 14;

/** Trim and cap a user-entered pet name. Empty/whitespace stays '' (falls back to species name). */
export function sanitizePetName(raw: string): string {
  return raw.trim().slice(0, MAX_PET_NAME);
}

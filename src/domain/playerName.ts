import type { PetStage } from '../data/types';

/** Bounds for a player display name (inclusive). */
export const NAME_MIN = 2;
export const NAME_MAX = 16;

export interface NameResult {
  ok: boolean;
  /** The normalized name (present whether or not ok — callers show it back). */
  name: string;
  /** Why it failed, when !ok. */
  reason?: 'length' | 'charset' | 'blocked';
}

/** Letters (any script), combining marks, and single internal spaces only.
 *  This alone rejects digits, @, ., /, :, emoji — so emails, urls, and phone
 *  numbers are all rejected without separate regexes. */
const ALLOWED = /^[\p{L}\p{M}]+( [\p{L}\p{M}]+)*$/u;

/** Normalize, then validate a raw display name. Pure. The production blocklist is
 *  injected (default empty) so this module carries no profanity data itself. */
export function sanitizeName(raw: string, opts: { blocklist?: string[] } = {}): NameResult {
  const name = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, name, reason: 'length' };
  if (!ALLOWED.test(name)) return { ok: false, name, reason: 'charset' };
  const lower = name.toLowerCase();
  if ((opts.blocklist ?? []).some((w) => lower.includes(w.toLowerCase()))) return { ok: false, name, reason: 'blocked' };
  return { ok: true, name };
}

/** The intro egg-hatch is the one place we capture a name: the cinematic that just
 *  finished came from the egg (from === 'egg') and no name is set yet. Real
 *  evolutions (baby/young start) and already-named players are never gated. */
export function needsNameEntry(fromStage: PetStage, displayName: string): boolean {
  return fromStage === 'egg' && displayName.trim() === '';
}

import { PERSIST_VERSION, type PersistedState } from '../state/gameStore';
import type { PetInstance } from '../data/types';

export { PERSIST_VERSION };

/** One pet document (1:1 with PetInstance). */
export type PetDoc = PetInstance;

/** The profile document: everything persisted except the pets array. */
export type ProfileDoc = Omit<PersistedState, 'pets'> & { persistVersion: number };

/** The full cloud save: one profile doc + N pet docs. */
export interface CloudSave {
  profile: ProfileDoc;
  pets: PetDoc[];
}

/** Split a persisted snapshot into the profile doc + pet docs. Pure. */
export function toCloud(s: PersistedState): CloudSave {
  const { pets, ...rest } = s;
  return { profile: { ...rest, persistVersion: PERSIST_VERSION }, pets };
}

/** Recombine cloud docs back into the persisted shape. Pure. Drops persistVersion. */
export function fromCloud(c: CloudSave): PersistedState {
  const { persistVersion: _persistVersion, ...profile } = c.profile;
  void _persistVersion;
  return { ...profile, pets: c.pets };
}

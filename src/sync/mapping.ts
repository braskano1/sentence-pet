import { PERSIST_VERSION, type PersistedState } from '../state/gameStore';
import type { PetInstance } from '../data/types';
import { defaultDefForElement } from '../domain/petDef';

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

/** Recombine cloud docs back into the persisted shape. Pure. Drops persistVersion.
 *  Backfills defId on legacy pet docs (pre-v16) so cloud-restored pets are never blank. */
export function fromCloud(c: CloudSave): PersistedState {
  const { persistVersion: _persistVersion, ...profile } = c.profile;
  void _persistVersion;
  const pets = c.pets.map((p) =>
    p.defId ? p : { ...p, defId: defaultDefForElement(p.species).id },
  );
  return { ...profile, pets };
}

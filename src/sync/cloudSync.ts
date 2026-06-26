import { toCloud, type ProfileDoc, type PetDoc } from './mapping';
import type { PersistedState } from '../state/gameStore';

export interface SyncRepo {
  saveProfile(uid: string, profile: ProfileDoc): Promise<void>;
  savePet(uid: string, pet: PetDoc): Promise<void>;
}

export interface CloudSyncDeps {
  uid: string;
  getState: () => PersistedState;
  subscribe: (listener: () => void) => () => void;
  repo: SyncRepo;
  debounceMs?: number;
  /** Injected for tests; defaults to setTimeout. */
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

/** Start mirroring the store to Firestore. Returns a stop() that unsubscribes + cancels. */
export function startCloudSync(deps: CloudSyncDeps): () => void {
  const debounceMs = deps.debounceMs ?? 1500;
  const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = deps.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let lastProfileJson = '';
  const lastPetJson = new Map<string, string>();
  let handle: unknown = null;

  async function flush() {
    handle = null;
    const { profile, pets } = toCloud(deps.getState());
    const writes: Promise<void>[] = [];

    const profileJson = JSON.stringify(profile);
    if (profileJson !== lastProfileJson) {
      lastProfileJson = profileJson;
      writes.push(deps.repo.saveProfile(deps.uid, profile));
    }
    for (const pet of pets) {
      const json = JSON.stringify(pet);
      if (lastPetJson.get(pet.id) !== json) {
        lastPetJson.set(pet.id, json);
        writes.push(deps.repo.savePet(deps.uid, pet));
      }
    }
    await Promise.all(writes);
  }

  function scheduleFlush() {
    if (handle !== null) cancel(handle);
    handle = schedule(() => { void flush(); }, debounceMs);
  }

  scheduleFlush();
  const unsub = deps.subscribe(scheduleFlush);

  return () => {
    unsub();
    if (handle !== null) { cancel(handle); handle = null; }
  };
}

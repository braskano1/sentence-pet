import { useSyncExternalStore } from 'react';
import { getActivePetDefs, subscribePetDefs } from '../domain/petDef';
import type { PetDef } from '../data/types';

/**
 * Reactive view of the active pet-def catalog. Re-renders the consumer when the
 * registry is swapped — e.g. when `hydratePetDefs` resolves after mount — so the
 * dex reflects a freshly-published catalog without an app reload.
 */
export function usePetDefs(): readonly PetDef[] {
  return useSyncExternalStore(subscribePetDefs, getActivePetDefs, getActivePetDefs);
}

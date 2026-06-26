import { fromCloud, type CloudSave } from './mapping';
import type { PersistedState } from '../state/gameStore';

export interface ReconcileDeps {
  uid: string;
  loadCloudSave: (uid: string) => Promise<CloudSave | null>;
  applyState: (s: PersistedState) => void;
}

/** Cloud-always-wins: if a cloud save exists, overwrite local with it. Returns whether it applied. */
export async function reconcileFromCloud(deps: ReconcileDeps): Promise<boolean> {
  const cloud = await deps.loadCloudSave(deps.uid);
  if (!cloud) return false;
  deps.applyState(fromCloud(cloud));
  return true;
}

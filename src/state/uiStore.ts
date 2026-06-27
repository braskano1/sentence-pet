import { create } from 'zustand';

/**
 * Ephemeral, non-persisted UI state. Kept OUT of gameStore (which is persisted
 * + cloud-synced) so transient view flags never leak into a save. The Settings
 * sheet is opened from a per-screen gear (SettingsButton) but rendered once in
 * App, so its open flag lives here where both sides can reach it.
 */
interface UiState {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));

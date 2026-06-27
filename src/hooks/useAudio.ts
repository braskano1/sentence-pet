import { useMemo } from 'react';
import { getSfx, type Sfx, type SfxName } from '../effects/sfx';
import { effectiveGain } from '../audio/mixer';
import { useGameStore } from '../state/gameStore';

let shared: Sfx | null = null;
function sfx(): Sfx {
  shared = shared ?? getSfx();
  return shared;
}

/** Reset the shared SFX instance (tests that swap the provider mid-run). */
export function resetSharedSfx(): void {
  shared = null;
}

/**
 * Stable audio facade. Callbacks read the mixer from getState() at call time,
 * so consumers (e.g. every PressButton) do NOT re-render when volume changes.
 */
export function useAudio() {
  return useMemo(
    () => ({
      play(name: SfxName) {
        const { audio } = useGameStore.getState();
        sfx().play(name, effectiveGain('sfx', audio));
      },
    }),
    [],
  );
}

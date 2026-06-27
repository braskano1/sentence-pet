import { useMemo } from 'react';
import { getSfx, type Sfx, type SfxName } from '../effects/sfx';
import { getMusic, type Music, type Zone, type StingerKind } from '../effects/music';
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

let sharedMusic: Music | null = null;
function music(): Music {
  sharedMusic = sharedMusic ?? getMusic();
  return sharedMusic;
}

/** Reset the shared Music instance (tests that swap the provider mid-run). */
export function resetSharedMusic(): void {
  sharedMusic = null;
}

// --- Autoplay-gesture deferral ------------------------------------------------
// Browsers block audio before the first user gesture. Screen-mount effects call
// setZone() on load, possibly BEFORE any gesture — so we ARM the desired zone and
// only push it to the engine once a gesture unlocks playback.
let gestureUnlocked = false;
let armedZone: Zone | null = null;

/** First gesture: mark unlocked and flush the armed zone (if any) into the engine. */
function unlock(): void {
  gestureUnlocked = true;
  if (armedZone !== null) {
    const { audio } = useGameStore.getState();
    music().setZone(armedZone, effectiveGain('music', audio));
  }
}

/**
 * Test-only reset of the gesture/armed module state. Production code never calls
 * this. Tests need it because gestureUnlocked / armedZone are module-level and
 * would otherwise leak across test cases, making them order-dependent.
 */
export function __resetAudioGestureForTest(): void {
  gestureUnlocked = false;
  armedZone = null;
}

// One-time global gesture listener so a music-only screen (e.g. title, no SFX)
// still unlocks on the very first interaction. Registered once at module init.
if (typeof window !== 'undefined') {
  const onFirstGesture = () => {
    window.removeEventListener('pointerdown', onFirstGesture);
    window.removeEventListener('keydown', onFirstGesture);
    window.removeEventListener('touchstart', onFirstGesture);
    unlock();
  };
  window.addEventListener('pointerdown', onFirstGesture);
  window.addEventListener('keydown', onFirstGesture);
  window.addEventListener('touchstart', onFirstGesture);
}

// Live music-gain push. The hook never subscribes (so consumers don't re-render),
// so this single module-level subscription forwards mixer/mute changes to the
// currently-playing loop. Uses the optional sharedMusic so it never force-creates
// audio before something is actually playing; setGain() no-ops when idle.
useGameStore.subscribe((state, prev) => {
  if (state.audio === prev.audio) return;
  sharedMusic?.setGain(effectiveGain('music', state.audio));
});

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
        // Taps/drops ARE user gestures — flush any armed zone on the first one.
        if (!gestureUnlocked) unlock();
      },
      setZone(zone: Zone) {
        armedZone = zone; // always record the latest desired zone
        if (gestureUnlocked) {
          const { audio } = useGameStore.getState();
          music().setZone(zone, effectiveGain('music', audio));
        }
      },
      playStinger(kind: StingerKind) {
        const { audio } = useGameStore.getState();
        music().playStinger(kind, effectiveGain('music', audio));
      },
    }),
    [],
  );
}

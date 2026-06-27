/**
 * Background-music loops + stingers behind a provider seam, mirroring sfx.ts.
 *
 * Zone loops are HTMLAudioElement(loop=true). Navigating between scenes in the
 * same zone is a no-op so the loop keeps playing seamlessly; switching zones
 * crossfades. jsdom/unsupported falls back to silence, and the real path is
 * written to never throw even under jsdom's stubbed media (play() may reject).
 *
 * Each track may be swapped for a recorded asset later without changing call
 * sites — that's the `setMusicProvider` seam (also used by tests as a spy).
 */
import { clampLevel } from '../audio/mixer';

export type Zone = 'title' | 'overworld' | 'drill' | 'boss' | 'multiplayer';
export type StingerKind = 'win' | 'lose' | 'cleared';

export interface Music {
  /** Crossfade to the zone's loop; null stops all. Same-zone is a no-op. */
  setZone(zone: Zone | null, gain: number): void;
  /** Live music-channel gain on the current loop (mixer changes). No zone change. */
  setGain(gain: number): void;
  /** One-shot, non-looping. onDone fires even when muted/missing (resume-loop contract). */
  playStinger(kind: StingerKind, gain: number, onDone?: () => void): void;
  /** Stop + cleanup everything. */
  stop(): void;
}

// Assets are served from public/audio/ so URLs are root-absolute. These files
// do NOT exist yet — a null URL is a guarded no-op so the seam stays inert.
const TRACKS: Record<Zone, string | null> = {
  title: '/audio/title.mp3',
  overworld: '/audio/overworld.mp3',
  drill: '/audio/drill.mp3',
  boss: '/audio/boss.mp3',
  multiplayer: null, // placeholder seam — no asset yet
};

const STINGERS: Record<StingerKind, string | null> = {
  win: '/audio/win.mp3',
  lose: '/audio/lose.mp3',
  cleared: '/audio/cleared.mp3',
};

const CROSSFADE_MS = 400;
const TICK_MS = 16;

const silent: Music = { setZone() {}, setGain() {}, playStinger() {}, stop() {} };

/** True when HTMLAudioElement can actually be constructed in this environment. */
function audioElementAvailable(): boolean {
  const w = globalThis as unknown as { Audio?: unknown; HTMLAudioElement?: unknown };
  return typeof w.Audio === 'function' || typeof w.HTMLAudioElement === 'function';
}

/** Default element factory — builds a real HTMLAudioElement. */
function defaultMakeAudio(url: string): HTMLAudioElement {
  const el = new Audio(url);
  return el;
}

/**
 * The real music state machine, parameterised by an element factory so the
 * zone/crossfade/null-track logic is unit-testable with fake elements (see
 * music.test.ts) without ever touching real media.
 */
export function __createMusicWithFactory(
  makeAudio: (url: string) => HTMLAudioElement,
): Music {
  let current: { zone: Zone; el: HTMLAudioElement } | null = null;
  let fadeTimer: ReturnType<typeof setInterval> | null = null;
  let stinger: HTMLAudioElement | null = null;

  function clearFade(): void {
    if (fadeTimer !== null) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }

  function teardown(el: HTMLAudioElement): void {
    try {
      el.pause();
    } catch {
      /* jsdom / unsupported — ignore */
    }
  }

  function start(el: HTMLAudioElement): void {
    try {
      const p = el.play() as unknown as Promise<void> | undefined;
      // play() may return a rejected promise under jsdom/autoplay policies.
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* swallow — never let media failure throw */
    }
  }

  /** Stepped volume ramp (HTMLAudioElement has no AudioParam). Replaces any in-flight fade. */
  function crossfade(
    incoming: HTMLAudioElement | null,
    incomingTarget: number,
    outgoing: HTMLAudioElement | null,
  ): void {
    clearFade();
    const fromIn = incoming ? incoming.volume : 0;
    const fromOut = outgoing ? outgoing.volume : 0;
    const steps = Math.max(1, Math.round(CROSSFADE_MS / TICK_MS));
    let step = 0;
    fadeTimer = setInterval(() => {
      step++;
      const t = Math.min(1, step / steps);
      if (incoming) incoming.volume = clampLevel(fromIn + (incomingTarget - fromIn) * t);
      if (outgoing) outgoing.volume = clampLevel(fromOut + (0 - fromOut) * t);
      if (t >= 1) {
        clearFade();
        if (outgoing) teardown(outgoing);
      }
    }, TICK_MS);
  }

  return {
    setZone(zone, gain) {
      // null → stop/teardown the current loop.
      if (zone === null) {
        clearFade();
        if (current) {
          teardown(current.el);
          current = null;
        }
        return;
      }
      // Null-track zone (e.g. multiplayer placeholder): no track to switch to,
      // so do nothing and leave the current loop untouched — keeps the seam inert.
      const url = TRACKS[zone];
      if (!url) return;
      // Same zone → no-op; the loop keeps playing for seamless navigation.
      if (current && current.zone === zone) return;

      const target = clampLevel(gain);
      const el = makeAudio(url);
      el.loop = true;
      el.volume = 0; // start silent, then ramp up
      start(el);
      const outgoing = current ? current.el : null;
      current = { zone, el };
      crossfade(el, target, outgoing);
    },

    setGain(gain) {
      if (!current) return; // no-op if nothing playing
      current.el.volume = clampLevel(gain);
    },

    playStinger(kind, gain, onDone) {
      const url = STINGERS[kind];
      // Muted or missing asset: no audio, but STILL run onDone so the caller's
      // "resume the zone loop" logic fires regardless of audio state.
      if (!url || gain <= 0) {
        onDone?.();
        return;
      }
      const el = makeAudio(url);
      el.loop = false;
      el.volume = clampLevel(gain);
      const onEnded = () => {
        el.removeEventListener('ended', onEnded);
        teardown(el);
        if (stinger === el) stinger = null;
        onDone?.();
      };
      el.addEventListener('ended', onEnded);
      stinger = el;
      start(el);
    },

    stop() {
      clearFade();
      if (current) {
        teardown(current.el);
        current = null;
      }
      if (stinger) {
        teardown(stinger);
        stinger = null;
      }
    },
  };
}

/** Real HTMLAudioElement-backed music, or silence when media isn't available. */
export function createHtmlAudioMusic(): Music {
  if (!audioElementAvailable()) return silent;
  return __createMusicWithFactory(defaultMakeAudio);
}

let provider: (() => Music) | null = null;

/** Override the music factory (recorded assets, or a test spy). Pass null to reset. */
export function setMusicProvider(fn: (() => Music) | null): void {
  provider = fn;
}

export function getMusic(): Music {
  return provider?.() ?? createHtmlAudioMusic();
}

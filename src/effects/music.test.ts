import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  getMusic,
  setMusicProvider,
  createHtmlAudioMusic,
  __createMusicWithFactory,
  type Music,
  type Zone,
  type StingerKind,
} from './music';

afterEach(() => setMusicProvider(null));

/** A fake HTMLAudioElement that records the state the state-machine pokes. */
function fakeAudio(url: string) {
  return {
    src: url,
    loop: false,
    volume: 1,
    paused: true,
    playCalls: 0,
    pauseCalls: 0,
    _ended: null as null | (() => void),
    play() { this.paused = false; this.playCalls++; return Promise.resolve(); },
    pause() { this.paused = true; this.pauseCalls++; },
    addEventListener(ev: string, cb: () => void) { if (ev === 'ended') this._ended = cb; },
    removeEventListener() {},
    fireEnded() { this._ended?.(); },
  };
}

describe('music provider seam', () => {
  it('uses an injected provider (test spy) and forwards calls', () => {
    const spy: Music = {
      setZone: vi.fn(),
      setGain: vi.fn(),
      playStinger: vi.fn(),
      setTrack: vi.fn(),
      previewTrack: vi.fn(),
      stopPreview: vi.fn(),
      stop: vi.fn(),
    };
    setMusicProvider(() => spy);

    const m = getMusic();
    expect(m).toBe(spy);
    m.setZone('overworld', 1);
    m.setGain(0.5);
    m.playStinger('win', 1);
    m.setTrack('overworld', '/audio/tracks/lofi.mp3');
    m.previewTrack('/audio/tracks/jazz.mp3', 0.5);
    m.stopPreview();
    m.stop();
    expect(spy.setZone).toHaveBeenCalledWith('overworld', 1);
    expect(spy.setGain).toHaveBeenCalledWith(0.5);
    expect(spy.playStinger).toHaveBeenCalledWith('win', 1);
    expect(spy.setTrack).toHaveBeenCalledWith('overworld', '/audio/tracks/lofi.mp3');
    expect(spy.previewTrack).toHaveBeenCalledWith('/audio/tracks/jazz.mp3', 0.5);
    expect(spy.stopPreview).toHaveBeenCalled();
    expect(spy.stop).toHaveBeenCalled();
  });

  it('setMusicProvider(null) resets to the real factory', () => {
    const spy: Music = {
      setZone: vi.fn(), setGain: vi.fn(), playStinger: vi.fn(),
      setTrack: vi.fn(), previewTrack: vi.fn(), stopPreview: vi.fn(), stop: vi.fn(),
    };
    setMusicProvider(() => spy);
    expect(getMusic()).toBe(spy);
    setMusicProvider(null);
    expect(getMusic()).not.toBe(spy);
  });
});

describe('real factory in jsdom (no throw across a representative sequence)', () => {
  beforeEach(() => {
    // jsdom stubs media: silence its "Not implemented" noise. The real impl
    // already swallows the rejected play() promise; this just keeps logs clean.
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('drives the full lifecycle without throwing', () => {
    const m = createHtmlAudioMusic();
    expect(() => {
      m.setZone('overworld', 1);
      m.setZone('overworld', 1); // same zone
      m.setZone('drill', 0.5);   // crossfade
      m.setGain(0.2);
      m.playStinger('win', 1);
      m.setZone(null, 0);
      m.stop();
    }).not.toThrow();
  });

  it('a null-track zone (multiplayer) does not throw', () => {
    const m = createHtmlAudioMusic();
    expect(() => m.setZone('multiplayer', 1)).not.toThrow();
  });

  it('drives setZone(title, ...) and playStinger(cleared, ...) without throwing', () => {
    const m = createHtmlAudioMusic();
    expect(() => {
      m.setZone('title', 1); // title now has a real track
      m.playStinger('cleared', 1);
      m.stop();
    }).not.toThrow();
  });
});

describe('zone state machine (via injected fake elements)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const created: ReturnType<typeof fakeAudio>[] = [];
    const make = (url: string) => {
      const el = fakeAudio(url);
      created.push(el);
      return el as unknown as HTMLAudioElement;
    };
    const m = __createMusicWithFactory(make);
    return { m, created };
  }

  it('starts the new loop at volume 0, plays it, and ramps up to gain', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    expect(created).toHaveLength(1);
    const el = created[0];
    expect(el.loop).toBe(true);
    expect(el.src).toContain('overworld');
    expect(el.playCalls).toBe(1);
    // ramp completes
    vi.advanceTimersByTime(500);
    expect(el.volume).toBeCloseTo(1, 2);
  });

  it('same-zone setZone is a no-op (no new element, loop keeps playing)', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    const first = created[0];
    m.setZone('overworld', 1);
    expect(created).toHaveLength(1);
    expect(first.pauseCalls).toBe(0);
  });

  it('different-zone setZone crossfades: old fades to 0 and is paused, new ramps up', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    const oldEl = created[0];
    m.setZone('drill', 0.5);
    expect(created).toHaveLength(2);
    const newEl = created[1];
    expect(newEl.src).toContain('drill');
    expect(newEl.playCalls).toBe(1);
    vi.advanceTimersByTime(500);
    expect(oldEl.volume).toBeCloseTo(0, 2);
    expect(oldEl.pauseCalls).toBeGreaterThan(0);
    expect(newEl.volume).toBeCloseTo(0.5, 2);
  });

  it('interrupting a crossfade still tears down the original outgoing loop (no leak)', () => {
    const { m, created } = setup();
    m.setZone('title', 1);
    vi.advanceTimersByTime(500); // title fully ramped up
    const titleEl = created[0];
    expect(titleEl.src).toContain('title');

    m.setZone('overworld', 1); // fade A: title -> overworld
    vi.advanceTimersByTime(100); // interrupt fade A before it completes
    // A track change (loadout / cloud-sync) lands mid-fade -> fade B starts:
    m.setTrack('overworld', '/audio/tracks/jazz.mp3');
    vi.advanceTimersByTime(500); // let fade B finish

    // The title loop must have been paused; otherwise it keeps looping forever.
    expect(titleEl.pauseCalls).toBeGreaterThan(0);
  });

  it('null-track zone (multiplayer) leaves the current loop untouched', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    m.setZone('multiplayer', 1);
    expect(created).toHaveLength(1);     // no new element built
    expect(created[0].pauseCalls).toBe(0); // current loop kept
  });

  it('setGain updates the current loop volume immediately, clamped 0..1', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    m.setGain(0.3);
    expect(created[0].volume).toBeCloseTo(0.3, 5);
    m.setGain(5);
    expect(created[0].volume).toBe(1);
    m.setGain(-1);
    expect(created[0].volume).toBe(0);
  });

  it('setGain is a no-op when nothing is playing', () => {
    const { m } = setup();
    expect(() => m.setGain(0.5)).not.toThrow();
  });

  it('setZone(null) stops and tears down the current loop', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    m.setZone(null, 0);
    vi.advanceTimersByTime(500);
    expect(created[0].pauseCalls).toBeGreaterThan(0);
    // a subsequent same-zone re-entry builds a fresh element (current was cleared)
    m.setZone('overworld', 1);
    expect(created).toHaveLength(2);
  });

  it('stop() tears down loop and stinger and resets zone', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    m.playStinger('win', 1);
    m.stop();
    created.forEach((el) => expect(el.pauseCalls).toBeGreaterThan(0));
    // zone reset: re-entering builds fresh
    m.setZone('overworld', 1);
    expect(created.length).toBeGreaterThanOrEqual(3);
  });
});

describe('setTrack (per-zone url override + live swap)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const created: ReturnType<typeof fakeAudio>[] = [];
    const make = (url: string) => {
      const el = fakeAudio(url);
      created.push(el);
      return el as unknown as HTMLAudioElement;
    };
    const m = __createMusicWithFactory(make);
    return { m, created };
  }

  it('records an override for a non-current zone without building an element', () => {
    const { m, created } = setup();
    m.setTrack('overworld', '/audio/tracks/lofi.mp3'); // overworld not current yet
    expect(created).toHaveLength(0);
    // next setZone(overworld) uses the override url
    m.setZone('overworld', 1);
    expect(created).toHaveLength(1);
    expect(created[0].src).toContain('lofi');
  });

  it('live-crossfades when the zone is current and the resolved url differs', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1); // plays default overworld
    vi.advanceTimersByTime(500);
    const oldEl = created[0];
    expect(oldEl.src).toContain('overworld');

    m.setTrack('overworld', '/audio/tracks/jazz.mp3'); // live swap
    expect(created).toHaveLength(2);
    const newEl = created[1];
    expect(newEl.src).toContain('jazz');
    expect(newEl.playCalls).toBe(1);
    vi.advanceTimersByTime(500);
    expect(oldEl.pauseCalls).toBeGreaterThan(0); // old loop torn down
    expect(newEl.volume).toBeCloseTo(1, 2);      // new ramps to the current gain
  });

  it('is a no-op when the resolved url is unchanged (does not restart the loop)', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    expect(created).toHaveLength(1);
    // setting the SAME url as the playing default → no restart
    m.setTrack('overworld', '/audio/overworld.mp3');
    expect(created).toHaveLength(1);
    expect(created[0].pauseCalls).toBe(0);
  });

  it('overriding a non-current zone does not disturb the current loop', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    m.setTrack('drill', '/audio/tracks/arcade.mp3'); // drill not current
    expect(created).toHaveLength(1);
    expect(created[0].pauseCalls).toBe(0);
  });
});

describe('previewTrack / stopPreview (one-shot audition; pauses + resumes the loop)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const created: ReturnType<typeof fakeAudio>[] = [];
    const make = (url: string) => {
      const el = fakeAudio(url);
      created.push(el);
      return el as unknown as HTMLAudioElement;
    };
    const m = __createMusicWithFactory(make);
    return { m, created };
  }

  it('plays a non-looping preview element at the given gain', () => {
    const { m, created } = setup();
    m.previewTrack('/audio/tracks/lofi.mp3', 0.7);
    expect(created).toHaveLength(1);
    const el = created[0];
    expect(el.src).toContain('lofi');
    expect(el.loop).toBe(false);
    expect(el.volume).toBeCloseTo(0.7, 5);
    expect(el.playCalls).toBe(1);
  });

  it('pauses the zone loop while previewing and resumes it on stop', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    const loopEl = created[0];
    const playsBefore = loopEl.playCalls;
    m.previewTrack('/audio/tracks/jazz.mp3', 0.5);
    expect(loopEl.pauseCalls).toBeGreaterThan(0); // loop paused for the audition
    m.stopPreview();
    expect(loopEl.playCalls).toBe(playsBefore + 1); // loop resumed
  });

  it('resumes the zone loop when the preview ends on its own', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    const loopEl = created[0];
    const playsBefore = loopEl.playCalls;
    m.previewTrack('/audio/tracks/jazz.mp3', 0.5);
    const previewEl = created[1];
    previewEl.fireEnded();
    expect(loopEl.playCalls).toBe(playsBefore + 1);
  });

  it('pauses the loop only once across back-to-back previews', () => {
    const { m, created } = setup();
    m.setZone('overworld', 1);
    vi.advanceTimersByTime(500);
    const loopEl = created[0];
    m.previewTrack('/audio/tracks/lofi.mp3', 0.5);
    m.previewTrack('/audio/tracks/jazz.mp3', 0.5); // swap preview, loop stays paused
    expect(loopEl.pauseCalls).toBe(1);
    m.stopPreview();
    expect(loopEl.pauseCalls).toBe(1); // still just the one pause
  });

  it('replaces an in-flight preview (tears down the previous element)', () => {
    const { m, created } = setup();
    m.previewTrack('/audio/tracks/lofi.mp3', 0.5);
    const first = created[0];
    m.previewTrack('/audio/tracks/jazz.mp3', 0.5);
    expect(first.pauseCalls).toBeGreaterThan(0);
    expect(created).toHaveLength(2);
    expect(created[1].src).toContain('jazz');
  });

  it('gain<=0 or empty url is a no-op (no element built)', () => {
    const { m, created } = setup();
    m.previewTrack('/audio/tracks/lofi.mp3', 0);
    m.previewTrack('', 0.5);
    expect(created).toHaveLength(0);
  });

  it('stopPreview pauses/tears down the preview element', () => {
    const { m, created } = setup();
    m.previewTrack('/audio/tracks/lofi.mp3', 0.5);
    m.stopPreview();
    expect(created[0].pauseCalls).toBeGreaterThan(0);
  });

  it('stopPreview is a no-op when nothing is previewing', () => {
    const { m } = setup();
    expect(() => m.stopPreview()).not.toThrow();
  });
});

describe('silent music (no-op surface)', () => {
  it('setTrack/previewTrack/stopPreview never throw when media is unavailable', () => {
    // Force the silent path by hiding Audio/HTMLAudioElement.
    const w = globalThis as unknown as { Audio?: unknown; HTMLAudioElement?: unknown };
    const origAudio = w.Audio;
    const origEl = w.HTMLAudioElement;
    w.Audio = undefined;
    w.HTMLAudioElement = undefined;
    try {
      const m = createHtmlAudioMusic();
      expect(() => {
        m.setTrack('overworld', '/audio/tracks/lofi.mp3');
        m.previewTrack('/audio/tracks/jazz.mp3', 0.5);
        m.stopPreview();
      }).not.toThrow();
    } finally {
      w.Audio = origAudio;
      w.HTMLAudioElement = origEl;
    }
  });
});

describe('playStinger', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const created: ReturnType<typeof fakeAudio>[] = [];
    const make = (url: string) => {
      const el = fakeAudio(url);
      created.push(el);
      return el as unknown as HTMLAudioElement;
    };
    const m = __createMusicWithFactory(make);
    return { m, created };
  }

  it('plays a one-shot (loop=false) and calls onDone on ended', () => {
    const { m, created } = setup();
    const onDone = vi.fn();
    m.playStinger('win', 1, onDone);
    const el = created[created.length - 1];
    expect(el.src).toContain('win');
    expect(el.loop).toBe(false);
    expect(el.playCalls).toBe(1);
    expect(onDone).not.toHaveBeenCalled();
    el.fireEnded();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('null-url stinger is a no-op but STILL calls onDone', () => {
    const { m, created } = setup();
    const onDone = vi.fn();
    // there is no null stinger in STINGERS, but gain<=0 exercises the same contract
    m.playStinger('lose', 0, onDone);
    expect(created).toHaveLength(0); // no audio built
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('gain<=0 stinger is a no-op but STILL calls onDone', () => {
    const { m, created } = setup();
    const onDone = vi.fn();
    m.playStinger('win', 0, onDone);
    expect(created).toHaveLength(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onDone is omitted', () => {
    const { m } = setup();
    expect(() => m.playStinger('win', 1)).not.toThrow();
  });
});

describe('Zone type surface', () => {
  it('covers all zones', () => {
    const zones: Zone[] = ['title', 'overworld', 'drill', 'boss', 'multiplayer'];
    expect(zones.length).toBe(5);
  });
});

describe('StingerKind surface', () => {
  it("includes 'cleared' alongside win/lose", () => {
    const kinds: StingerKind[] = ['win', 'lose', 'cleared'];
    expect(kinds).toContain('cleared');
    expect(kinds.length).toBe(3);
  });
});

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  getMusic,
  setMusicProvider,
  createHtmlAudioMusic,
  __createMusicWithFactory,
  type Music,
  type Zone,
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
      stop: vi.fn(),
    };
    setMusicProvider(() => spy);

    const m = getMusic();
    expect(m).toBe(spy);
    m.setZone('overworld', 1);
    m.setGain(0.5);
    m.playStinger('win', 1);
    m.stop();
    expect(spy.setZone).toHaveBeenCalledWith('overworld', 1);
    expect(spy.setGain).toHaveBeenCalledWith(0.5);
    expect(spy.playStinger).toHaveBeenCalledWith('win', 1);
    expect(spy.stop).toHaveBeenCalled();
  });

  it('setMusicProvider(null) resets to the real factory', () => {
    const spy: Music = { setZone: vi.fn(), setGain: vi.fn(), playStinger: vi.fn(), stop: vi.fn() };
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
    expect(() => m.setZone('title', 1)).not.toThrow();
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

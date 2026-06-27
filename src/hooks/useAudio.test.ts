import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { setSfxProvider, type Sfx } from '../effects/sfx';
import { setMusicProvider, type Music } from '../effects/music';
import { useGameStore } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';
import {
  useAudio,
  resetSharedSfx,
  resetSharedMusic,
  __resetAudioGestureForTest,
} from './useAudio';

afterEach(() => {
  setSfxProvider(null);
  resetSharedSfx();
  setMusicProvider(null);
  resetSharedMusic();
  __resetAudioGestureForTest();
  useGameStore.getState().equipTrack(null); // reset equipped track between cases
});

/** A music spy that records every call, installed via the provider seam. */
function spyMusic() {
  const setZone = vi.fn();
  const setGain = vi.fn();
  const playStinger = vi.fn();
  const setTrack = vi.fn();
  const previewTrack = vi.fn();
  const stopPreview = vi.fn();
  const stop = vi.fn();
  const instance: Music = { setZone, setGain, playStinger, setTrack, previewTrack, stopPreview, stop };
  setMusicProvider((): Music => instance);
  resetSharedMusic();
  return { setZone, setGain, playStinger, setTrack, previewTrack, stopPreview, stop };
}

describe('useAudio — SFX', () => {
  it('plays at the effective SFX gain (master * sfx)', () => {
    const play = vi.fn();
    setSfxProvider((): Sfx => ({ play, stop: vi.fn() }));
    resetSharedSfx();
    const a = defaultAudioSettings();
    a.master.level = 0.5; a.sfx.level = 0.6;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.play('tap');
    expect(play).toHaveBeenCalledWith('tap', 0.3);
  });

  it('forwards 0 gain when the SFX channel is muted', () => {
    const play = vi.fn();
    setSfxProvider((): Sfx => ({ play, stop: vi.fn() }));
    resetSharedSfx();
    const a = defaultAudioSettings(); a.sfx.muted = true;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.play('correct');
    expect(play).toHaveBeenCalledWith('correct', 0);
  });
});

describe('useAudio — music zone & gesture deferral', () => {
  it('does NOT forward setZone before any gesture (armed only)', () => {
    const m = spyMusic();
    useGameStore.setState({ audio: defaultAudioSettings() });

    const { result } = renderHook(() => useAudio());
    result.current.setZone('overworld');

    expect(m.setZone).not.toHaveBeenCalled();
  });

  it('flushes the armed zone on the first SFX gesture with effective music gain', () => {
    const m = spyMusic();
    const a = defaultAudioSettings();
    a.master.level = 0.5; a.music.level = 0.6;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.setZone('overworld'); // armed, not forwarded
    expect(m.setZone).not.toHaveBeenCalled();

    result.current.play('tap'); // first gesture → flush
    expect(m.setZone).toHaveBeenCalledWith('overworld', 0.3);
  });

  it('flushes the armed zone on a window pointerdown gesture', () => {
    const m = spyMusic();
    const a = defaultAudioSettings();
    a.master.level = 1; a.music.level = 1;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.setZone('drill');
    expect(m.setZone).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('pointerdown'));
    expect(m.setZone).toHaveBeenCalledWith('drill', 1);
  });

  it('forwards setZone immediately once unlocked, with effective music gain', () => {
    const m = spyMusic();
    const a = defaultAudioSettings();
    a.master.level = 0.5; a.music.level = 0.6;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.play('tap'); // unlock
    result.current.setZone('boss'); // now immediate
    expect(m.setZone).toHaveBeenCalledWith('boss', 0.3);
  });

  it('forwards gain 0 when the music channel is muted', () => {
    const m = spyMusic();
    const a = defaultAudioSettings(); a.music.muted = true;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.play('tap'); // unlock
    result.current.setZone('overworld');
    expect(m.setZone).toHaveBeenCalledWith('overworld', 0);
  });

  it('forwards setZone(null) as a stop (null zone, gain 0) once unlocked', () => {
    const m = spyMusic();
    useGameStore.setState({ audio: defaultAudioSettings() });

    const { result } = renderHook(() => useAudio());
    result.current.play('tap'); // unlock
    result.current.setZone(null);
    expect(m.setZone).toHaveBeenCalledWith(null, 0);
  });

  it('does NOT start anything for a pre-gesture setZone(null)', () => {
    const m = spyMusic();
    useGameStore.setState({ audio: defaultAudioSettings() });

    const { result } = renderHook(() => useAudio());
    result.current.setZone(null); // armed as "nothing", deferred
    expect(m.setZone).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('pointerdown')); // unlock flushes armed zone
    expect(m.setZone).not.toHaveBeenCalled(); // null armed → nothing to start
  });
});

describe('useAudio — stinger', () => {
  it('forwards playStinger to the engine with effective music gain', () => {
    const m = spyMusic();
    const a = defaultAudioSettings();
    a.master.level = 0.5; a.music.level = 0.6;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.playStinger('win');
    expect(m.playStinger).toHaveBeenCalledWith('win', 0.3);
  });
});

describe('useAudio — overworld track push', () => {
  it('setZone(overworld) pushes setTrack(default url) BEFORE setZone once unlocked', () => {
    const m = spyMusic();
    const a = defaultAudioSettings();
    a.master.level = 1; a.music.level = 1;
    useGameStore.setState({ audio: a });
    useGameStore.getState().equipTrack(null); // default

    const { result } = renderHook(() => useAudio());
    result.current.play('tap'); // unlock
    result.current.setZone('overworld');

    expect(m.setTrack).toHaveBeenCalledWith('overworld', '/audio/overworld.mp3');
    expect(m.setZone).toHaveBeenCalledWith('overworld', 1);
    // setTrack pushed before setZone
    expect(m.setTrack.mock.invocationCallOrder[0]).toBeLessThan(
      m.setZone.mock.invocationCallOrder[0],
    );
  });

  it('setZone(overworld) pushes the equipped track src when one is active', () => {
    const m = spyMusic();
    useGameStore.setState({ audio: defaultAudioSettings() });
    useGameStore.getState().equipTrack('music:lofi');

    const { result } = renderHook(() => useAudio());
    result.current.play('tap'); // unlock
    result.current.setZone('overworld');

    expect(m.setTrack).toHaveBeenCalledWith('overworld', '/audio/tracks/lofi.mp3');
  });

  it('does NOT push setTrack for non-overworld zones', () => {
    const m = spyMusic();
    useGameStore.setState({ audio: defaultAudioSettings() });

    const { result } = renderHook(() => useAudio());
    result.current.play('tap'); // unlock
    result.current.setZone('drill');

    expect(m.setTrack).not.toHaveBeenCalled();
  });

  it('changing activeTrack in the store live-pushes setTrack on the shared instance', () => {
    const m = spyMusic();
    useGameStore.setState({ audio: defaultAudioSettings() });

    const { result } = renderHook(() => useAudio());
    // Get something playing so sharedMusic is the spy.
    result.current.play('tap'); // unlock
    result.current.setZone('overworld');
    m.setTrack.mockClear();

    useGameStore.getState().equipTrack('music:jazz');
    expect(m.setTrack).toHaveBeenCalledWith('overworld', '/audio/tracks/jazz.mp3');
  });
});

describe('useAudio — preview', () => {
  it('previewTrack forwards at the effective music gain', () => {
    const m = spyMusic();
    const a = defaultAudioSettings();
    a.master.level = 0.5; a.music.level = 0.6;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.previewTrack('/audio/tracks/lofi.mp3');
    expect(m.previewTrack).toHaveBeenCalledWith('/audio/tracks/lofi.mp3', 0.3);
  });

  it('previewTrack forwards gain 0 when music is muted', () => {
    const m = spyMusic();
    const a = defaultAudioSettings(); a.music.muted = true;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.previewTrack('/audio/tracks/lofi.mp3');
    expect(m.previewTrack).toHaveBeenCalledWith('/audio/tracks/lofi.mp3', 0);
  });

  it('stopPreview forwards to the engine', () => {
    const m = spyMusic();
    useGameStore.setState({ audio: defaultAudioSettings() });

    const { result } = renderHook(() => useAudio());
    result.current.stopPreview();
    expect(m.stopPreview).toHaveBeenCalled();
  });
});

describe('useAudio — live music-gain push', () => {
  it('pushes new effective gain to the playing loop on a slider change', () => {
    const m = spyMusic();
    const a = defaultAudioSettings();
    a.master.level = 1; // so music slider value == effective gain
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    // Make the spy the shared instance by getting something playing.
    result.current.play('tap'); // unlock
    result.current.setZone('overworld');
    expect(m.setZone).toHaveBeenCalled();

    useGameStore.getState().setChannelLevel('music', 0.2);
    expect(m.setGain).toHaveBeenCalledWith(0.2);
  });

  it('pushes gain 0 when the music channel is muted via the store', () => {
    const m = spyMusic();
    useGameStore.setState({ audio: defaultAudioSettings() });

    const { result } = renderHook(() => useAudio());
    result.current.play('tap'); // unlock
    result.current.setZone('overworld');

    useGameStore.getState().toggleChannelMute('music');
    expect(m.setGain).toHaveBeenCalledWith(0);
  });
});

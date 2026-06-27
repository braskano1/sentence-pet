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
});

/** A music spy that records every call, installed via the provider seam. */
function spyMusic() {
  const setZone = vi.fn();
  const setGain = vi.fn();
  const playStinger = vi.fn();
  const stop = vi.fn();
  const instance: Music = { setZone, setGain, playStinger, stop };
  setMusicProvider((): Music => instance);
  resetSharedMusic();
  return { setZone, setGain, playStinger, stop };
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
    useGameStore.setState({ audio: defaultAudioSettings() });

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

describe('useAudio — live music-gain push', () => {
  it('pushes new effective gain to the playing loop on a slider change', () => {
    const m = spyMusic();
    useGameStore.setState({ audio: defaultAudioSettings() });

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

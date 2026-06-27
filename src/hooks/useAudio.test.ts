import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { setSfxProvider, type Sfx } from '../effects/sfx';
import { useGameStore } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';
import { useAudio, resetSharedSfx } from './useAudio';

afterEach(() => { setSfxProvider(null); resetSharedSfx(); });

describe('useAudio', () => {
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

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameStore } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';

const { speak } = vi.hoisted(() => ({ speak: vi.fn() }));
vi.mock('../config/audio', () => ({ getSpeechProvider: () => ({ speak }) }));

import { useSpeech } from './useSpeech';

afterEach(() => speak.mockClear());

describe('useSpeech voice gating', () => {
  it('passes the effective voice volume', () => {
    const a = defaultAudioSettings(); a.master.level = 0.5; a.voice.level = 0.8;
    useGameStore.setState({ audio: a });
    renderHook(() => useSpeech()).result.current.speakWord('cat');
    expect(speak).toHaveBeenCalledWith('cat', 'en-US', 0.4);
  });

  it('does not speak when voice is muted', () => {
    const a = defaultAudioSettings(); a.voice.muted = true;
    useGameStore.setState({ audio: a });
    renderHook(() => useSpeech()).result.current.speakThai('แมว');
    expect(speak).not.toHaveBeenCalled();
  });

  it('routes each helper to the correct language', () => {
    const a = defaultAudioSettings(); // full volume, unmuted
    useGameStore.setState({ audio: a });
    const { result } = renderHook(() => useSpeech());
    result.current.speakWord('cat');
    result.current.speakThai('แมว');
    result.current.speakSentence('the cat sits');
    expect(speak).toHaveBeenNthCalledWith(1, 'cat', 'en-US', 1);
    expect(speak).toHaveBeenNthCalledWith(2, 'แมว', 'th-TH', 1);
    expect(speak).toHaveBeenNthCalledWith(3, 'the cat sits', 'en-US', 1);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const speak = vi.fn();
vi.mock('../config/audio', () => ({
  getSpeechProvider: () => ({ speak }),
  noopSpeech: { speak: () => {} },
}));

import { useSpeech } from './useSpeech';

describe('useSpeech', () => {
  it('routes words to en-US, the hint to th-TH, the sentence to en-US', () => {
    const { result } = renderHook(() => useSpeech());
    result.current.speakWord('feeds');
    result.current.speakThai('แมว');
    result.current.speakSentence('She feeds the cat');
    expect(speak).toHaveBeenNthCalledWith(1, 'feeds', 'en-US');
    expect(speak).toHaveBeenNthCalledWith(2, 'แมว', 'th-TH');
    expect(speak).toHaveBeenNthCalledWith(3, 'She feeds the cat', 'en-US');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSpeechProvider, noopSpeech } from './audio';

const realSynth = (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
const realUtter = (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;

afterEach(() => {
  (globalThis as Record<string, unknown>).speechSynthesis = realSynth;
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = realUtter;
});

describe('getSpeechProvider', () => {
  it('returns the no-op provider when speech synthesis is unavailable', () => {
    delete (globalThis as Record<string, unknown>).speechSynthesis;
    expect(getSpeechProvider()).toBe(noopSpeech);
    expect(() => getSpeechProvider().speak('hi', 'en-US')).not.toThrow();
  });

  it('speaks an utterance with the given lang when available', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    (globalThis as Record<string, unknown>).speechSynthesis = { speak, cancel };
    (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = class {
      text: string; lang = '';
      constructor(t: string) { this.text = t; }
    };
    getSpeechProvider().speak('feeds', 'en-US');
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].lang).toBe('en-US');
    expect(speak.mock.calls[0][0].text).toBe('feeds');
  });
});

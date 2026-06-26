import { useMemo } from 'react';
import { getSpeechProvider } from '../config/audio';

export const EN = 'en-US';
export const TH = 'th-TH';

/** Stable speak helpers for the drill: English words/sentence, Thai meaning hint. */
export function useSpeech() {
  return useMemo(() => {
    const p = getSpeechProvider();
    return {
      speakWord: (w: string) => p.speak(w, EN),
      speakThai: (t: string) => p.speak(t, TH),
      speakSentence: (s: string) => p.speak(s, EN),
    };
  }, []);
}

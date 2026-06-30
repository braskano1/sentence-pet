import { useMemo } from 'react';
import { getSpeechProvider } from '../config/audio';
import { effectiveGain } from '../audio/mixer';
import { useGameStore } from '../state/gameStore';
import { normalizeSpeechWord } from './speechText';

export const EN = 'en-US';
export const TH = 'th-TH';

/** Stable speak helpers for the drill: English words/sentence, Thai meaning hint. */
export function useSpeech() {
  return useMemo(() => {
    const p = getSpeechProvider();
    const say = (text: string, lang: string) => {
      const g = effectiveGain('voice', useGameStore.getState().audio);
      if (g <= 0) return;
      p.speak(text, lang, g);
    };
    return {
      speakWord: (w: string) => say(normalizeSpeechWord(w), EN),
      speakThai: (t: string) => say(t, TH),
      speakSentence: (s: string) => say(s, EN),
    };
  }, []);
}

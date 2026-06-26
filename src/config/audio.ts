/** A pluggable text-to-speech sink. Swap the Web Speech impl for recorded clips later. */
export interface SpeechProvider {
  speak(text: string, lang: string): void;
}

export const noopSpeech: SpeechProvider = { speak: () => {} };

function webSpeech(): SpeechProvider {
  return {
    speak(text, lang) {
      const synth = globalThis.speechSynthesis!;
      const Utter = globalThis.SpeechSynthesisUtterance!;
      const utter = new Utter(text);
      utter.lang = lang;
      synth.cancel(); // never queue; speak the latest
      synth.speak(utter);
    },
  };
}

/** Web Speech when the browser supports it, otherwise a silent no-op. */
export function getSpeechProvider(): SpeechProvider {
  const g = globalThis as { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown };
  if (g.speechSynthesis && typeof g.SpeechSynthesisUtterance === 'function') {
    return webSpeech();
  }
  return noopSpeech;
}

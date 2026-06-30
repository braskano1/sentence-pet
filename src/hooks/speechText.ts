/**
 * Normalize a single-word speech string before it is spoken aloud.
 *
 * Alphabet flashcards display a letter pair like "A a" / "B b" (upper + lower
 * case) on purpose, but TTS reads that as the letter twice. When the text is
 * the SAME ASCII letter twice (any case), separated by whitespace, collapse it
 * to a single letter so it is spoken once. Everything else is returned as-is.
 */
export function normalizeSpeechWord(text: string): string {
  const m = text.trim().match(/^([A-Za-z])\s+([A-Za-z])$/);
  if (m && m[1].toLowerCase() === m[2].toLowerCase()) return m[1];
  return text;
}

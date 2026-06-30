/** Uppercase the first character of a token (display only). */
export function capitalizeFirst(word: string): string {
  if (word.length === 0) return word;
  return word[0].toUpperCase() + word.slice(1);
}

/** Render tokens as a real sentence: first word capitalized + trailing punctuation
 *  (default '.', pass '?' for questions). Display only — answer-check is unaffected. */
export function renderSentence(words: string[], endPunct: '.' | '?' = '.'): string {
  if (words.length === 0) return '';
  return capitalizeFirst(words[0]) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '') + endPunct;
}

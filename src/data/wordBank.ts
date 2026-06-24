import type { DrillItem, DrillType } from './types';

// Tokens are stored in natural mid-sentence form (lowercase), EXCEPT words that
// are always capitalized mid-sentence: the pronoun "I" and acronyms like "TV".
// Sentence-initial capitalization + trailing period are applied at DISPLAY time
// via domain/sentence.ts (capitalizeFirst / renderSentence).
export const WORD_BANK: DrillItem[] = [
  // Pattern · Level 1: S + V
  { id: 'l1-1', drill: 'pattern', level: 1, thaiHint: 'ฉันวิ่ง', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] },
  { id: 'l1-2', drill: 'pattern', level: 1, thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'] },
  { id: 'l1-3', drill: 'pattern', level: 1, thaiHint: 'พวกเรานอน', slots: ['Pronoun', 'Verb'], answer: ['we', 'sleep'] },
  { id: 'l1-4', drill: 'pattern', level: 1, thaiHint: 'เธอเดิน', slots: ['Pronoun', 'Verb'], answer: ['she', 'walks'] },
  { id: 'l1-5', drill: 'pattern', level: 1, thaiHint: 'พวกเขาเล่น', slots: ['Pronoun', 'Verb'], answer: ['they', 'play'] },
  // Pattern · Level 2: S + V + O
  { id: 'l2-1', drill: 'pattern', level: 2, thaiHint: 'ฉันกินข้าว', slots: ['Pronoun', 'Verb', 'Object'], answer: ['I', 'eat', 'rice'] },
  { id: 'l2-2', drill: 'pattern', level: 2, thaiHint: 'เขาดื่มน้ำ', slots: ['Pronoun', 'Verb', 'Object'], answer: ['he', 'drinks', 'water'] },
  { id: 'l2-3', drill: 'pattern', level: 2, thaiHint: 'เธออ่านหนังสือ', slots: ['Pronoun', 'Verb', 'Object'], answer: ['she', 'reads', 'a book'] },
  { id: 'l2-4', drill: 'pattern', level: 2, thaiHint: 'พวกเราเล่นฟุตบอล', slots: ['Pronoun', 'Verb', 'Object'], answer: ['we', 'play', 'football'] },
  { id: 'l2-5', drill: 'pattern', level: 2, thaiHint: 'พวกเขาดูทีวี', slots: ['Pronoun', 'Verb', 'Object'], answer: ['they', 'watch', 'TV'] },
  // Word-Choice · Level 1: same S+V frames, tray salted with 2 conjugation distractors
  { id: 'wc-l1-1', drill: 'wordChoice', level: 1, thaiHint: 'ฉันวิ่ง', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'], distractors: ['runs', 'running'] },
  { id: 'wc-l1-2', drill: 'wordChoice', level: 1, thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'], distractors: ['eat', 'eating'] },
  { id: 'wc-l1-3', drill: 'wordChoice', level: 1, thaiHint: 'พวกเรานอน', slots: ['Pronoun', 'Verb'], answer: ['we', 'sleep'], distractors: ['sleeps', 'sleeping'] },
  { id: 'wc-l1-4', drill: 'wordChoice', level: 1, thaiHint: 'เธอเดิน', slots: ['Pronoun', 'Verb'], answer: ['she', 'walks'], distractors: ['walk', 'walking'] },
  { id: 'wc-l1-5', drill: 'wordChoice', level: 1, thaiHint: 'พวกเขาเล่น', slots: ['Pronoun', 'Verb'], answer: ['they', 'play'], distractors: ['plays', 'playing'] },
];

export function itemsFor(drill: DrillType, level: number): DrillItem[] {
  return WORD_BANK.filter((i) => i.drill === drill && i.level === level);
}

/** Tiles for an item's tray: the answer words plus any distractors (component shuffles). */
export function trayWords(item: DrillItem): string[] {
  return [...item.answer, ...(item.distractors ?? [])];
}

/** Back-compat: existing callers that only want pattern items by level. */
export function itemsForLevel(level: number): DrillItem[] {
  return itemsFor('pattern', level);
}

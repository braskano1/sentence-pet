import type { DrillItem } from './types';

// Tokens are stored in natural mid-sentence form (lowercase), EXCEPT words that
// are always capitalized mid-sentence: the pronoun "I" and acronyms like "TV".
// Sentence-initial capitalization + trailing period are applied at DISPLAY time
// via domain/sentence.ts (capitalizeFirst / renderSentence).
export const WORD_BANK: DrillItem[] = [
  // Level 1: S + V
  { id: 'l1-1', level: 1, thaiHint: 'ฉันวิ่ง', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] },
  { id: 'l1-2', level: 1, thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'] },
  { id: 'l1-3', level: 1, thaiHint: 'พวกเรานอน', slots: ['Pronoun', 'Verb'], answer: ['we', 'sleep'] },
  { id: 'l1-4', level: 1, thaiHint: 'เธอเดิน', slots: ['Pronoun', 'Verb'], answer: ['she', 'walks'] },
  { id: 'l1-5', level: 1, thaiHint: 'พวกเขาเล่น', slots: ['Pronoun', 'Verb'], answer: ['they', 'play'] },
  // Level 2: S + V + O
  { id: 'l2-1', level: 2, thaiHint: 'ฉันกินข้าว', slots: ['Pronoun', 'Verb', 'Object'], answer: ['I', 'eat', 'rice'] },
  { id: 'l2-2', level: 2, thaiHint: 'เขาดื่มน้ำ', slots: ['Pronoun', 'Verb', 'Object'], answer: ['he', 'drinks', 'water'] },
  { id: 'l2-3', level: 2, thaiHint: 'เธออ่านหนังสือ', slots: ['Pronoun', 'Verb', 'Object'], answer: ['she', 'reads', 'a book'] },
  { id: 'l2-4', level: 2, thaiHint: 'พวกเราเล่นฟุตบอล', slots: ['Pronoun', 'Verb', 'Object'], answer: ['we', 'play', 'football'] },
  { id: 'l2-5', level: 2, thaiHint: 'พวกเขาดูทีวี', slots: ['Pronoun', 'Verb', 'Object'], answer: ['they', 'watch', 'TV'] },
];

export function itemsForLevel(level: number): DrillItem[] {
  return WORD_BANK.filter((i) => i.level === level);
}

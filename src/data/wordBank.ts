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
  // Grammar · Level 1: S+V subject–verb agreement, FLAG mode (accept near-miss + tip)
  { id: 'gr-l1-1', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'], traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }] },
  { id: 'gr-l1-2', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'เธอเดิน', slots: ['Pronoun', 'Verb'], answer: ['she', 'walks'], traps: [{ slot: 1, word: 'walk', tip: 'เธอ → she walks 👍' }] },
  { id: 'gr-l1-3', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'แมววิ่ง', slots: ['Pronoun', 'Verb'], answer: ['it', 'runs'], traps: [{ slot: 1, word: 'run', tip: 'it → it runs 👍' }] },
  { id: 'gr-l1-4', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'เขานอน', slots: ['Pronoun', 'Verb'], answer: ['he', 'sleeps'], traps: [{ slot: 1, word: 'sleep', tip: 'เขา → he sleeps 👍' }] },
  { id: 'gr-l1-5', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'เธอเล่น', slots: ['Pronoun', 'Verb'], answer: ['she', 'plays'], traps: [{ slot: 1, word: 'play', tip: 'เธอ → she plays 👍' }] },
  // Grammar · Level 2: same agreement frames, ENFORCE mode (near-miss rejected -> retry)
  { id: 'gr-l2-1', drill: 'grammar', level: 2, strictness: 'enforce', thaiHint: 'เขากิน', slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'], traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }] },
  { id: 'gr-l2-2', drill: 'grammar', level: 2, strictness: 'enforce', thaiHint: 'เธอเดิน', slots: ['Pronoun', 'Verb'], answer: ['she', 'walks'], traps: [{ slot: 1, word: 'walk', tip: 'เธอ → she walks 👍' }] },
  { id: 'gr-l2-3', drill: 'grammar', level: 2, strictness: 'enforce', thaiHint: 'แมววิ่ง', slots: ['Pronoun', 'Verb'], answer: ['it', 'runs'], traps: [{ slot: 1, word: 'run', tip: 'it → it runs 👍' }] },
  { id: 'gr-l2-4', drill: 'grammar', level: 2, strictness: 'enforce', thaiHint: 'เขานอน', slots: ['Pronoun', 'Verb'], answer: ['he', 'sleeps'], traps: [{ slot: 1, word: 'sleep', tip: 'เขา → he sleeps 👍' }] },
  { id: 'gr-l2-5', drill: 'grammar', level: 2, strictness: 'enforce', thaiHint: 'เธอเล่น', slots: ['Pronoun', 'Verb'], answer: ['she', 'plays'], traps: [{ slot: 1, word: 'play', tip: 'เธอ → she plays 👍' }] },
  // Mixed · Level 1 (the "boss"): S+V+O, ENFORCE, all three dials on
  // (1 agreement trap on the verb slot + 1 distractor). Enforce ⇒ near-miss & distractor reject to retry.
  { id: 'mx-l1-1', drill: 'mixed', level: 1, strictness: 'enforce', thaiHint: 'ฉันกินข้าว', slots: ['Pronoun', 'Verb', 'Object'], answer: ['I', 'eat', 'rice'], distractors: ['bread'], traps: [{ slot: 1, word: 'eats', tip: 'ฉัน → I eat 👍' }] },
  { id: 'mx-l1-2', drill: 'mixed', level: 1, strictness: 'enforce', thaiHint: 'เขาดื่มน้ำ', slots: ['Pronoun', 'Verb', 'Object'], answer: ['he', 'drinks', 'water'], distractors: ['juice'], traps: [{ slot: 1, word: 'drink', tip: 'เขา → he drinks 👍' }] },
  { id: 'mx-l1-3', drill: 'mixed', level: 1, strictness: 'enforce', thaiHint: 'เธออ่านหนังสือ', slots: ['Pronoun', 'Verb', 'Object'], answer: ['she', 'reads', 'a book'], distractors: ['a pen'], traps: [{ slot: 1, word: 'read', tip: 'เธอ → she reads 👍' }] },
  { id: 'mx-l1-4', drill: 'mixed', level: 1, strictness: 'enforce', thaiHint: 'พวกเราเล่นฟุตบอล', slots: ['Pronoun', 'Verb', 'Object'], answer: ['we', 'play', 'football'], distractors: ['tennis'], traps: [{ slot: 1, word: 'plays', tip: 'เรา → we play 👍' }] },
  { id: 'mx-l1-5', drill: 'mixed', level: 1, strictness: 'enforce', thaiHint: 'พวกเขาดูทีวี', slots: ['Pronoun', 'Verb', 'Object'], answer: ['they', 'watch', 'TV'], distractors: ['a movie'], traps: [{ slot: 1, word: 'watches', tip: 'เขา → they watch 👍' }] },
];

export function itemsFor(drill: DrillType, level: number): DrillItem[] {
  return WORD_BANK.filter((i) => i.drill === drill && i.level === level);
}

/** Tiles for an item's tray: answer words, then distractors, then trap words. */
export function trayWords(item: DrillItem): string[] {
  return [
    ...item.answer,
    ...(item.distractors ?? []),
    ...(item.traps ?? []).map((t) => t.word),
  ];
}

// Generates Pre-A1 Course 2 "I Am, You Are" (verb be + adjectives + this/that).
// Run: node scripts/gen-c2.mjs  ->  courses/c2-i-am-you-are.xlsx
import * as XLSX from 'xlsx';
import { mkdirSync } from 'node:fs';

const items = [];
const dd = (id, unit, node, level, variant, thaiHint, slots, answer, distractors = []) =>
  items.push({ id, kind: 'dragdrop', unit, node, level, variant, thaiHint,
    slots: slots.join(','), answer: answer.join(','), distractors: distractors.join(',') });
const fc = (id, unit, node, level, front, back, l1_th) =>
  items.push({ id, kind: 'flashcard', unit, node, level, front, back, l1_th });
const fb = (id, unit, node, level, template, answer, alternates, l1_th) =>
  items.push({ id, kind: 'fillblank', unit, node, level, template, answer,
    alternates: (alternates || []).join(','), l1_th });
const mt = (id, unit, node, level, l1_th, pairs) => {
  const row = { id, kind: 'matching', unit, node, level, l1_th };
  pairs.forEach((p, i) => { row[`pair${i + 1}`] = p; });
  items.push(row);
};
const S = 'Subject', B = 'Be', A = 'Adjective', O = 'Object';

// ═══ U1 — I am / You are (Subject+Be+Adjective; am/are) ═══════════════════════
fc('c2u1-fc-1', 'u1-i-am-you-are', 'u1-vocab', 1, 'am', 'เป็น/อยู่ (กับ I)', 'เป็น/อยู่ (กับ I)');
fc('c2u1-fc-2', 'u1-i-am-you-are', 'u1-vocab', 1, 'are', 'เป็น/อยู่ (กับ you)', 'เป็น/อยู่ (กับ you)');
fc('c2u1-fc-3', 'u1-i-am-you-are', 'u1-vocab', 1, 'happy', 'มีความสุข', 'มีความสุข');
fc('c2u1-fc-4', 'u1-i-am-you-are', 'u1-vocab', 1, 'sad', 'เศร้า', 'เศร้า');
fc('c2u1-fc-5', 'u1-i-am-you-are', 'u1-vocab', 1, 'hungry', 'หิว', 'หิว');
mt('c2u1-mt-1', 'u1-i-am-you-are', 'u1-sort', 1, 'จับคู่คำกับชนิดของคำ',
  ['I|Subject|ประธาน', 'am|Be|กริยา be', 'happy|Adjective|คำคุณศัพท์', 'sad|Adjective|คำคุณศัพท์']);
mt('c2u1-mt-2', 'u1-i-am-you-are', 'u1-sort', 1, 'จับคู่คำกับชนิดของคำ',
  ['you|Subject|ประธาน', 'are|Be|กริยา be', 'tall|Adjective|คำคุณศัพท์', 'big|Adjective|คำคุณศัพท์']);
dd('c2u1-p-1', 'u1-i-am-you-are', 'u1-pattern', 1, 'pattern', 'ฉันมีความสุข', [S, B, A], ['I', 'am', 'happy']);
dd('c2u1-p-2', 'u1-i-am-you-are', 'u1-pattern', 1, 'pattern', 'คุณเศร้า', [S, B, A], ['you', 'are', 'sad']);
dd('c2u1-p-3', 'u1-i-am-you-are', 'u1-pattern', 1, 'pattern', 'ฉันหิว', [S, B, A], ['I', 'am', 'hungry']);
dd('c2u1-p-4', 'u1-i-am-you-are', 'u1-pattern', 1, 'pattern', 'คุณสูง', [S, B, A], ['you', 'are', 'tall']);
dd('c2u1-p-5', 'u1-i-am-you-are', 'u1-pattern', 1, 'pattern', 'ฉันตัวใหญ่', [S, B, A], ['I', 'am', 'big']);
dd('c2u1-cp-1', 'u1-i-am-you-are', 'u1-checkpoint', 1, 'mixed', 'ฉันมีความสุข', [S, B, A], ['I', 'am', 'happy'], ['is']);
dd('c2u1-cp-2', 'u1-i-am-you-are', 'u1-checkpoint', 1, 'mixed', 'คุณเศร้า', [S, B, A], ['you', 'are', 'sad'], ['am']);
dd('c2u1-cp-3', 'u1-i-am-you-are', 'u1-checkpoint', 1, 'mixed', 'ฉันสูง', [S, B, A], ['I', 'am', 'tall'], ['are']);
dd('c2u1-cp-4', 'u1-i-am-you-are', 'u1-checkpoint', 1, 'mixed', 'คุณหิว', [S, B, A], ['you', 'are', 'hungry'], ['is']);
dd('c2u1-cp-5', 'u1-i-am-you-are', 'u1-checkpoint', 1, 'mixed', 'ฉันตัวเล็ก', [S, B, A], ['I', 'am', 'small'], ['is']);

// ═══ U2 — He / She / It is (Subject+Be+Adjective; is) ═════════════════════════
fc('c2u2-fc-1', 'u2-he-she-it-is', 'u2-vocab', 1, 'is', 'เป็น/อยู่ (กับ he/she/it)', 'เป็น/อยู่ (กับ he/she/it)');
fc('c2u2-fc-2', 'u2-he-she-it-is', 'u2-vocab', 1, 'big', 'ใหญ่', 'ใหญ่');
fc('c2u2-fc-3', 'u2-he-she-it-is', 'u2-vocab', 1, 'small', 'เล็ก', 'เล็ก');
fc('c2u2-fc-4', 'u2-he-she-it-is', 'u2-vocab', 1, 'hot', 'ร้อน', 'ร้อน');
fc('c2u2-fc-5', 'u2-he-she-it-is', 'u2-vocab', 1, 'cold', 'หนาว', 'หนาว');
dd('c2u2-p-1', 'u2-he-she-it-is', 'u2-pattern', 1, 'pattern', 'เขาสูง', [S, B, A], ['he', 'is', 'tall']);
dd('c2u2-p-2', 'u2-he-she-it-is', 'u2-pattern', 1, 'pattern', 'หล่อนตัวเล็ก', [S, B, A], ['she', 'is', 'small']);
dd('c2u2-p-3', 'u2-he-she-it-is', 'u2-pattern', 1, 'pattern', 'มันร้อน', [S, B, A], ['it', 'is', 'hot']);
dd('c2u2-p-4', 'u2-he-she-it-is', 'u2-pattern', 2, 'pattern', 'เขาเศร้า', [S, B, A], ['he', 'is', 'sad']);
dd('c2u2-p-5', 'u2-he-she-it-is', 'u2-pattern', 2, 'pattern', 'หล่อนมีความสุข', [S, B, A], ['she', 'is', 'happy']);
dd('c2u2-wc-1', 'u2-he-she-it-is', 'u2-wordchoice', 2, 'wordChoice', 'เขาตัวใหญ่', [S, B, A], ['he', 'is', 'big'], ['am', 'are']);
dd('c2u2-wc-2', 'u2-he-she-it-is', 'u2-wordchoice', 2, 'wordChoice', 'หล่อนหนาว', [S, B, A], ['she', 'is', 'cold'], ['are']);
dd('c2u2-wc-3', 'u2-he-she-it-is', 'u2-wordchoice', 2, 'wordChoice', 'มันร้อน', [S, B, A], ['it', 'is', 'hot'], ['am']);
dd('c2u2-wc-4', 'u2-he-she-it-is', 'u2-wordchoice', 2, 'wordChoice', 'เขาหิว', [S, B, A], ['he', 'is', 'hungry'], ['are']);
dd('c2u2-wc-5', 'u2-he-she-it-is', 'u2-wordchoice', 2, 'wordChoice', 'หล่อนสูง', [S, B, A], ['she', 'is', 'tall'], ['am']);
dd('c2u2-cp-1', 'u2-he-she-it-is', 'u2-checkpoint', 2, 'mixed', 'เขามีความสุข', [S, B, A], ['he', 'is', 'happy'], ['are']);
dd('c2u2-cp-2', 'u2-he-she-it-is', 'u2-checkpoint', 2, 'mixed', 'หล่อนหนาว', [S, B, A], ['she', 'is', 'cold'], ['am']);
dd('c2u2-cp-3', 'u2-he-she-it-is', 'u2-checkpoint', 2, 'mixed', 'มันตัวเล็ก', [S, B, A], ['it', 'is', 'small'], ['are']);
dd('c2u2-cp-4', 'u2-he-she-it-is', 'u2-checkpoint', 2, 'mixed', 'เขาร้อน', [S, B, A], ['he', 'is', 'hot'], ['am']);
dd('c2u2-cp-5', 'u2-he-she-it-is', 'u2-checkpoint', 2, 'mixed', 'หล่อนเศร้า', [S, B, A], ['she', 'is', 'sad'], ['are']);

// ═══ U3 — Feelings & Looks (adjectives; be-insertion drill) ═══════════════════
fc('c2u3-fc-1', 'u3-feelings-looks', 'u3-vocab', 2, 'happy', 'มีความสุข', 'มีความสุข');
fc('c2u3-fc-2', 'u3-feelings-looks', 'u3-vocab', 2, 'sad', 'เศร้า', 'เศร้า');
fc('c2u3-fc-3', 'u3-feelings-looks', 'u3-vocab', 2, 'hot', 'ร้อน', 'ร้อน');
fc('c2u3-fc-4', 'u3-feelings-looks', 'u3-vocab', 2, 'cold', 'หนาว', 'หนาว');
fc('c2u3-fc-5', 'u3-feelings-looks', 'u3-vocab', 2, 'hungry', 'หิว', 'หิว');
dd('c2u3-p-1', 'u3-feelings-looks', 'u3-pattern', 2, 'pattern', 'ฉันหนาว', [S, B, A], ['I', 'am', 'cold']);
dd('c2u3-p-2', 'u3-feelings-looks', 'u3-pattern', 2, 'pattern', 'เขาหิว', [S, B, A], ['he', 'is', 'hungry']);
dd('c2u3-p-3', 'u3-feelings-looks', 'u3-pattern', 2, 'pattern', 'มันตัวใหญ่', [S, B, A], ['it', 'is', 'big']);
dd('c2u3-p-4', 'u3-feelings-looks', 'u3-pattern', 2, 'pattern', 'คุณมีความสุข', [S, B, A], ['you', 'are', 'happy']);
dd('c2u3-p-5', 'u3-feelings-looks', 'u3-pattern', 2, 'pattern', 'หล่อนเศร้า', [S, B, A], ['she', 'is', 'sad']);
dd('c2u3-wc-1', 'u3-feelings-looks', 'u3-wordchoice', 2, 'wordChoice', 'มันร้อน', [S, B, A], ['it', 'is', 'hot'], ['cold']);
dd('c2u3-wc-2', 'u3-feelings-looks', 'u3-wordchoice', 2, 'wordChoice', 'ฉันมีความสุข', [S, B, A], ['I', 'am', 'happy'], ['sad']);
dd('c2u3-wc-3', 'u3-feelings-looks', 'u3-wordchoice', 2, 'wordChoice', 'เขาตัวใหญ่', [S, B, A], ['he', 'is', 'big'], ['small']);
dd('c2u3-wc-4', 'u3-feelings-looks', 'u3-wordchoice', 2, 'wordChoice', 'หล่อนหนาว', [S, B, A], ['she', 'is', 'cold'], ['hot']);
dd('c2u3-wc-5', 'u3-feelings-looks', 'u3-wordchoice', 2, 'wordChoice', 'คุณสูง', [S, B, A], ['you', 'are', 'tall'], ['small']);
fb('c2u3-fb-1', 'u3-feelings-looks', 'u3-fill', 2, 'I ___ happy', 'am', [], 'ฉันมีความสุข');
fb('c2u3-fb-2', 'u3-feelings-looks', 'u3-fill', 2, 'He ___ tall', 'is', [], 'เขาสูง');
fb('c2u3-fb-3', 'u3-feelings-looks', 'u3-fill', 2, 'You ___ hungry', 'are', [], 'คุณหิว');
fb('c2u3-fb-4', 'u3-feelings-looks', 'u3-fill', 2, 'It ___ hot', 'is', [], 'มันร้อน');
fb('c2u3-fb-5', 'u3-feelings-looks', 'u3-fill', 2, 'They ___ big', 'are', [], 'พวกเขาตัวใหญ่');
dd('c2u3-cp-1', 'u3-feelings-looks', 'u3-checkpoint', 2, 'mixed', 'ฉันหนาว', [S, B, A], ['I', 'am', 'cold'], ['is']);
dd('c2u3-cp-2', 'u3-feelings-looks', 'u3-checkpoint', 2, 'mixed', 'เขาหิว', [S, B, A], ['he', 'is', 'hungry'], ['are']);
dd('c2u3-cp-3', 'u3-feelings-looks', 'u3-checkpoint', 2, 'mixed', 'คุณมีความสุข', [S, B, A], ['you', 'are', 'happy'], ['is']);
dd('c2u3-cp-4', 'u3-feelings-looks', 'u3-checkpoint', 2, 'mixed', 'มันตัวเล็ก', [S, B, A], ['it', 'is', 'small'], ['am']);
dd('c2u3-cp-5', 'u3-feelings-looks', 'u3-checkpoint', 2, 'mixed', 'หล่อนร้อน', [S, B, A], ['she', 'is', 'hot'], ['are']);

// ═══ U4 — This & That (demonstratives + a/an via fill; plural identity drag) ═══
fc('c2u4-fc-1', 'u4-this-that', 'u4-vocab', 2, 'this', 'นี่ (ของใกล้)', 'นี่ (ของใกล้)');
fc('c2u4-fc-2', 'u4-this-that', 'u4-vocab', 2, 'that', 'นั่น (ของไกล)', 'นั่น (ของไกล)');
fc('c2u4-fc-3', 'u4-this-that', 'u4-vocab', 2, 'teacher', 'ครู', 'ครู');
fc('c2u4-fc-4', 'u4-this-that', 'u4-vocab', 2, 'student', 'นักเรียน', 'นักเรียน');
fc('c2u4-fc-5', 'u4-this-that', 'u4-vocab', 2, 'apple', 'แอปเปิล', 'แอปเปิล');
mt('c2u4-mt-1', 'u4-this-that', 'u4-match', 2, 'จับคู่ a / an กับคำนาม',
  ['a|dog|หน้าเสียงพยัญชนะ', 'an|apple|หน้าเสียงสระ', 'a|cat|หน้าเสียงพยัญชนะ', 'an|egg|หน้าเสียงสระ']);
fb('c2u4-fb-1', 'u4-this-that', 'u4-fill', 2, 'This is ___ dog', 'a', [], 'นี่คือหมา');
fb('c2u4-fb-2', 'u4-this-that', 'u4-fill', 2, 'That is ___ apple', 'an', [], 'นั่นคือแอปเปิล');
fb('c2u4-fb-3', 'u4-this-that', 'u4-fill', 2, 'This is ___ cat', 'a', [], 'นี่คือแมว');
fb('c2u4-fb-4', 'u4-this-that', 'u4-fill', 2, 'That is ___ teacher', 'a', [], 'นั่นคือครู');
fb('c2u4-fb-5', 'u4-this-that', 'u4-fill', 2, 'This is ___ student', 'a', [], 'นี่คือนักเรียน');
dd('c2u4-p-1', 'u4-this-that', 'u4-pattern', 2, 'pattern', 'พวกนี้เป็นหมา', [S, B, O], ['these', 'are', 'dogs']);
dd('c2u4-p-2', 'u4-this-that', 'u4-pattern', 2, 'pattern', 'พวกนั้นเป็นแมว', [S, B, O], ['those', 'are', 'cats']);
dd('c2u4-p-3', 'u4-this-that', 'u4-pattern', 2, 'pattern', 'พวกนี้เป็นหนังสือ', [S, B, O], ['these', 'are', 'books']);
dd('c2u4-p-4', 'u4-this-that', 'u4-pattern', 2, 'pattern', 'พวกนั้นเป็นลูกบอล', [S, B, O], ['those', 'are', 'balls']);
dd('c2u4-p-5', 'u4-this-that', 'u4-pattern', 2, 'pattern', 'พวกนี้เป็นนักเรียน', [S, B, O], ['these', 'are', 'students']);
dd('c2u4-cp-1', 'u4-this-that', 'u4-checkpoint', 2, 'mixed', 'พวกนี้เป็นหมา', [S, B, O], ['these', 'are', 'dogs'], ['cats']);
dd('c2u4-cp-2', 'u4-this-that', 'u4-checkpoint', 2, 'mixed', 'พวกนั้นเป็นแมว', [S, B, O], ['those', 'are', 'cats'], ['is']);
dd('c2u4-cp-3', 'u4-this-that', 'u4-checkpoint', 2, 'mixed', 'พวกนี้เป็นหนังสือ', [S, B, O], ['these', 'are', 'books'], ['balls']);
dd('c2u4-cp-4', 'u4-this-that', 'u4-checkpoint', 2, 'mixed', 'พวกนี้เป็นนักเรียน', [S, B, O], ['these', 'are', 'students'], ['teachers']);
dd('c2u4-cp-5', 'u4-this-that', 'u4-checkpoint', 2, 'mixed', 'พวกนั้นเป็นลูกบอล', [S, B, O], ['those', 'are', 'balls'], ['is']);

// ═══ U5 — We / They are (plural be; adjective + noun complement) ══════════════
fc('c2u5-fc-1', 'u5-we-they-are', 'u5-vocab', 3, 'we', 'เรา', 'เรา');
fc('c2u5-fc-2', 'u5-we-they-are', 'u5-vocab', 3, 'they', 'พวกเขา', 'พวกเขา');
fc('c2u5-fc-3', 'u5-we-they-are', 'u5-vocab', 3, 'students', 'นักเรียน (พหูพจน์)', 'นักเรียน');
fc('c2u5-fc-4', 'u5-we-they-are', 'u5-vocab', 3, 'teachers', 'ครู (พหูพจน์)', 'ครู');
fc('c2u5-fc-5', 'u5-we-they-are', 'u5-vocab', 3, 'tall', 'สูง', 'สูง');
dd('c2u5-p-1', 'u5-we-they-are', 'u5-pattern', 3, 'pattern', 'เรามีความสุข', [S, B, A], ['we', 'are', 'happy']);
dd('c2u5-p-2', 'u5-we-they-are', 'u5-pattern', 3, 'pattern', 'พวกเขาตัวใหญ่', [S, B, A], ['they', 'are', 'big']);
dd('c2u5-p-3', 'u5-we-they-are', 'u5-pattern', 3, 'pattern', 'เราเป็นนักเรียน', [S, B, O], ['we', 'are', 'students']);
dd('c2u5-p-4', 'u5-we-they-are', 'u5-pattern', 3, 'pattern', 'พวกเขาเป็นครู', [S, B, O], ['they', 'are', 'teachers']);
dd('c2u5-p-5', 'u5-we-they-are', 'u5-pattern', 3, 'pattern', 'เราหิว', [S, B, A], ['we', 'are', 'hungry']);
dd('c2u5-wc-1', 'u5-we-they-are', 'u5-wordchoice', 3, 'wordChoice', 'เราสูง', [S, B, A], ['we', 'are', 'tall'], ['is', 'am']);
dd('c2u5-wc-2', 'u5-we-they-are', 'u5-wordchoice', 3, 'wordChoice', 'พวกเขาหนาว', [S, B, A], ['they', 'are', 'cold'], ['is']);
dd('c2u5-wc-3', 'u5-we-they-are', 'u5-wordchoice', 3, 'wordChoice', 'เราเป็นนักเรียน', [S, B, O], ['we', 'are', 'students'], ['is']);
dd('c2u5-wc-4', 'u5-we-they-are', 'u5-wordchoice', 3, 'wordChoice', 'พวกเขามีความสุข', [S, B, A], ['they', 'are', 'happy'], ['am']);
dd('c2u5-wc-5', 'u5-we-they-are', 'u5-wordchoice', 3, 'wordChoice', 'เราเป็นครู', [S, B, O], ['we', 'are', 'teachers'], ['is']);
dd('c2u5-cp-1', 'u5-we-they-are', 'u5-checkpoint', 3, 'mixed', 'เรามีความสุข', [S, B, A], ['we', 'are', 'happy'], ['is']);
dd('c2u5-cp-2', 'u5-we-they-are', 'u5-checkpoint', 3, 'mixed', 'พวกเขาเป็นนักเรียน', [S, B, O], ['they', 'are', 'students'], ['teachers']);
dd('c2u5-cp-3', 'u5-we-they-are', 'u5-checkpoint', 3, 'mixed', 'เราหนาว', [S, B, A], ['we', 'are', 'cold'], ['am']);
dd('c2u5-cp-4', 'u5-we-they-are', 'u5-checkpoint', 3, 'mixed', 'พวกเขาตัวใหญ่', [S, B, A], ['they', 'are', 'big'], ['is']);
dd('c2u5-cp-5', 'u5-we-they-are', 'u5-checkpoint', 3, 'mixed', 'เราหิว', [S, B, A], ['we', 'are', 'hungry'], ['is']);

// ═══ U6 — All About Us (mixed review, all be frames) ═════════════════════════
dd('c2u6-p-1', 'u6-all-about-us', 'u6-pattern', 3, 'pattern', 'ฉันมีความสุข', [S, B, A], ['I', 'am', 'happy']);
dd('c2u6-p-2', 'u6-all-about-us', 'u6-pattern', 3, 'pattern', 'หล่อนสูง', [S, B, A], ['she', 'is', 'tall']);
dd('c2u6-p-3', 'u6-all-about-us', 'u6-pattern', 3, 'pattern', 'เราเป็นนักเรียน', [S, B, O], ['we', 'are', 'students']);
dd('c2u6-p-4', 'u6-all-about-us', 'u6-pattern', 3, 'pattern', 'มันร้อน', [S, B, A], ['it', 'is', 'hot']);
dd('c2u6-p-5', 'u6-all-about-us', 'u6-pattern', 3, 'pattern', 'พวกเขาตัวใหญ่', [S, B, A], ['they', 'are', 'big']);
dd('c2u6-wc-1', 'u6-all-about-us', 'u6-wordchoice', 4, 'wordChoice', 'ฉันหิว', [S, B, A], ['I', 'am', 'hungry'], ['is', 'are']);
dd('c2u6-wc-2', 'u6-all-about-us', 'u6-wordchoice', 4, 'wordChoice', 'เขาหนาว', [S, B, A], ['he', 'is', 'cold'], ['am', 'are']);
dd('c2u6-wc-3', 'u6-all-about-us', 'u6-wordchoice', 4, 'wordChoice', 'พวกเขามีความสุข', [S, B, A], ['they', 'are', 'happy'], ['is']);
dd('c2u6-wc-4', 'u6-all-about-us', 'u6-wordchoice', 4, 'wordChoice', 'คุณสูง', [S, B, A], ['you', 'are', 'tall'], ['is']);
dd('c2u6-wc-5', 'u6-all-about-us', 'u6-wordchoice', 4, 'wordChoice', 'หล่อนตัวเล็ก', [S, B, A], ['she', 'is', 'small'], ['am']);
dd('c2u6-g-1', 'u6-all-about-us', 'u6-grammar', 4, 'grammar', 'ฉันเศร้า', [S, B, A], ['I', 'am', 'sad'], ['is']);
dd('c2u6-g-2', 'u6-all-about-us', 'u6-grammar', 4, 'grammar', 'เขาตัวใหญ่', [S, B, A], ['he', 'is', 'big'], ['are']);
dd('c2u6-g-3', 'u6-all-about-us', 'u6-grammar', 4, 'grammar', 'เราหนาว', [S, B, A], ['we', 'are', 'cold'], ['is']);
dd('c2u6-g-4', 'u6-all-about-us', 'u6-grammar', 4, 'grammar', 'มันร้อน', [S, B, A], ['it', 'is', 'hot'], ['are']);
dd('c2u6-g-5', 'u6-all-about-us', 'u6-grammar', 4, 'grammar', 'พวกเขาหิว', [S, B, A], ['they', 'are', 'hungry'], ['is']);
dd('c2u6-cp-1', 'u6-all-about-us', 'u6-checkpoint', 4, 'mixed', 'ฉันมีความสุข', [S, B, A], ['I', 'am', 'happy'], ['is', 'sad']);
dd('c2u6-cp-2', 'u6-all-about-us', 'u6-checkpoint', 4, 'mixed', 'หล่อนหนาว', [S, B, A], ['she', 'is', 'cold'], ['are']);
dd('c2u6-cp-3', 'u6-all-about-us', 'u6-checkpoint', 4, 'mixed', 'พวกเขาเป็นนักเรียน', [S, B, O], ['they', 'are', 'students'], ['is', 'teachers']);
dd('c2u6-cp-4', 'u6-all-about-us', 'u6-checkpoint', 4, 'mixed', 'เขาสูง', [S, B, A], ['he', 'is', 'tall'], ['am']);
dd('c2u6-cp-5', 'u6-all-about-us', 'u6-checkpoint', 4, 'mixed', 'เราตัวใหญ่', [S, B, A], ['we', 'are', 'big'], ['is']);

// ── sheets ───────────────────────────────────────────────────────────────────
const course = [{ id: 'pre-a1-c2-i-am', title: 'I Am, You Are', emoji: '😀', l1Ready: true }];
const units = [
  { id: 'u1-i-am-you-are', title: 'I am, You are', emoji: '🙋', order: 1, l1Enabled: true },
  { id: 'u2-he-she-it-is', title: 'He, She, It is', emoji: '🧒', order: 2, l1Enabled: true },
  { id: 'u3-feelings-looks', title: 'Feelings & Looks', emoji: '😀', order: 3, l1Enabled: true },
  { id: 'u4-this-that', title: 'This & That', emoji: '👉', order: 4, l1Enabled: true },
  { id: 'u5-we-they-are', title: 'We, They are', emoji: '👨‍👩‍👧', order: 5, l1Enabled: true },
  { id: 'u6-all-about-us', title: 'All About Us', emoji: '🌟', order: 6, l1Enabled: true },
];
const bosses = [
  { id: 'c2-gate-after-u2', scope: 'gated', afterUnit: 'u2-he-she-it-is', reviewsUnits: 'u1-i-am-you-are,u2-he-she-it-is', reviewCount: 5, pinnedItemIds: '', rewardPetDefId: '' },
  { id: 'c2-gate-after-u4', scope: 'gated', afterUnit: 'u4-this-that', reviewsUnits: 'u3-feelings-looks,u4-this-that', reviewCount: 6, pinnedItemIds: '', rewardPetDefId: '' },
  { id: 'c2-final-i-am', scope: 'final', afterUnit: '', reviewsUnits: 'u1-i-am-you-are,u2-he-she-it-is,u3-feelings-looks,u4-this-that,u5-we-they-are,u6-all-about-us', reviewCount: 8, pinnedItemIds: '', rewardPetDefId: '' },
];

const ITEM_HEADER = ['id', 'kind', 'unit', 'node', 'level', 'variant', 'thaiHint', 'slots', 'answer',
  'distractors', 'front', 'back', 'l1_th', 'template', 'alternates', 'pair1', 'pair2', 'pair3', 'pair4'];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(course, { header: ['id', 'title', 'emoji', 'l1Ready'] }), 'Course');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(units, { header: ['id', 'title', 'emoji', 'order', 'l1Enabled'] }), 'Units');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items, { header: ITEM_HEADER }), 'Items');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bosses, { header: ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds', 'rewardPetDefId'] }), 'Bosses');

mkdirSync('courses', { recursive: true });
XLSX.writeFile(wb, 'courses/c2-i-am-you-are.xlsx');
console.log(`wrote courses/c2-i-am-you-are.xlsx — ${items.length} items, ${units.length} units, ${bosses.length} bosses`);

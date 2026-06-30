// Generates Pre-A1 Course 4 "Where? What? How Many?" (wh-questions + there is/are
// + prepositions + numbers/age). Run: node scripts/gen-c4.mjs -> courses/c4-where-what.xlsx
import * as XLSX from 'xlsx';
import { mkdirSync } from 'node:fs';

const items = [];
const dd = (id, unit, node, level, variant, thaiHint, slots, answer, distractors = [], punct = '') =>
  items.push({ id, kind: 'dragdrop', unit, node, level, variant, thaiHint,
    slots: slots.join(','), answer: answer.join(','), distractors: distractors.join(','), punct });
const ddq = (id, unit, node, level, variant, thaiHint, slots, answer, distractors = []) =>
  dd(id, unit, node, level, variant, thaiHint, slots, answer, distractors, '?');
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
// Scaffold roles: numbers -> Adjective (determiner), "there" -> dummy Subject, wh-word -> Question.
const S = 'Subject', V = 'Verb', O = 'Object', B = 'Be', A = 'Adjective', Q = 'Question';

// ═══ U1 — Numbers 1–10 ════════════════════════════════════════════════════════
fc('c4u1-fc-1', 'u1-numbers', 'u1-vocab1', 1, 'one', 'หนึ่ง', 'หนึ่ง');
fc('c4u1-fc-2', 'u1-numbers', 'u1-vocab1', 1, 'two', 'สอง', 'สอง');
fc('c4u1-fc-3', 'u1-numbers', 'u1-vocab1', 1, 'three', 'สาม', 'สาม');
fc('c4u1-fc-4', 'u1-numbers', 'u1-vocab1', 1, 'four', 'สี่', 'สี่');
fc('c4u1-fc-5', 'u1-numbers', 'u1-vocab1', 1, 'five', 'ห้า', 'ห้า');
fc('c4u1-fc-6', 'u1-numbers', 'u1-vocab2', 1, 'six', 'หก', 'หก');
fc('c4u1-fc-7', 'u1-numbers', 'u1-vocab2', 1, 'seven', 'เจ็ด', 'เจ็ด');
fc('c4u1-fc-8', 'u1-numbers', 'u1-vocab2', 1, 'eight', 'แปด', 'แปด');
fc('c4u1-fc-9', 'u1-numbers', 'u1-vocab2', 1, 'nine', 'เก้า', 'เก้า');
fc('c4u1-fc-10', 'u1-numbers', 'u1-vocab2', 1, 'ten', 'สิบ', 'สิบ');
mt('c4u1-mt-1', 'u1-numbers', 'u1-match', 1, 'จับคู่ตัวเลขกับคำ',
  ['one|1|หนึ่ง', 'two|2|สอง', 'three|3|สาม', 'four|4|สี่']);
dd('c4u1-cp-1', 'u1-numbers', 'u1-checkpoint', 1, 'mixed', 'ฉันมีหมาสองตัว', [S, V, A, O], ['I', 'have', 'two', 'dogs'], ['three']);
dd('c4u1-cp-2', 'u1-numbers', 'u1-checkpoint', 1, 'mixed', 'ฉันมีแมวสามตัว', [S, V, A, O], ['I', 'have', 'three', 'cats'], ['two']);
dd('c4u1-cp-3', 'u1-numbers', 'u1-checkpoint', 1, 'mixed', 'ฉันมีหนังสือห้าเล่ม', [S, V, A, O], ['I', 'have', 'five', 'books'], ['four']);
dd('c4u1-cp-4', 'u1-numbers', 'u1-checkpoint', 1, 'mixed', 'ฉันมีลูกบอลสี่ลูก', [S, V, A, O], ['I', 'have', 'four', 'balls'], ['five']);
dd('c4u1-cp-5', 'u1-numbers', 'u1-checkpoint', 1, 'mixed', 'ฉันมีปลาสิบตัว', [S, V, A, O], ['I', 'have', 'ten', 'fish'], ['two']);

// ═══ U2 — How Old Are You? (age) ══════════════════════════════════════════════
fc('c4u2-fc-1', 'u2-how-old', 'u2-vocab', 2, 'old', 'อายุ / แก่', 'อายุ / แก่');
fc('c4u2-fc-2', 'u2-how-old', 'u2-vocab', 2, 'eleven', 'สิบเอ็ด', 'สิบเอ็ด');
fc('c4u2-fc-3', 'u2-how-old', 'u2-vocab', 2, 'twelve', 'สิบสอง', 'สิบสอง');
fc('c4u2-fc-4', 'u2-how-old', 'u2-vocab', 2, 'fifteen', 'สิบห้า', 'สิบห้า');
fc('c4u2-fc-5', 'u2-how-old', 'u2-vocab', 2, 'sixteen', 'สิบหก', 'สิบหก');
ddq('c4u2-pq-1', 'u2-how-old', 'u2-pattern-q', 2, 'pattern', 'คุณอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'are', 'you']);
ddq('c4u2-pq-2', 'u2-how-old', 'u2-pattern-q', 2, 'pattern', 'เขาอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'is', 'he']);
ddq('c4u2-pq-3', 'u2-how-old', 'u2-pattern-q', 2, 'pattern', 'หล่อนอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'is', 'she']);
ddq('c4u2-pq-4', 'u2-how-old', 'u2-pattern-q', 2, 'pattern', 'มันอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'is', 'it']);
ddq('c4u2-pq-5', 'u2-how-old', 'u2-pattern-q', 2, 'pattern', 'พวกเขาอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'are', 'they']);
dd('c4u2-pa-1', 'u2-how-old', 'u2-pattern-a', 2, 'pattern', 'ฉันอายุสิบห้า', [S, B, O], ['I', 'am', 'fifteen']);
dd('c4u2-pa-2', 'u2-how-old', 'u2-pattern-a', 2, 'pattern', 'เขาอายุสิบหก', [S, B, O], ['he', 'is', 'sixteen']);
dd('c4u2-pa-3', 'u2-how-old', 'u2-pattern-a', 2, 'pattern', 'หล่อนอายุสิบสอง', [S, B, O], ['she', 'is', 'twelve']);
dd('c4u2-pa-4', 'u2-how-old', 'u2-pattern-a', 2, 'pattern', 'คุณอายุสิบเอ็ด', [S, B, O], ['you', 'are', 'eleven']);
dd('c4u2-pa-5', 'u2-how-old', 'u2-pattern-a', 2, 'pattern', 'พวกเขาอายุสิบ', [S, B, O], ['they', 'are', 'ten']);
ddq('c4u2-cp-1', 'u2-how-old', 'u2-checkpoint', 2, 'mixed', 'คุณอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'are', 'you'], ['is']);
dd('c4u2-cp-2', 'u2-how-old', 'u2-checkpoint', 2, 'mixed', 'ฉันอายุสิบห้า', [S, B, O], ['I', 'am', 'fifteen'], ['are']);
ddq('c4u2-cp-3', 'u2-how-old', 'u2-checkpoint', 2, 'mixed', 'เขาอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'is', 'he'], ['are']);
dd('c4u2-cp-4', 'u2-how-old', 'u2-checkpoint', 2, 'mixed', 'หล่อนอายุสิบหก', [S, B, O], ['she', 'is', 'sixteen'], ['am']);
ddq('c4u2-cp-5', 'u2-how-old', 'u2-checkpoint', 2, 'mixed', 'พวกเขาอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'are', 'they'], ['is']);

// ═══ U3 — Where Is It? (wh-be question + prepositions) ════════════════════════
fc('c4u3-fc-1', 'u3-where-is', 'u3-vocab', 3, 'Where', 'ที่ไหน', 'ที่ไหน');
fc('c4u3-fc-2', 'u3-where-is', 'u3-vocab', 3, 'in', 'ใน', 'ใน');
fc('c4u3-fc-3', 'u3-where-is', 'u3-vocab', 3, 'on', 'บน', 'บน');
fc('c4u3-fc-4', 'u3-where-is', 'u3-vocab', 3, 'under', 'ใต้', 'ใต้');
fc('c4u3-fc-5', 'u3-where-is', 'u3-vocab', 3, 'box', 'กล่อง', 'กล่อง');
mt('c4u3-mt-1', 'u3-where-is', 'u3-match', 3, 'จับคู่คำบอกตำแหน่ง',
  ['in|ใน|ข้างใน', 'on|บน|ด้านบน', 'under|ใต้|ด้านล่าง', 'next to|ข้างๆ|ติดกับ']);
ddq('c4u3-p-1', 'u3-where-is', 'u3-pattern', 3, 'pattern', 'มันอยู่ที่ไหน', [Q, B, S], ['where', 'is', 'it']);
ddq('c4u3-p-2', 'u3-where-is', 'u3-pattern', 3, 'pattern', 'เขาอยู่ที่ไหน', [Q, B, S], ['where', 'is', 'he']);
ddq('c4u3-p-3', 'u3-where-is', 'u3-pattern', 3, 'pattern', 'คุณอยู่ที่ไหน', [Q, B, S], ['where', 'are', 'you']);
ddq('c4u3-p-4', 'u3-where-is', 'u3-pattern', 3, 'pattern', 'หล่อนอยู่ที่ไหน', [Q, B, S], ['where', 'is', 'she']);
ddq('c4u3-p-5', 'u3-where-is', 'u3-pattern', 3, 'pattern', 'พวกเขาอยู่ที่ไหน', [Q, B, S], ['where', 'are', 'they']);
fb('c4u3-fb-1', 'u3-where-is', 'u3-fill', 3, 'The dog is ___ the box', 'in', ['on', 'under'], 'หมาอยู่ในกล่อง');
fb('c4u3-fb-2', 'u3-where-is', 'u3-fill', 3, 'The cat is ___ the box', 'on', ['in', 'under'], 'แมวอยู่บนกล่อง');
fb('c4u3-fb-3', 'u3-where-is', 'u3-fill', 3, 'The ball is ___ the table', 'under', ['on', 'in'], 'ลูกบอลอยู่ใต้โต๊ะ');
fb('c4u3-fb-4', 'u3-where-is', 'u3-fill', 3, 'The book is ___ the table', 'on', ['in', 'under'], 'หนังสืออยู่บนโต๊ะ');
fb('c4u3-fb-5', 'u3-where-is', 'u3-fill', 3, 'The fish is ___ the water', 'in', ['on', 'under'], 'ปลาอยู่ในน้ำ');
ddq('c4u3-cp-1', 'u3-where-is', 'u3-checkpoint', 3, 'mixed', 'มันอยู่ที่ไหน', [Q, B, S], ['where', 'is', 'it'], ['are']);
ddq('c4u3-cp-2', 'u3-where-is', 'u3-checkpoint', 3, 'mixed', 'คุณอยู่ที่ไหน', [Q, B, S], ['where', 'are', 'you'], ['is']);
ddq('c4u3-cp-3', 'u3-where-is', 'u3-checkpoint', 3, 'mixed', 'เขาอยู่ที่ไหน', [Q, B, S], ['where', 'is', 'he'], ['are']);
ddq('c4u3-cp-4', 'u3-where-is', 'u3-checkpoint', 3, 'mixed', 'พวกเขาอยู่ที่ไหน', [Q, B, S], ['where', 'are', 'they'], ['is']);
ddq('c4u3-cp-5', 'u3-where-is', 'u3-checkpoint', 3, 'mixed', 'หล่อนอยู่ที่ไหน', [Q, B, S], ['where', 'is', 'she'], ['are']);

// ═══ U4 — There Is, There Are ═════════════════════════════════════════════════
fc('c4u4-fc-1', 'u4-there-is', 'u4-vocab', 3, 'there', 'มี / ที่นั่น', 'มี / ที่นั่น');
fc('c4u4-fc-2', 'u4-there-is', 'u4-vocab', 3, 'is', 'มี (เอกพจน์)', 'มี (เอกพจน์)');
fc('c4u4-fc-3', 'u4-there-is', 'u4-vocab', 3, 'are', 'มี (พหูพจน์)', 'มี (พหูพจน์)');
fc('c4u4-fc-4', 'u4-there-is', 'u4-vocab', 3, 'dogs', 'หมา (พหูพจน์)', 'หมา');
fc('c4u4-fc-5', 'u4-there-is', 'u4-vocab', 3, 'cats', 'แมว (พหูพจน์)', 'แมว');
dd('c4u4-p-1', 'u4-there-is', 'u4-pattern', 3, 'pattern', 'มีหมาหลายตัว', [S, B, O], ['there', 'are', 'dogs']);
dd('c4u4-p-2', 'u4-there-is', 'u4-pattern', 3, 'pattern', 'มีแมวหลายตัว', [S, B, O], ['there', 'are', 'cats']);
dd('c4u4-p-3', 'u4-there-is', 'u4-pattern', 3, 'pattern', 'มีหนังสือหลายเล่ม', [S, B, O], ['there', 'are', 'books']);
dd('c4u4-p-4', 'u4-there-is', 'u4-pattern', 3, 'pattern', 'มีลูกบอลหลายลูก', [S, B, O], ['there', 'are', 'balls']);
dd('c4u4-p-5', 'u4-there-is', 'u4-pattern', 3, 'pattern', 'มีปลาหลายตัว', [S, B, O], ['there', 'are', 'fish']);
fb('c4u4-fb-1', 'u4-there-is', 'u4-fill', 3, 'There is ___ dog', 'a', [], 'มีหมาหนึ่งตัว');
fb('c4u4-fb-2', 'u4-there-is', 'u4-fill', 3, 'There is ___ cat', 'a', [], 'มีแมวหนึ่งตัว');
fb('c4u4-fb-3', 'u4-there-is', 'u4-fill', 3, 'There is ___ apple', 'an', [], 'มีแอปเปิลหนึ่งลูก');
fb('c4u4-fb-4', 'u4-there-is', 'u4-fill', 3, 'There is ___ book', 'a', [], 'มีหนังสือหนึ่งเล่ม');
fb('c4u4-fb-5', 'u4-there-is', 'u4-fill', 3, 'There is ___ egg', 'an', [], 'มีไข่หนึ่งฟอง');
dd('c4u4-wc-1', 'u4-there-is', 'u4-wordchoice', 3, 'wordChoice', 'มีหมาหลายตัว', [S, B, O], ['there', 'are', 'dogs'], ['is']);
dd('c4u4-wc-2', 'u4-there-is', 'u4-wordchoice', 3, 'wordChoice', 'มีแมวหลายตัว', [S, B, O], ['there', 'are', 'cats'], ['is']);
dd('c4u4-wc-3', 'u4-there-is', 'u4-wordchoice', 3, 'wordChoice', 'มีนักเรียนหลายคน', [S, B, O], ['there', 'are', 'students'], ['is']);
dd('c4u4-wc-4', 'u4-there-is', 'u4-wordchoice', 3, 'wordChoice', 'มีลูกบอลหลายลูก', [S, B, O], ['there', 'are', 'balls'], ['is']);
dd('c4u4-wc-5', 'u4-there-is', 'u4-wordchoice', 3, 'wordChoice', 'มีหนังสือหลายเล่ม', [S, B, O], ['there', 'are', 'books'], ['is']);
dd('c4u4-cp-1', 'u4-there-is', 'u4-checkpoint', 3, 'mixed', 'มีหมาหลายตัว', [S, B, O], ['there', 'are', 'dogs'], ['cats']);
dd('c4u4-cp-2', 'u4-there-is', 'u4-checkpoint', 3, 'mixed', 'มีแมวหลายตัว', [S, B, O], ['there', 'are', 'cats'], ['is']);
dd('c4u4-cp-3', 'u4-there-is', 'u4-checkpoint', 3, 'mixed', 'มีหนังสือหลายเล่ม', [S, B, O], ['there', 'are', 'books'], ['balls']);
dd('c4u4-cp-4', 'u4-there-is', 'u4-checkpoint', 3, 'mixed', 'มีปลาหลายตัว', [S, B, O], ['there', 'are', 'fish'], ['is']);
dd('c4u4-cp-5', 'u4-there-is', 'u4-checkpoint', 3, 'mixed', 'มีนักเรียนหลายคน', [S, B, O], ['there', 'are', 'students'], ['teachers']);

// ═══ U5 — What Is It? Who Is It? ══════════════════════════════════════════════
fc('c4u5-fc-1', 'u5-what-who', 'u5-vocab', 3, 'What', 'อะไร', 'อะไร');
fc('c4u5-fc-2', 'u5-what-who', 'u5-vocab', 3, 'Who', 'ใคร', 'ใคร');
fc('c4u5-fc-3', 'u5-what-who', 'u5-vocab', 3, 'teacher', 'ครู', 'ครู');
fc('c4u5-fc-4', 'u5-what-who', 'u5-vocab', 3, 'student', 'นักเรียน', 'นักเรียน');
fc('c4u5-fc-5', 'u5-what-who', 'u5-vocab', 3, 'dog', 'หมา', 'หมา');
ddq('c4u5-p-1', 'u5-what-who', 'u5-pattern', 3, 'pattern', 'มันคืออะไร', [Q, B, S], ['what', 'is', 'it']);
ddq('c4u5-p-2', 'u5-what-who', 'u5-pattern', 3, 'pattern', 'เขาคือใคร', [Q, B, S], ['who', 'is', 'he']);
ddq('c4u5-p-3', 'u5-what-who', 'u5-pattern', 3, 'pattern', 'หล่อนคือใคร', [Q, B, S], ['who', 'is', 'she']);
ddq('c4u5-p-4', 'u5-what-who', 'u5-pattern', 3, 'pattern', 'พวกมันคืออะไร', [Q, B, S], ['what', 'are', 'they']);
ddq('c4u5-p-5', 'u5-what-who', 'u5-pattern', 3, 'pattern', 'พวกเขาคือใคร', [Q, B, S], ['who', 'are', 'they']);
ddq('c4u5-wc-1', 'u5-what-who', 'u5-wordchoice', 3, 'wordChoice', 'มันคืออะไร', [Q, B, S], ['what', 'is', 'it'], ['who']);
ddq('c4u5-wc-2', 'u5-what-who', 'u5-wordchoice', 3, 'wordChoice', 'เขาคือใคร', [Q, B, S], ['who', 'is', 'he'], ['what']);
ddq('c4u5-wc-3', 'u5-what-who', 'u5-wordchoice', 3, 'wordChoice', 'พวกมันคืออะไร', [Q, B, S], ['what', 'are', 'they'], ['is']);
ddq('c4u5-wc-4', 'u5-what-who', 'u5-wordchoice', 3, 'wordChoice', 'หล่อนคือใคร', [Q, B, S], ['who', 'is', 'she'], ['are']);
ddq('c4u5-wc-5', 'u5-what-who', 'u5-wordchoice', 3, 'wordChoice', 'พวกเขาคือใคร', [Q, B, S], ['who', 'are', 'they'], ['is']);
mt('c4u5-mt-1', 'u5-what-who', 'u5-answers', 3, 'จับคู่คำถามกับคำตอบ',
  ['What is it?|It is a dog.|มันคือหมา', 'Who is he?|He is a teacher.|เขาคือครู', 'Who is she?|She is a student.|หล่อนคือนักเรียน']);
ddq('c4u5-cp-1', 'u5-what-who', 'u5-checkpoint', 3, 'mixed', 'มันคืออะไร', [Q, B, S], ['what', 'is', 'it'], ['who']);
ddq('c4u5-cp-2', 'u5-what-who', 'u5-checkpoint', 3, 'mixed', 'เขาคือใคร', [Q, B, S], ['who', 'is', 'he'], ['what']);
ddq('c4u5-cp-3', 'u5-what-who', 'u5-checkpoint', 3, 'mixed', 'พวกเขาคือใคร', [Q, B, S], ['who', 'are', 'they'], ['is']);
ddq('c4u5-cp-4', 'u5-what-who', 'u5-checkpoint', 3, 'mixed', 'พวกมันคืออะไร', [Q, B, S], ['what', 'are', 'they'], ['is']);
ddq('c4u5-cp-5', 'u5-what-who', 'u5-checkpoint', 3, 'mixed', 'หล่อนคือใคร', [Q, B, S], ['who', 'is', 'she'], ['are']);

// ═══ U6 — Quiz Day (mixed review, all C4 frames) ═════════════════════════════
ddq('c4u6-p-1', 'u6-quiz-day', 'u6-pattern', 4, 'pattern', 'คุณอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'are', 'you']);
ddq('c4u6-p-2', 'u6-quiz-day', 'u6-pattern', 4, 'pattern', 'มันอยู่ที่ไหน', [Q, B, S], ['where', 'is', 'it']);
dd('c4u6-p-3', 'u6-quiz-day', 'u6-pattern', 4, 'pattern', 'มีหมาหลายตัว', [S, B, O], ['there', 'are', 'dogs']);
ddq('c4u6-p-4', 'u6-quiz-day', 'u6-pattern', 4, 'pattern', 'มันคืออะไร', [Q, B, S], ['what', 'is', 'it']);
dd('c4u6-p-5', 'u6-quiz-day', 'u6-pattern', 4, 'pattern', 'ฉันมีแมวสองตัว', [S, V, A, O], ['I', 'have', 'two', 'cats']);
ddq('c4u6-wc-1', 'u6-quiz-day', 'u6-wordchoice', 4, 'wordChoice', 'เขาอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'is', 'he'], ['are']);
ddq('c4u6-wc-2', 'u6-quiz-day', 'u6-wordchoice', 4, 'wordChoice', 'พวกเขาอยู่ที่ไหน', [Q, B, S], ['where', 'are', 'they'], ['is']);
dd('c4u6-wc-3', 'u6-quiz-day', 'u6-wordchoice', 4, 'wordChoice', 'มีหนังสือหลายเล่ม', [S, B, O], ['there', 'are', 'books'], ['is']);
ddq('c4u6-wc-4', 'u6-quiz-day', 'u6-wordchoice', 4, 'wordChoice', 'หล่อนคือใคร', [Q, B, S], ['who', 'is', 'she'], ['are']);
dd('c4u6-wc-5', 'u6-quiz-day', 'u6-wordchoice', 4, 'wordChoice', 'ฉันอายุสิบห้า', [S, B, O], ['I', 'am', 'fifteen'], ['are']);
dd('c4u6-g-1', 'u6-quiz-day', 'u6-grammar', 4, 'grammar', 'มีแมวหลายตัว', [S, B, O], ['there', 'are', 'cats'], ['is']);
ddq('c4u6-g-2', 'u6-quiz-day', 'u6-grammar', 4, 'grammar', 'หล่อนอยู่ที่ไหน', [Q, B, S], ['where', 'is', 'she'], ['are']);
ddq('c4u6-g-3', 'u6-quiz-day', 'u6-grammar', 4, 'grammar', 'พวกเขาอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'are', 'they'], ['is']);
dd('c4u6-g-4', 'u6-quiz-day', 'u6-grammar', 4, 'grammar', 'มีลูกบอลหลายลูก', [S, B, O], ['there', 'are', 'balls'], ['is']);
ddq('c4u6-g-5', 'u6-quiz-day', 'u6-grammar', 4, 'grammar', 'พวกมันคืออะไร', [Q, B, S], ['what', 'are', 'they'], ['is']);
ddq('c4u6-cp-1', 'u6-quiz-day', 'u6-checkpoint', 4, 'mixed', 'มันอยู่ที่ไหน', [Q, B, S], ['where', 'is', 'it'], ['are']);
dd('c4u6-cp-2', 'u6-quiz-day', 'u6-checkpoint', 4, 'mixed', 'มีหมาหลายตัว', [S, B, O], ['there', 'are', 'dogs'], ['is']);
ddq('c4u6-cp-3', 'u6-quiz-day', 'u6-checkpoint', 4, 'mixed', 'คุณอายุเท่าไร', [Q, A, B, S], ['how', 'old', 'are', 'you'], ['is']);
ddq('c4u6-cp-4', 'u6-quiz-day', 'u6-checkpoint', 4, 'mixed', 'เขาคือใคร', [Q, B, S], ['who', 'is', 'he'], ['what']);
dd('c4u6-cp-5', 'u6-quiz-day', 'u6-checkpoint', 4, 'mixed', 'ฉันมีหนังสือสามเล่ม', [S, V, A, O], ['I', 'have', 'three', 'books'], ['two']);

// ── sheets ───────────────────────────────────────────────────────────────────
const course = [{ id: 'pre-a1-c4-where-what', title: 'Where? What? How Many?', emoji: '🔎', l1Ready: true }];
const units = [
  { id: 'u1-numbers', title: 'Numbers 1–10', emoji: '🔢', order: 1, l1Enabled: true },
  { id: 'u2-how-old', title: 'How Old Are You?', emoji: '🎂', order: 2, l1Enabled: true },
  { id: 'u3-where-is', title: 'Where Is It?', emoji: '📍', order: 3, l1Enabled: true },
  { id: 'u4-there-is', title: 'There Is, There Are', emoji: '👀', order: 4, l1Enabled: true },
  { id: 'u5-what-who', title: 'What Is It? Who Is It?', emoji: '🧐', order: 5, l1Enabled: true },
  { id: 'u6-quiz-day', title: 'Quiz Day', emoji: '🏆', order: 6, l1Enabled: true },
];
const bosses = [
  { id: 'c4-gate-after-u2', scope: 'gated', afterUnit: 'u2-how-old', reviewsUnits: 'u1-numbers,u2-how-old', reviewCount: 5, pinnedItemIds: '', rewardPetDefId: '' },
  { id: 'c4-gate-after-u4', scope: 'gated', afterUnit: 'u4-there-is', reviewsUnits: 'u3-where-is,u4-there-is', reviewCount: 6, pinnedItemIds: '', rewardPetDefId: '' },
  { id: 'c4-final-where-what', scope: 'final', afterUnit: '', reviewsUnits: 'u1-numbers,u2-how-old,u3-where-is,u4-there-is,u5-what-who,u6-quiz-day', reviewCount: 8, pinnedItemIds: '', rewardPetDefId: '' },
];

const ITEM_HEADER = ['id', 'kind', 'unit', 'node', 'level', 'variant', 'thaiHint', 'slots', 'answer',
  'distractors', 'punct', 'front', 'back', 'l1_th', 'template', 'alternates', 'pair1', 'pair2', 'pair3', 'pair4'];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(course, { header: ['id', 'title', 'emoji', 'l1Ready'] }), 'Course');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(units, { header: ['id', 'title', 'emoji', 'order', 'l1Enabled'] }), 'Units');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items, { header: ITEM_HEADER }), 'Items');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bosses, { header: ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds', 'rewardPetDefId'] }), 'Bosses');

mkdirSync('courses', { recursive: true });
XLSX.writeFile(wb, 'courses/c4-where-what.xlsx');
console.log(`wrote courses/c4-where-what.xlsx — ${items.length} items, ${units.length} units, ${bosses.length} bosses`);

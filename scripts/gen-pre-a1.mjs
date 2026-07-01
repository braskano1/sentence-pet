// Generates the Pre-A1 "First Sentences" course workbook (Course/Units/Items/Bosses).
// Run: node scripts/gen-pre-a1.mjs  ->  courses/pre-a1-first-sentences.xlsx
import * as XLSX from 'xlsx';
import { mkdirSync } from 'node:fs';

// ── builders ────────────────────────────────────────────────────────────────
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

// ═══ U1 — Me & You (S+V, lvl1) ════════════════════════════════════════════════
fc('u1-fc-1', 'u1-me-you', 'u1-vocab', 1, 'run', 'วิ่ง', 'วิ่ง');
fc('u1-fc-2', 'u1-me-you', 'u1-vocab', 1, 'walk', 'เดิน', 'เดิน');
fc('u1-fc-3', 'u1-me-you', 'u1-vocab', 1, 'sit', 'นั่ง', 'นั่ง');
fc('u1-fc-4', 'u1-me-you', 'u1-vocab', 1, 'sleep', 'นอน', 'นอน');
fc('u1-fc-5', 'u1-me-you', 'u1-vocab', 1, 'I', 'ฉัน', 'ฉัน');
mt('u1-mt-1', 'u1-me-you', 'u1-sort', 1, 'จับคู่คำกับชนิดของคำ',
  ['I|Subject|ประธาน', 'run|Verb|คำกริยา', 'you|Subject|ประธาน', 'walk|Verb|คำกริยา']);
mt('u1-mt-2', 'u1-me-you', 'u1-sort', 1, 'จับคู่คำกับชนิดของคำ',
  ['he|Subject|ประธาน', 'sit|Verb|คำกริยา', 'she|Subject|ประธาน', 'sleep|Verb|คำกริยา']);
dd('u1-p-1', 'u1-me-you', 'u1-pattern', 1, 'pattern', 'ฉันวิ่ง', ['Subject', 'Verb'], ['I', 'run']);
dd('u1-p-2', 'u1-me-you', 'u1-pattern', 1, 'pattern', 'คุณเดิน', ['Subject', 'Verb'], ['you', 'walk']);
dd('u1-p-3', 'u1-me-you', 'u1-pattern', 1, 'pattern', 'เขานั่ง', ['Subject', 'Verb'], ['he', 'sits']);
dd('u1-p-4', 'u1-me-you', 'u1-pattern', 1, 'pattern', 'หล่อนนอน', ['Subject', 'Verb'], ['she', 'sleeps']);
dd('u1-p-5', 'u1-me-you', 'u1-pattern', 1, 'pattern', 'มันนอน', ['Subject', 'Verb'], ['it', 'sleeps']);
dd('u1-cp-1', 'u1-me-you', 'u1-checkpoint', 1, 'mixed', 'ฉันวิ่ง', ['Subject', 'Verb'], ['I', 'run'], ['runs']);
dd('u1-cp-2', 'u1-me-you', 'u1-checkpoint', 1, 'mixed', 'คุณเดิน', ['Subject', 'Verb'], ['you', 'walk'], ['walks']);
dd('u1-cp-3', 'u1-me-you', 'u1-checkpoint', 1, 'mixed', 'เขานั่ง', ['Subject', 'Verb'], ['he', 'sits'], ['sit']);
dd('u1-cp-4', 'u1-me-you', 'u1-checkpoint', 1, 'mixed', 'หล่อนนอน', ['Subject', 'Verb'], ['she', 'sleeps'], ['sleep']);
dd('u1-cp-5', 'u1-me-you', 'u1-checkpoint', 1, 'mixed', 'มันวิ่ง', ['Subject', 'Verb'], ['it', 'runs'], ['run']);

// ═══ U2 — Things I Do (S+V, lvl1-2) ═══════════════════════════════════════════
fc('u2-fc-1', 'u2-things-i-do', 'u2-vocab', 1, 'swim', 'ว่ายน้ำ', 'ว่ายน้ำ');
fc('u2-fc-2', 'u2-things-i-do', 'u2-vocab', 1, 'jump', 'กระโดด', 'กระโดด');
fc('u2-fc-3', 'u2-things-i-do', 'u2-vocab', 1, 'play', 'เล่น', 'เล่น');
fc('u2-fc-4', 'u2-things-i-do', 'u2-vocab', 1, 'walk', 'เดิน', 'เดิน');
fc('u2-fc-5', 'u2-things-i-do', 'u2-vocab', 1, 'run', 'วิ่ง', 'วิ่ง');
dd('u2-p-1', 'u2-things-i-do', 'u2-pattern', 1, 'pattern', 'ฉันว่ายน้ำ', ['Subject', 'Verb'], ['I', 'swim']);
dd('u2-p-2', 'u2-things-i-do', 'u2-pattern', 1, 'pattern', 'คุณกระโดด', ['Subject', 'Verb'], ['you', 'jump']);
dd('u2-p-3', 'u2-things-i-do', 'u2-pattern', 2, 'pattern', 'เขาเล่น', ['Subject', 'Verb'], ['he', 'plays']);
dd('u2-p-4', 'u2-things-i-do', 'u2-pattern', 2, 'pattern', 'หล่อนว่ายน้ำ', ['Subject', 'Verb'], ['she', 'swims']);
dd('u2-p-5', 'u2-things-i-do', 'u2-pattern', 2, 'pattern', 'มันกระโดด', ['Subject', 'Verb'], ['it', 'jumps']);
dd('u2-wc-1', 'u2-things-i-do', 'u2-wordchoice', 2, 'wordChoice', 'ฉันว่ายน้ำ', ['Subject', 'Verb'], ['I', 'swim'], ['swims', 'swimming']);
dd('u2-wc-2', 'u2-things-i-do', 'u2-wordchoice', 2, 'wordChoice', 'คุณกระโดด', ['Subject', 'Verb'], ['you', 'jump'], ['jumps']);
dd('u2-wc-3', 'u2-things-i-do', 'u2-wordchoice', 2, 'wordChoice', 'เขาเล่น', ['Subject', 'Verb'], ['he', 'plays'], ['play', 'playing']);
dd('u2-wc-4', 'u2-things-i-do', 'u2-wordchoice', 2, 'wordChoice', 'หล่อนวิ่ง', ['Subject', 'Verb'], ['she', 'runs'], ['run']);
dd('u2-wc-5', 'u2-things-i-do', 'u2-wordchoice', 2, 'wordChoice', 'มันนั่ง', ['Subject', 'Verb'], ['it', 'sits'], ['sit']);
dd('u2-cp-1', 'u2-things-i-do', 'u2-checkpoint', 2, 'mixed', 'ฉันวิ่ง', ['Subject', 'Verb'], ['I', 'run'], ['runs']);
dd('u2-cp-2', 'u2-things-i-do', 'u2-checkpoint', 2, 'mixed', 'คุณว่ายน้ำ', ['Subject', 'Verb'], ['you', 'swim'], ['swims']);
dd('u2-cp-3', 'u2-things-i-do', 'u2-checkpoint', 2, 'mixed', 'เขากระโดด', ['Subject', 'Verb'], ['he', 'jumps'], ['jump']);
dd('u2-cp-4', 'u2-things-i-do', 'u2-checkpoint', 2, 'mixed', 'หล่อนเล่น', ['Subject', 'Verb'], ['she', 'plays'], ['play']);
dd('u2-cp-5', 'u2-things-i-do', 'u2-checkpoint', 2, 'mixed', 'มันเดิน', ['Subject', 'Verb'], ['it', 'walks'], ['walk']);

// ═══ U3 — I Like Things (S+V+O, lvl2) ═════════════════════════════════════════
fc('u3-fc-1', 'u3-i-like', 'u3-vocab', 2, 'rice', 'ข้าว', 'ข้าว');
fc('u3-fc-2', 'u3-i-like', 'u3-vocab', 2, 'water', 'น้ำ', 'น้ำ');
fc('u3-fc-3', 'u3-i-like', 'u3-vocab', 2, 'milk', 'นม', 'นม');
fc('u3-fc-4', 'u3-i-like', 'u3-vocab', 2, 'fish', 'ปลา', 'ปลา');
fc('u3-fc-5', 'u3-i-like', 'u3-vocab', 2, 'books', 'หนังสือ', 'หนังสือ');
dd('u3-p-1', 'u3-i-like', 'u3-pattern', 2, 'pattern', 'ฉันกินข้าว', ['Subject', 'Verb', 'Object'], ['I', 'eat', 'rice']);
dd('u3-p-2', 'u3-i-like', 'u3-pattern', 2, 'pattern', 'คุณดื่มน้ำ', ['Subject', 'Verb', 'Object'], ['you', 'drink', 'water']);
dd('u3-p-3', 'u3-i-like', 'u3-pattern', 2, 'pattern', 'ฉันชอบปลา', ['Subject', 'Verb', 'Object'], ['I', 'like', 'fish']);
dd('u3-p-4', 'u3-i-like', 'u3-pattern', 2, 'pattern', 'คุณอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['you', 'read', 'books']);
dd('u3-p-5', 'u3-i-like', 'u3-pattern', 2, 'pattern', 'ฉันดื่มนม', ['Subject', 'Verb', 'Object'], ['I', 'drink', 'milk']);
dd('u3-wc-1', 'u3-i-like', 'u3-wordchoice', 2, 'wordChoice', 'ฉันกินข้าว', ['Subject', 'Verb', 'Object'], ['I', 'eat', 'rice'], ['drink', 'water']);
dd('u3-wc-2', 'u3-i-like', 'u3-wordchoice', 2, 'wordChoice', 'คุณดื่มนม', ['Subject', 'Verb', 'Object'], ['you', 'drink', 'milk'], ['eat', 'books']);
dd('u3-wc-3', 'u3-i-like', 'u3-wordchoice', 2, 'wordChoice', 'ฉันอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['I', 'read', 'books'], ['eat', 'water']);
dd('u3-wc-4', 'u3-i-like', 'u3-wordchoice', 2, 'wordChoice', 'คุณชอบปลา', ['Subject', 'Verb', 'Object'], ['you', 'like', 'fish'], ['rice']);
dd('u3-wc-5', 'u3-i-like', 'u3-wordchoice', 2, 'wordChoice', 'ฉันกินปลา', ['Subject', 'Verb', 'Object'], ['I', 'eat', 'fish'], ['books', 'milk']);
fb('u3-fb-1', 'u3-i-like', 'u3-fill', 2, 'I ___ rice', 'eat', ['eats'], 'ฉันกินข้าว');
fb('u3-fb-2', 'u3-i-like', 'u3-fill', 2, 'You ___ water', 'drink', ['drinks'], 'คุณดื่มน้ำ');
fb('u3-fb-3', 'u3-i-like', 'u3-fill', 2, 'I read ___', 'books', [], 'ฉันอ่านหนังสือ');
fb('u3-fb-4', 'u3-i-like', 'u3-fill', 2, 'I drink ___', 'milk', ['water'], 'ฉันดื่มนม');
fb('u3-fb-5', 'u3-i-like', 'u3-fill', 2, 'I ___ fish', 'like', ['eat'], 'ฉันชอบปลา');
dd('u3-cp-1', 'u3-i-like', 'u3-checkpoint', 2, 'mixed', 'ฉันกินข้าว', ['Subject', 'Verb', 'Object'], ['I', 'eat', 'rice'], ['water']);
dd('u3-cp-2', 'u3-i-like', 'u3-checkpoint', 2, 'mixed', 'คุณดื่มน้ำ', ['Subject', 'Verb', 'Object'], ['you', 'drink', 'water'], ['milk']);
dd('u3-cp-3', 'u3-i-like', 'u3-checkpoint', 2, 'mixed', 'ฉันอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['I', 'read', 'books'], ['fish']);
dd('u3-cp-4', 'u3-i-like', 'u3-checkpoint', 2, 'mixed', 'คุณชอบปลา', ['Subject', 'Verb', 'Object'], ['you', 'like', 'fish'], ['books']);
dd('u3-cp-5', 'u3-i-like', 'u3-checkpoint', 2, 'mixed', 'ฉันดื่มนม', ['Subject', 'Verb', 'Object'], ['I', 'drink', 'milk'], ['rice']);

// ═══ U4 — He & She (S+V+O, 3rd-person -s, lvl3) ═══════════════════════════════
fc('u4-fc-1', 'u4-he-she', 'u4-vocab', 3, 'he', 'เขา (ผู้ชาย)', 'เขา');
fc('u4-fc-2', 'u4-he-she', 'u4-vocab', 3, 'she', 'หล่อน (ผู้หญิง)', 'หล่อน');
fc('u4-fc-3', 'u4-he-she', 'u4-vocab', 3, 'it', 'มัน', 'มัน');
fc('u4-fc-4', 'u4-he-she', 'u4-vocab', 3, 'dogs', 'หมา', 'หมา');
fc('u4-fc-5', 'u4-he-she', 'u4-vocab', 3, 'cats', 'แมว', 'แมว');
dd('u4-g-1', 'u4-he-she', 'u4-grammar', 3, 'grammar', 'เขากินข้าว', ['Subject', 'Verb', 'Object'], ['he', 'eats', 'rice']);
dd('u4-g-2', 'u4-he-she', 'u4-grammar', 3, 'grammar', 'หล่อนดื่มนม', ['Subject', 'Verb', 'Object'], ['she', 'drinks', 'milk']);
dd('u4-g-3', 'u4-he-she', 'u4-grammar', 3, 'grammar', 'มันชอบปลา', ['Subject', 'Verb', 'Object'], ['it', 'likes', 'fish']);
dd('u4-g-4', 'u4-he-she', 'u4-grammar', 3, 'grammar', 'เขาอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['he', 'reads', 'books']);
dd('u4-g-5', 'u4-he-she', 'u4-grammar', 3, 'grammar', 'หล่อนกินปลา', ['Subject', 'Verb', 'Object'], ['she', 'eats', 'fish']);
dd('u4-wc-1', 'u4-he-she', 'u4-wordchoice', 3, 'wordChoice', 'เขากินข้าว', ['Subject', 'Verb', 'Object'], ['he', 'eats', 'rice'], ['eat']);
dd('u4-wc-2', 'u4-he-she', 'u4-wordchoice', 3, 'wordChoice', 'หล่อนชอบหมา', ['Subject', 'Verb', 'Object'], ['she', 'likes', 'dogs'], ['like']);
dd('u4-wc-3', 'u4-he-she', 'u4-wordchoice', 3, 'wordChoice', 'มันดื่มน้ำ', ['Subject', 'Verb', 'Object'], ['it', 'drinks', 'water'], ['drink']);
dd('u4-wc-4', 'u4-he-she', 'u4-wordchoice', 3, 'wordChoice', 'เขาอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['he', 'reads', 'books'], ['read']);
dd('u4-wc-5', 'u4-he-she', 'u4-wordchoice', 3, 'wordChoice', 'หล่อนมีแมว', ['Subject', 'Verb', 'Object'], ['she', 'has', 'cats'], ['have']);
fb('u4-fb-1', 'u4-he-she', 'u4-fill', 3, 'He ___ rice', 'eats', [], 'เขากินข้าว');
fb('u4-fb-2', 'u4-he-she', 'u4-fill', 3, 'She ___ milk', 'drinks', [], 'หล่อนดื่มนม');
fb('u4-fb-3', 'u4-he-she', 'u4-fill', 3, 'It ___ fish', 'likes', ['eats'], 'มันชอบปลา');
fb('u4-fb-4', 'u4-he-she', 'u4-fill', 3, 'He ___ books', 'reads', [], 'เขาอ่านหนังสือ');
fb('u4-fb-5', 'u4-he-she', 'u4-fill', 3, 'She ___ dogs', 'likes', ['has'], 'หล่อนชอบหมา');
dd('u4-cp-1', 'u4-he-she', 'u4-checkpoint', 3, 'mixed', 'เขากินข้าว', ['Subject', 'Verb', 'Object'], ['he', 'eats', 'rice'], ['eat']);
dd('u4-cp-2', 'u4-he-she', 'u4-checkpoint', 3, 'mixed', 'หล่อนดื่มนม', ['Subject', 'Verb', 'Object'], ['she', 'drinks', 'milk'], ['drink']);
dd('u4-cp-3', 'u4-he-she', 'u4-checkpoint', 3, 'mixed', 'มันชอบปลา', ['Subject', 'Verb', 'Object'], ['it', 'likes', 'fish'], ['like']);
dd('u4-cp-4', 'u4-he-she', 'u4-checkpoint', 3, 'mixed', 'เขาอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['he', 'reads', 'books'], ['read']);
dd('u4-cp-5', 'u4-he-she', 'u4-checkpoint', 3, 'mixed', 'หล่อนมีแมว', ['Subject', 'Verb', 'Object'], ['she', 'has', 'cats'], ['have']);

// ═══ U5 — We & They (S+V+O, plural base form, lvl3) ═══════════════════════════
fc('u5-fc-1', 'u5-we-they', 'u5-vocab', 3, 'we', 'เรา', 'เรา');
fc('u5-fc-2', 'u5-we-they', 'u5-vocab', 3, 'they', 'พวกเขา', 'พวกเขา');
fc('u5-fc-3', 'u5-we-they', 'u5-vocab', 3, 'dogs', 'หมา', 'หมา');
fc('u5-fc-4', 'u5-we-they', 'u5-vocab', 3, 'cats', 'แมว', 'แมว');
fc('u5-fc-5', 'u5-we-they', 'u5-vocab', 3, 'balls', 'ลูกบอล', 'ลูกบอล');
dd('u5-p-1', 'u5-we-they', 'u5-pattern', 3, 'pattern', 'เรากินข้าว', ['Subject', 'Verb', 'Object'], ['we', 'eat', 'rice']);
dd('u5-p-2', 'u5-we-they', 'u5-pattern', 3, 'pattern', 'พวกเขาดื่มน้ำ', ['Subject', 'Verb', 'Object'], ['they', 'drink', 'water']);
dd('u5-p-3', 'u5-we-they', 'u5-pattern', 3, 'pattern', 'เราชอบหมา', ['Subject', 'Verb', 'Object'], ['we', 'like', 'dogs']);
dd('u5-p-4', 'u5-we-they', 'u5-pattern', 3, 'pattern', 'พวกเขาอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['they', 'read', 'books']);
dd('u5-p-5', 'u5-we-they', 'u5-pattern', 3, 'pattern', 'เรามีแมว', ['Subject', 'Verb', 'Object'], ['we', 'have', 'cats']);
dd('u5-g-1', 'u5-we-they', 'u5-grammar', 3, 'grammar', 'เราชอบหมา', ['Subject', 'Verb', 'Object'], ['we', 'like', 'dogs'], ['likes']);
dd('u5-g-2', 'u5-we-they', 'u5-grammar', 3, 'grammar', 'พวกเขากินข้าว', ['Subject', 'Verb', 'Object'], ['they', 'eat', 'rice'], ['eats']);
dd('u5-g-3', 'u5-we-they', 'u5-grammar', 3, 'grammar', 'เรามีลูกบอล', ['Subject', 'Verb', 'Object'], ['we', 'have', 'balls'], ['has']);
dd('u5-g-4', 'u5-we-they', 'u5-grammar', 3, 'grammar', 'พวกเขาดื่มนม', ['Subject', 'Verb', 'Object'], ['they', 'drink', 'milk'], ['drinks']);
dd('u5-g-5', 'u5-we-they', 'u5-grammar', 3, 'grammar', 'เราอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['we', 'read', 'books'], ['reads']);
dd('u5-cp-1', 'u5-we-they', 'u5-checkpoint', 3, 'mixed', 'เรากินข้าว', ['Subject', 'Verb', 'Object'], ['we', 'eat', 'rice'], ['eats']);
dd('u5-cp-2', 'u5-we-they', 'u5-checkpoint', 3, 'mixed', 'พวกเขาชอบปลา', ['Subject', 'Verb', 'Object'], ['they', 'like', 'fish'], ['likes']);
dd('u5-cp-3', 'u5-we-they', 'u5-checkpoint', 3, 'mixed', 'เรามีลูกบอล', ['Subject', 'Verb', 'Object'], ['we', 'have', 'balls'], ['has']);
dd('u5-cp-4', 'u5-we-they', 'u5-checkpoint', 3, 'mixed', 'พวกเขาอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['they', 'read', 'books'], ['reads']);
dd('u5-cp-5', 'u5-we-they', 'u5-checkpoint', 3, 'mixed', 'เราดื่มน้ำ', ['Subject', 'Verb', 'Object'], ['we', 'drink', 'water'], ['drinks']);

// ═══ U6 — My Day (mixed review, all frames, lvl3-4) ═══════════════════════════
dd('u6-p-1', 'u6-my-day', 'u6-pattern', 3, 'pattern', 'ฉันวิ่ง', ['Subject', 'Verb'], ['I', 'run']);
dd('u6-p-2', 'u6-my-day', 'u6-pattern', 3, 'pattern', 'หล่อนนอน', ['Subject', 'Verb'], ['she', 'sleeps']);
dd('u6-p-3', 'u6-my-day', 'u6-pattern', 3, 'pattern', 'เรากินข้าว', ['Subject', 'Verb', 'Object'], ['we', 'eat', 'rice']);
dd('u6-p-4', 'u6-my-day', 'u6-pattern', 3, 'pattern', 'เขาอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['he', 'reads', 'books']);
dd('u6-p-5', 'u6-my-day', 'u6-pattern', 3, 'pattern', 'พวกเขาว่ายน้ำ', ['Subject', 'Verb'], ['they', 'swim']);
dd('u6-wc-1', 'u6-my-day', 'u6-wordchoice', 4, 'wordChoice', 'ฉันชอบหมา', ['Subject', 'Verb', 'Object'], ['I', 'like', 'dogs'], ['likes', 'cats']);
dd('u6-wc-2', 'u6-my-day', 'u6-wordchoice', 4, 'wordChoice', 'เขาดื่มนม', ['Subject', 'Verb', 'Object'], ['he', 'drinks', 'milk'], ['drink', 'water']);
dd('u6-wc-3', 'u6-my-day', 'u6-wordchoice', 4, 'wordChoice', 'พวกเขากินปลา', ['Subject', 'Verb', 'Object'], ['they', 'eat', 'fish'], ['eats', 'rice']);
dd('u6-wc-4', 'u6-my-day', 'u6-wordchoice', 4, 'wordChoice', 'หล่อนอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['she', 'reads', 'books'], ['read']);
dd('u6-wc-5', 'u6-my-day', 'u6-wordchoice', 4, 'wordChoice', 'เรามีลูกบอล', ['Subject', 'Verb', 'Object'], ['we', 'have', 'balls'], ['has']);
dd('u6-g-1', 'u6-my-day', 'u6-grammar', 4, 'grammar', 'เขากินข้าว', ['Subject', 'Verb', 'Object'], ['he', 'eats', 'rice'], ['eat']);
dd('u6-g-2', 'u6-my-day', 'u6-grammar', 4, 'grammar', 'หล่อนชอบแมว', ['Subject', 'Verb', 'Object'], ['she', 'likes', 'cats'], ['like']);
dd('u6-g-3', 'u6-my-day', 'u6-grammar', 4, 'grammar', 'เราวิ่ง', ['Subject', 'Verb'], ['we', 'run'], ['runs']);
dd('u6-g-4', 'u6-my-day', 'u6-grammar', 4, 'grammar', 'พวกเขากระโดด', ['Subject', 'Verb'], ['they', 'jump'], ['jumps']);
dd('u6-g-5', 'u6-my-day', 'u6-grammar', 4, 'grammar', 'มันนอน', ['Subject', 'Verb'], ['it', 'sleeps'], ['sleep']);
dd('u6-cp-1', 'u6-my-day', 'u6-checkpoint', 4, 'mixed', 'ฉันกินข้าว', ['Subject', 'Verb', 'Object'], ['I', 'eat', 'rice'], ['water', 'eats']);
dd('u6-cp-2', 'u6-my-day', 'u6-checkpoint', 4, 'mixed', 'หล่อนดื่มนม', ['Subject', 'Verb', 'Object'], ['she', 'drinks', 'milk'], ['drink']);
dd('u6-cp-3', 'u6-my-day', 'u6-checkpoint', 4, 'mixed', 'พวกเขาชอบหมา', ['Subject', 'Verb', 'Object'], ['they', 'like', 'dogs'], ['likes']);
dd('u6-cp-4', 'u6-my-day', 'u6-checkpoint', 4, 'mixed', 'เขาอ่านหนังสือ', ['Subject', 'Verb', 'Object'], ['he', 'reads', 'books'], ['read', 'fish']);
dd('u6-cp-5', 'u6-my-day', 'u6-checkpoint', 4, 'mixed', 'เราว่ายน้ำ', ['Subject', 'Verb'], ['we', 'swim'], ['swims']);

// ── sheets ───────────────────────────────────────────────────────────────────
const course = [{ id: 'pre-a1-first-sentences', title: 'First Sentences', emoji: '🐣', l1Ready: true }];
const units = [
  { id: 'u1-me-you', title: 'Me & You', emoji: '🙋', order: 1, l1Enabled: true },
  { id: 'u2-things-i-do', title: 'Things I Do', emoji: '🏃', order: 2, l1Enabled: true },
  { id: 'u3-i-like', title: 'I Like Things', emoji: '🍚', order: 3, l1Enabled: true },
  { id: 'u4-he-she', title: 'He & She', emoji: '👧', order: 4, l1Enabled: true },
  { id: 'u5-we-they', title: 'We & They', emoji: '👨‍👩‍👧', order: 5, l1Enabled: true },
  { id: 'u6-my-day', title: 'My Day', emoji: '🌞', order: 6, l1Enabled: true },
];
const bosses = [
  { id: 'gate-after-u2', scope: 'gated', afterUnit: 'u2-things-i-do', reviewsUnits: 'u1-me-you,u2-things-i-do', reviewCount: 5, pinnedItemIds: '', rewardPetDefId: '' },
  { id: 'gate-after-u4', scope: 'gated', afterUnit: 'u4-he-she', reviewsUnits: 'u3-i-like,u4-he-she', reviewCount: 6, pinnedItemIds: '', rewardPetDefId: '' },
  { id: 'final-first-sentences', scope: 'final', afterUnit: '', reviewsUnits: 'u1-me-you,u2-things-i-do,u3-i-like,u4-he-she,u5-we-they,u6-my-day', reviewCount: 8, pinnedItemIds: '', rewardPetDefId: '' },
];

const ITEM_HEADER = ['id', 'kind', 'unit', 'node', 'level', 'variant', 'thaiHint', 'slots', 'answer',
  'distractors', 'front', 'back', 'l1_th', 'template', 'alternates', 'pair1', 'pair2', 'pair3', 'pair4'];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(course, { header: ['id', 'title', 'emoji', 'l1Ready'] }), 'Course');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(units, { header: ['id', 'title', 'emoji', 'order', 'l1Enabled'] }), 'Units');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items, { header: ITEM_HEADER }), 'Items');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bosses, { header: ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds', 'rewardPetDefId'] }), 'Bosses');

mkdirSync('courses', { recursive: true });
XLSX.writeFile(wb, 'courses/pre-a1-first-sentences.xlsx');
console.log(`wrote courses/pre-a1-first-sentences.xlsx — ${items.length} items, ${units.length} units, ${bosses.length} bosses`);

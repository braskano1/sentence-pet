// Generates Pre-A1 Course 3 "Yes, No, and Not" (negatives + yes/no questions).
// Run: node scripts/gen-c3.mjs  ->  courses/c3-yes-no-and-not.xlsx
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
const mt = (id, unit, node, level, l1_th, pairs) => {
  const row = { id, kind: 'matching', unit, node, level, l1_th };
  pairs.forEach((p, i) => { row[`pair${i + 1}`] = p; });
  items.push(row);
};
const S = 'Subject', V = 'Verb', O = 'Object', B = 'Be', A = 'Adjective', N = 'Not', H = 'Helper';

// ═══ U1 — I don't / You don't (present-simple negative; don't) ════════════════
fc('c3u1-fc-1', 'u1-i-dont', 'u1-vocab', 2, "don't", 'ไม่ (กับ I/you/we/they)', 'ไม่ (กับ I/you/we/they)');
fc('c3u1-fc-2', 'u1-i-dont', 'u1-vocab', 2, 'not', 'ไม่', 'ไม่');
fc('c3u1-fc-3', 'u1-i-dont', 'u1-vocab', 2, 'like', 'ชอบ', 'ชอบ');
fc('c3u1-fc-4', 'u1-i-dont', 'u1-vocab', 2, 'eat', 'กิน', 'กิน');
fc('c3u1-fc-5', 'u1-i-dont', 'u1-vocab', 2, 'fish', 'ปลา', 'ปลา');
mt('c3u1-mt-1', 'u1-i-dont', 'u1-sort', 2, 'จับคู่คำกับชนิดของคำ',
  ["I|Subject|ประธาน", "don't|Not|คำปฏิเสธ", 'like|Verb|คำกริยา', 'fish|Object|กรรม']);
dd('c3u1-p-1', 'u1-i-dont', 'u1-pattern', 2, 'pattern', 'ฉันไม่ชอบปลา', [S, N, V, O], ['I', "don't", 'like', 'fish']);
dd('c3u1-p-2', 'u1-i-dont', 'u1-pattern', 2, 'pattern', 'คุณไม่กินข้าว', [S, N, V, O], ['you', "don't", 'eat', 'rice']);
dd('c3u1-p-3', 'u1-i-dont', 'u1-pattern', 2, 'pattern', 'ฉันไม่ดื่มนม', [S, N, V, O], ['I', "don't", 'drink', 'milk']);
dd('c3u1-p-4', 'u1-i-dont', 'u1-pattern', 2, 'pattern', 'คุณไม่อ่านหนังสือ', [S, N, V, O], ['you', "don't", 'read', 'books']);
dd('c3u1-p-5', 'u1-i-dont', 'u1-pattern', 2, 'pattern', 'ฉันไม่ชอบแมว', [S, N, V, O], ['I', "don't", 'like', 'cats']);
dd('c3u1-cp-1', 'u1-i-dont', 'u1-checkpoint', 2, 'mixed', 'ฉันไม่ชอบปลา', [S, N, V, O], ['I', "don't", 'like', 'fish'], ["doesn't"]);
dd('c3u1-cp-2', 'u1-i-dont', 'u1-checkpoint', 2, 'mixed', 'คุณไม่กินข้าว', [S, N, V, O], ['you', "don't", 'eat', 'rice'], ["doesn't"]);
dd('c3u1-cp-3', 'u1-i-dont', 'u1-checkpoint', 2, 'mixed', 'ฉันไม่ดื่มน้ำ', [S, N, V, O], ['I', "don't", 'drink', 'water'], ["doesn't"]);
dd('c3u1-cp-4', 'u1-i-dont', 'u1-checkpoint', 2, 'mixed', 'คุณไม่อ่านหนังสือ', [S, N, V, O], ['you', "don't", 'read', 'books'], ["doesn't"]);
dd('c3u1-cp-5', 'u1-i-dont', 'u1-checkpoint', 2, 'mixed', 'ฉันไม่มีหมา', [S, N, V, O], ['I', "don't", 'have', 'dogs'], ["doesn't"]);

// ═══ U2 — He doesn't / She doesn't (3rd-person negative; doesn't + base verb) ══
fc('c3u2-fc-1', 'u2-he-doesnt', 'u2-vocab', 3, "doesn't", 'ไม่ (กับ he/she/it)', 'ไม่ (กับ he/she/it)');
fc('c3u2-fc-2', 'u2-he-doesnt', 'u2-vocab', 3, 'he', 'เขา', 'เขา');
fc('c3u2-fc-3', 'u2-he-doesnt', 'u2-vocab', 3, 'she', 'หล่อน', 'หล่อน');
fc('c3u2-fc-4', 'u2-he-doesnt', 'u2-vocab', 3, 'it', 'มัน', 'มัน');
fc('c3u2-fc-5', 'u2-he-doesnt', 'u2-vocab', 3, 'drink', 'ดื่ม', 'ดื่ม');
dd('c3u2-p-1', 'u2-he-doesnt', 'u2-pattern', 3, 'pattern', 'เขาไม่ชอบปลา', [S, N, V, O], ['he', "doesn't", 'like', 'fish']);
dd('c3u2-p-2', 'u2-he-doesnt', 'u2-pattern', 3, 'pattern', 'หล่อนไม่กินข้าว', [S, N, V, O], ['she', "doesn't", 'eat', 'rice']);
dd('c3u2-p-3', 'u2-he-doesnt', 'u2-pattern', 3, 'pattern', 'มันไม่ดื่มนม', [S, N, V, O], ['it', "doesn't", 'drink', 'milk']);
dd('c3u2-p-4', 'u2-he-doesnt', 'u2-pattern', 3, 'pattern', 'เขาไม่อ่านหนังสือ', [S, N, V, O], ['he', "doesn't", 'read', 'books']);
dd('c3u2-p-5', 'u2-he-doesnt', 'u2-pattern', 3, 'pattern', 'หล่อนไม่มีแมว', [S, N, V, O], ['she', "doesn't", 'have', 'cats']);
dd('c3u2-wc-1', 'u2-he-doesnt', 'u2-wordchoice', 3, 'wordChoice', 'เขาไม่ชอบปลา', [S, N, V, O], ['he', "doesn't", 'like', 'fish'], ['likes']);
dd('c3u2-wc-2', 'u2-he-doesnt', 'u2-wordchoice', 3, 'wordChoice', 'หล่อนไม่กินข้าว', [S, N, V, O], ['she', "doesn't", 'eat', 'rice'], ["don't"]);
dd('c3u2-wc-3', 'u2-he-doesnt', 'u2-wordchoice', 3, 'wordChoice', 'มันไม่ดื่มน้ำ', [S, N, V, O], ['it', "doesn't", 'drink', 'water'], ['drinks']);
dd('c3u2-wc-4', 'u2-he-doesnt', 'u2-wordchoice', 3, 'wordChoice', 'เขาไม่อ่านหนังสือ', [S, N, V, O], ['he', "doesn't", 'read', 'books'], ["don't"]);
dd('c3u2-wc-5', 'u2-he-doesnt', 'u2-wordchoice', 3, 'wordChoice', 'หล่อนไม่มีหมา', [S, N, V, O], ['she', "doesn't", 'have', 'dogs'], ['has']);
dd('c3u2-cp-1', 'u2-he-doesnt', 'u2-checkpoint', 3, 'mixed', 'เขาไม่ชอบแมว', [S, N, V, O], ['he', "doesn't", 'like', 'cats'], ["don't"]);
dd('c3u2-cp-2', 'u2-he-doesnt', 'u2-checkpoint', 3, 'mixed', 'หล่อนไม่ดื่มนม', [S, N, V, O], ['she', "doesn't", 'drink', 'milk'], ['drinks']);
dd('c3u2-cp-3', 'u2-he-doesnt', 'u2-checkpoint', 3, 'mixed', 'มันไม่กินปลา', [S, N, V, O], ['it', "doesn't", 'eat', 'fish'], ['eats']);
dd('c3u2-cp-4', 'u2-he-doesnt', 'u2-checkpoint', 3, 'mixed', 'เขาไม่อ่านหนังสือ', [S, N, V, O], ['he', "doesn't", 'read', 'books'], ["don't"]);
dd('c3u2-cp-5', 'u2-he-doesnt', 'u2-checkpoint', 3, 'mixed', 'หล่อนไม่มีลูกบอล', [S, N, V, O], ['she', "doesn't", 'have', 'balls'], ['has']);

// ═══ U3 — Not Happy (negative be; Subject+Be+Not+Adjective) ═══════════════════
fc('c3u3-fc-1', 'u3-not-happy', 'u3-vocab', 3, 'not', 'ไม่', 'ไม่');
fc('c3u3-fc-2', 'u3-not-happy', 'u3-vocab', 3, 'happy', 'มีความสุข', 'มีความสุข');
fc('c3u3-fc-3', 'u3-not-happy', 'u3-vocab', 3, 'sad', 'เศร้า', 'เศร้า');
fc('c3u3-fc-4', 'u3-not-happy', 'u3-vocab', 3, 'hot', 'ร้อน', 'ร้อน');
fc('c3u3-fc-5', 'u3-not-happy', 'u3-vocab', 3, 'cold', 'หนาว', 'หนาว');
dd('c3u3-p-1', 'u3-not-happy', 'u3-pattern', 3, 'pattern', 'ฉันไม่เศร้า', [S, B, N, A], ['I', 'am', 'not', 'sad']);
dd('c3u3-p-2', 'u3-not-happy', 'u3-pattern', 3, 'pattern', 'เขาไม่ร้อน', [S, B, N, A], ['he', 'is', 'not', 'hot']);
dd('c3u3-p-3', 'u3-not-happy', 'u3-pattern', 3, 'pattern', 'หล่อนไม่หนาว', [S, B, N, A], ['she', 'is', 'not', 'cold']);
dd('c3u3-p-4', 'u3-not-happy', 'u3-pattern', 3, 'pattern', 'คุณตัวไม่ใหญ่', [S, B, N, A], ['you', 'are', 'not', 'big']);
dd('c3u3-p-5', 'u3-not-happy', 'u3-pattern', 3, 'pattern', 'มันตัวไม่เล็ก', [S, B, N, A], ['it', 'is', 'not', 'small']);
dd('c3u3-wc-1', 'u3-not-happy', 'u3-wordchoice', 3, 'wordChoice', 'เขาไม่มีความสุข', [S, B, N, A], ['he', 'is', 'not', 'happy'], ['am', 'are']);
dd('c3u3-wc-2', 'u3-not-happy', 'u3-wordchoice', 3, 'wordChoice', 'ฉันไม่หนาว', [S, B, N, A], ['I', 'am', 'not', 'cold'], ['is']);
dd('c3u3-wc-3', 'u3-not-happy', 'u3-wordchoice', 3, 'wordChoice', 'พวกเขาไม่เศร้า', [S, B, N, A], ['they', 'are', 'not', 'sad'], ['is']);
dd('c3u3-wc-4', 'u3-not-happy', 'u3-wordchoice', 3, 'wordChoice', 'หล่อนตัวไม่สูง', [S, B, N, A], ['she', 'is', 'not', 'tall'], ['are']);
dd('c3u3-wc-5', 'u3-not-happy', 'u3-wordchoice', 3, 'wordChoice', 'มันไม่ร้อน', [S, B, N, A], ['it', 'is', 'not', 'hot'], ['am']);
dd('c3u3-cp-1', 'u3-not-happy', 'u3-checkpoint', 3, 'mixed', 'ฉันไม่หิว', [S, B, N, A], ['I', 'am', 'not', 'hungry'], ['is']);
dd('c3u3-cp-2', 'u3-not-happy', 'u3-checkpoint', 3, 'mixed', 'เขาตัวไม่ใหญ่', [S, B, N, A], ['he', 'is', 'not', 'big'], ['are']);
dd('c3u3-cp-3', 'u3-not-happy', 'u3-checkpoint', 3, 'mixed', 'หล่อนไม่มีความสุข', [S, B, N, A], ['she', 'is', 'not', 'happy'], ['am']);
dd('c3u3-cp-4', 'u3-not-happy', 'u3-checkpoint', 3, 'mixed', 'เราไม่หนาว', [S, B, N, A], ['we', 'are', 'not', 'cold'], ['is']);
dd('c3u3-cp-5', 'u3-not-happy', 'u3-checkpoint', 3, 'mixed', 'มันตัวไม่เล็ก', [S, B, N, A], ['it', 'is', 'not', 'small'], ['are']);

// ═══ U4 — Do You…? (yes/no questions present simple + short answers) ══════════
fc('c3u4-fc-1', 'u4-do-you', 'u4-vocab', 3, 'do', 'ใช้ขึ้นต้นคำถาม (I/you/we/they)', 'ใช้ขึ้นต้นคำถาม (I/you/we/they)');
fc('c3u4-fc-2', 'u4-do-you', 'u4-vocab', 3, 'does', 'ใช้ขึ้นต้นคำถาม (he/she/it)', 'ใช้ขึ้นต้นคำถาม (he/she/it)');
fc('c3u4-fc-3', 'u4-do-you', 'u4-vocab', 3, 'Yes', 'ใช่', 'ใช่');
fc('c3u4-fc-4', 'u4-do-you', 'u4-vocab', 3, 'No', 'ไม่', 'ไม่');
ddq('c3u4-p-1', 'u4-do-you', 'u4-pattern', 3, 'pattern', 'คุณชอบปลาไหม', [H, S, V, O], ['do', 'you', 'like', 'fish']);
ddq('c3u4-p-2', 'u4-do-you', 'u4-pattern', 3, 'pattern', 'คุณกินข้าวไหม', [H, S, V, O], ['do', 'you', 'eat', 'rice']);
ddq('c3u4-p-3', 'u4-do-you', 'u4-pattern', 3, 'pattern', 'เขาชอบหนังสือไหม', [H, S, V, O], ['does', 'he', 'like', 'books']);
ddq('c3u4-p-4', 'u4-do-you', 'u4-pattern', 3, 'pattern', 'หล่อนดื่มนมไหม', [H, S, V, O], ['does', 'she', 'drink', 'milk']);
ddq('c3u4-p-5', 'u4-do-you', 'u4-pattern', 3, 'pattern', 'คุณมีหมาไหม', [H, S, V, O], ['do', 'you', 'have', 'dogs']);
ddq('c3u4-wc-1', 'u4-do-you', 'u4-wordchoice', 3, 'wordChoice', 'คุณชอบปลาไหม', [H, S, V, O], ['do', 'you', 'like', 'fish'], ['does']);
ddq('c3u4-wc-2', 'u4-do-you', 'u4-wordchoice', 3, 'wordChoice', 'เขากินข้าวไหม', [H, S, V, O], ['does', 'he', 'eat', 'rice'], ['do']);
ddq('c3u4-wc-3', 'u4-do-you', 'u4-wordchoice', 3, 'wordChoice', 'หล่อนอ่านหนังสือไหม', [H, S, V, O], ['does', 'she', 'read', 'books'], ['reads']);
ddq('c3u4-wc-4', 'u4-do-you', 'u4-wordchoice', 3, 'wordChoice', 'คุณดื่มน้ำไหม', [H, S, V, O], ['do', 'you', 'drink', 'water'], ['does']);
ddq('c3u4-wc-5', 'u4-do-you', 'u4-wordchoice', 3, 'wordChoice', 'มันชอบแมวไหม', [H, S, V, O], ['does', 'it', 'like', 'cats'], ['likes']);
mt('c3u4-mt-1', 'u4-do-you', 'u4-answers', 3, 'จับคู่คำถามกับคำตอบสั้น',
  ['Do you like fish?|Yes, I do.|ใช่', "Does he eat rice?|No, he doesn't.|ไม่", 'Do you have dogs?|Yes, I do.|ใช่']);
ddq('c3u4-cp-1', 'u4-do-you', 'u4-checkpoint', 3, 'mixed', 'คุณชอบแมวไหม', [H, S, V, O], ['do', 'you', 'like', 'cats'], ['does']);
ddq('c3u4-cp-2', 'u4-do-you', 'u4-checkpoint', 3, 'mixed', 'เขาดื่มนมไหม', [H, S, V, O], ['does', 'he', 'drink', 'milk'], ['do']);
ddq('c3u4-cp-3', 'u4-do-you', 'u4-checkpoint', 3, 'mixed', 'หล่อนกินปลาไหม', [H, S, V, O], ['does', 'she', 'eat', 'fish'], ['eats']);
ddq('c3u4-cp-4', 'u4-do-you', 'u4-checkpoint', 3, 'mixed', 'คุณอ่านหนังสือไหม', [H, S, V, O], ['do', 'you', 'read', 'books'], ['does']);
ddq('c3u4-cp-5', 'u4-do-you', 'u4-checkpoint', 3, 'mixed', 'มันมีลูกบอลไหม', [H, S, V, O], ['does', 'it', 'have', 'balls'], ['has']);

// ═══ U5 — Are You…? Is It…? (be questions + short answers) ════════════════════
fc('c3u5-fc-1', 'u5-are-you', 'u5-vocab', 3, 'Are', 'ใช้ขึ้นต้นคำถาม (you/we/they)', 'ใช้ขึ้นต้นคำถาม (you/we/they)');
fc('c3u5-fc-2', 'u5-are-you', 'u5-vocab', 3, 'Is', 'ใช้ขึ้นต้นคำถาม (he/she/it)', 'ใช้ขึ้นต้นคำถาม (he/she/it)');
fc('c3u5-fc-3', 'u5-are-you', 'u5-vocab', 3, 'happy', 'มีความสุข', 'มีความสุข');
fc('c3u5-fc-4', 'u5-are-you', 'u5-vocab', 3, 'hot', 'ร้อน', 'ร้อน');
fc('c3u5-fc-5', 'u5-are-you', 'u5-vocab', 3, 'tall', 'สูง', 'สูง');
ddq('c3u5-p-1', 'u5-are-you', 'u5-pattern', 3, 'pattern', 'คุณมีความสุขไหม', [B, S, A], ['are', 'you', 'happy']);
ddq('c3u5-p-2', 'u5-are-you', 'u5-pattern', 3, 'pattern', 'มันร้อนไหม', [B, S, A], ['is', 'it', 'hot']);
ddq('c3u5-p-3', 'u5-are-you', 'u5-pattern', 3, 'pattern', 'เขาสูงไหม', [B, S, A], ['is', 'he', 'tall']);
ddq('c3u5-p-4', 'u5-are-you', 'u5-pattern', 3, 'pattern', 'พวกเขาตัวใหญ่ไหม', [B, S, A], ['are', 'they', 'big']);
ddq('c3u5-p-5', 'u5-are-you', 'u5-pattern', 3, 'pattern', 'หล่อนเศร้าไหม', [B, S, A], ['is', 'she', 'sad']);
ddq('c3u5-wc-1', 'u5-are-you', 'u5-wordchoice', 3, 'wordChoice', 'คุณหนาวไหม', [B, S, A], ['are', 'you', 'cold'], ['is']);
ddq('c3u5-wc-2', 'u5-are-you', 'u5-wordchoice', 3, 'wordChoice', 'มันตัวเล็กไหม', [B, S, A], ['is', 'it', 'small'], ['are']);
ddq('c3u5-wc-3', 'u5-are-you', 'u5-wordchoice', 3, 'wordChoice', 'เขาหิวไหม', [B, S, A], ['is', 'he', 'hungry'], ['are']);
ddq('c3u5-wc-4', 'u5-are-you', 'u5-wordchoice', 3, 'wordChoice', 'พวกเขามีความสุขไหม', [B, S, A], ['are', 'they', 'happy'], ['is']);
ddq('c3u5-wc-5', 'u5-are-you', 'u5-wordchoice', 3, 'wordChoice', 'หล่อนสูงไหม', [B, S, A], ['is', 'she', 'tall'], ['are']);
mt('c3u5-mt-1', 'u5-are-you', 'u5-answers', 3, 'จับคู่คำถามกับคำตอบสั้น',
  ['Are you happy?|Yes, I am.|ใช่', "Is it hot?|No, it isn't.|ไม่", 'Are they tall?|Yes, they are.|ใช่']);
ddq('c3u5-cp-1', 'u5-are-you', 'u5-checkpoint', 3, 'mixed', 'คุณหิวไหม', [B, S, A], ['are', 'you', 'hungry'], ['is']);
ddq('c3u5-cp-2', 'u5-are-you', 'u5-checkpoint', 3, 'mixed', 'มันหนาวไหม', [B, S, A], ['is', 'it', 'cold'], ['are']);
ddq('c3u5-cp-3', 'u5-are-you', 'u5-checkpoint', 3, 'mixed', 'เขาเศร้าไหม', [B, S, A], ['is', 'he', 'sad'], ['are']);
ddq('c3u5-cp-4', 'u5-are-you', 'u5-checkpoint', 3, 'mixed', 'พวกเขาสูงไหม', [B, S, A], ['are', 'they', 'tall'], ['is']);
ddq('c3u5-cp-5', 'u5-are-you', 'u5-checkpoint', 3, 'mixed', 'หล่อนมีความสุขไหม', [B, S, A], ['is', 'she', 'happy'], ['are']);

// ═══ U6 — Yes, No, Maybe (mixed review: negatives + questions) ════════════════
dd('c3u6-p-1', 'u6-yes-no', 'u6-pattern', 4, 'pattern', 'ฉันไม่ชอบปลา', [S, N, V, O], ['I', "don't", 'like', 'fish']);
ddq('c3u6-p-2', 'u6-yes-no', 'u6-pattern', 4, 'pattern', 'เขากินข้าวไหม', [H, S, V, O], ['does', 'he', 'eat', 'rice']);
dd('c3u6-p-3', 'u6-yes-no', 'u6-pattern', 4, 'pattern', 'หล่อนไม่มีความสุข', [S, B, N, A], ['she', 'is', 'not', 'happy']);
ddq('c3u6-p-4', 'u6-yes-no', 'u6-pattern', 4, 'pattern', 'คุณสูงไหม', [B, S, A], ['are', 'you', 'tall']);
dd('c3u6-p-5', 'u6-yes-no', 'u6-pattern', 4, 'pattern', 'พวกเขาไม่อ่านหนังสือ', [S, N, V, O], ['they', "don't", 'read', 'books']);
dd('c3u6-wc-1', 'u6-yes-no', 'u6-wordchoice', 4, 'wordChoice', 'เขาไม่ชอบแมว', [S, N, V, O], ['he', "doesn't", 'like', 'cats'], ["don't"]);
ddq('c3u6-wc-2', 'u6-yes-no', 'u6-wordchoice', 4, 'wordChoice', 'คุณดื่มนมไหม', [H, S, V, O], ['do', 'you', 'drink', 'milk'], ['does']);
dd('c3u6-wc-3', 'u6-yes-no', 'u6-wordchoice', 4, 'wordChoice', 'มันไม่ร้อน', [S, B, N, A], ['it', 'is', 'not', 'hot'], ['are']);
ddq('c3u6-wc-4', 'u6-yes-no', 'u6-wordchoice', 4, 'wordChoice', 'หล่อนมีความสุขไหม', [B, S, A], ['is', 'she', 'happy'], ['are']);
dd('c3u6-wc-5', 'u6-yes-no', 'u6-wordchoice', 4, 'wordChoice', 'เราไม่มีหมา', [S, N, V, O], ['we', "don't", 'have', 'dogs'], ["doesn't"]);
dd('c3u6-g-1', 'u6-yes-no', 'u6-grammar', 4, 'grammar', 'เขาไม่กินข้าว', [S, N, V, O], ['he', "doesn't", 'eat', 'rice'], ['eats']);
ddq('c3u6-g-2', 'u6-yes-no', 'u6-grammar', 4, 'grammar', 'หล่อนชอบหนังสือไหม', [H, S, V, O], ['does', 'she', 'like', 'books'], ['likes']);
dd('c3u6-g-3', 'u6-yes-no', 'u6-grammar', 4, 'grammar', 'พวกเขาไม่ดื่มน้ำ', [S, N, V, O], ['they', "don't", 'drink', 'water'], ["doesn't"]);
ddq('c3u6-g-4', 'u6-yes-no', 'u6-grammar', 4, 'grammar', 'คุณอ่านหนังสือไหม', [H, S, V, O], ['do', 'you', 'read', 'books'], ['does']);
dd('c3u6-g-5', 'u6-yes-no', 'u6-grammar', 4, 'grammar', 'มันไม่มีลูกบอล', [S, N, V, O], ['it', "doesn't", 'have', 'balls'], ['has']);
dd('c3u6-cp-1', 'u6-yes-no', 'u6-checkpoint', 4, 'mixed', 'ฉันไม่ชอบปลา', [S, N, V, O], ['I', "don't", 'like', 'fish'], ["doesn't"]);
ddq('c3u6-cp-2', 'u6-yes-no', 'u6-checkpoint', 4, 'mixed', 'เขาดื่มนมไหม', [H, S, V, O], ['does', 'he', 'drink', 'milk'], ['do']);
dd('c3u6-cp-3', 'u6-yes-no', 'u6-checkpoint', 4, 'mixed', 'หล่อนไม่เศร้า', [S, B, N, A], ['she', 'is', 'not', 'sad'], ['are']);
ddq('c3u6-cp-4', 'u6-yes-no', 'u6-checkpoint', 4, 'mixed', 'คุณมีความสุขไหม', [B, S, A], ['are', 'you', 'happy'], ['is']);
dd('c3u6-cp-5', 'u6-yes-no', 'u6-checkpoint', 4, 'mixed', 'พวกเขาไม่กินข้าว', [S, N, V, O], ['they', "don't", 'eat', 'rice'], ["doesn't"]);

// ── sheets ───────────────────────────────────────────────────────────────────
const course = [{ id: 'pre-a1-c3-yes-no', title: 'Yes, No, and Not', emoji: '❓', l1Ready: true }];
const units = [
  { id: 'u1-i-dont', title: "I don't, You don't", emoji: '🙅', order: 1, l1Enabled: true },
  { id: 'u2-he-doesnt', title: "He doesn't, She doesn't", emoji: '🙅‍♂️', order: 2, l1Enabled: true },
  { id: 'u3-not-happy', title: 'Not Happy', emoji: '😕', order: 3, l1Enabled: true },
  { id: 'u4-do-you', title: 'Do You…?', emoji: '❓', order: 4, l1Enabled: true },
  { id: 'u5-are-you', title: 'Are You…? Is It…?', emoji: '❔', order: 5, l1Enabled: true },
  { id: 'u6-yes-no', title: 'Yes, No, Maybe', emoji: '🎲', order: 6, l1Enabled: true },
];
const bosses = [
  { id: 'c3-gate-after-u2', scope: 'gated', afterUnit: 'u2-he-doesnt', reviewsUnits: 'u1-i-dont,u2-he-doesnt', reviewCount: 5, pinnedItemIds: '', rewardPetDefId: '' },
  { id: 'c3-gate-after-u4', scope: 'gated', afterUnit: 'u4-do-you', reviewsUnits: 'u3-not-happy,u4-do-you', reviewCount: 6, pinnedItemIds: '', rewardPetDefId: '' },
  { id: 'c3-final-yes-no', scope: 'final', afterUnit: '', reviewsUnits: 'u1-i-dont,u2-he-doesnt,u3-not-happy,u4-do-you,u5-are-you,u6-yes-no', reviewCount: 8, pinnedItemIds: '', rewardPetDefId: '' },
];

const ITEM_HEADER = ['id', 'kind', 'unit', 'node', 'level', 'variant', 'thaiHint', 'slots', 'answer',
  'distractors', 'punct', 'front', 'back', 'l1_th', 'template', 'alternates', 'pair1', 'pair2', 'pair3', 'pair4'];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(course, { header: ['id', 'title', 'emoji', 'l1Ready'] }), 'Course');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(units, { header: ['id', 'title', 'emoji', 'order', 'l1Enabled'] }), 'Units');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items, { header: ITEM_HEADER }), 'Items');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bosses, { header: ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds', 'rewardPetDefId'] }), 'Bosses');

mkdirSync('courses', { recursive: true });
XLSX.writeFile(wb, 'courses/c3-yes-no-and-not.xlsx');
console.log(`wrote courses/c3-yes-no-and-not.xlsx — ${items.length} items, ${units.length} units, ${bosses.length} bosses`);

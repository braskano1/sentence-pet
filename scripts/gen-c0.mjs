// Generates Pre-A1 Course 0 "ABC & First Words" — the pre-C1 on-ramp.
// Vocab only (flashcard + matching), no sentence building, no slot dependency.
// Run: node scripts/gen-c0.mjs  ->  courses/c0-abc-first-words.xlsx
import * as XLSX from 'xlsx';
import { mkdirSync } from 'node:fs';

const items = [];
const fc = (id, unit, node, level, front, back, l1_th) =>
  items.push({ id, kind: 'flashcard', unit, node, level, front, back, l1_th });
const mt = (id, unit, node, level, l1_th, pairs) => {
  const row = { id, kind: 'matching', unit, node, level, l1_th };
  pairs.forEach((p, i) => { row[`pair${i + 1}`] = p; });
  items.push(row);
};

// ═══ U1 — Alphabet A–M ════════════════════════════════════════════════════════
fc('c0u1-fc-1', 'u1-abc-am', 'u1-vocab1', 1, 'A a', 'apple', 'แอปเปิล');
fc('c0u1-fc-2', 'u1-abc-am', 'u1-vocab1', 1, 'B b', 'ball', 'ลูกบอล');
fc('c0u1-fc-3', 'u1-abc-am', 'u1-vocab1', 1, 'C c', 'cat', 'แมว');
fc('c0u1-fc-4', 'u1-abc-am', 'u1-vocab1', 1, 'D d', 'dog', 'หมา');
fc('c0u1-fc-5', 'u1-abc-am', 'u1-vocab1', 1, 'E e', 'egg', 'ไข่');
fc('c0u1-fc-6', 'u1-abc-am', 'u1-vocab1', 1, 'F f', 'fish', 'ปลา');
fc('c0u1-fc-7', 'u1-abc-am', 'u1-vocab2', 1, 'G g', 'goat', 'แพะ');
fc('c0u1-fc-8', 'u1-abc-am', 'u1-vocab2', 1, 'H h', 'hat', 'หมวก');
fc('c0u1-fc-9', 'u1-abc-am', 'u1-vocab2', 1, 'I i', 'ice', 'น้ำแข็ง');
fc('c0u1-fc-10', 'u1-abc-am', 'u1-vocab2', 1, 'J j', 'jam', 'แยม');
fc('c0u1-fc-11', 'u1-abc-am', 'u1-vocab2', 1, 'K k', 'kite', 'ว่าว');
fc('c0u1-fc-12', 'u1-abc-am', 'u1-vocab2', 1, 'L l', 'lion', 'สิงโต');
fc('c0u1-fc-13', 'u1-abc-am', 'u1-vocab2', 1, 'M m', 'milk', 'นม');
mt('c0u1-mt-1', 'u1-abc-am', 'u1-checkpoint', 1, 'จับคู่ตัวอักษรกับคำ',
  ['A|apple|แอปเปิล', 'B|ball|ลูกบอล', 'C|cat|แมว', 'D|dog|หมา', 'E|egg|ไข่']);

// ═══ U2 — Alphabet N–Z ════════════════════════════════════════════════════════
fc('c0u2-fc-1', 'u2-abc-nz', 'u2-vocab1', 1, 'N n', 'nose', 'จมูก');
fc('c0u2-fc-2', 'u2-abc-nz', 'u2-vocab1', 1, 'O o', 'orange', 'ส้ม');
fc('c0u2-fc-3', 'u2-abc-nz', 'u2-vocab1', 1, 'P p', 'pen', 'ปากกา');
fc('c0u2-fc-4', 'u2-abc-nz', 'u2-vocab1', 1, 'Q q', 'queen', 'ราชินี');
fc('c0u2-fc-5', 'u2-abc-nz', 'u2-vocab1', 1, 'R r', 'red', 'สีแดง');
fc('c0u2-fc-6', 'u2-abc-nz', 'u2-vocab1', 1, 'S s', 'sun', 'พระอาทิตย์');
fc('c0u2-fc-7', 'u2-abc-nz', 'u2-vocab2', 1, 'T t', 'tree', 'ต้นไม้');
fc('c0u2-fc-8', 'u2-abc-nz', 'u2-vocab2', 1, 'U u', 'umbrella', 'ร่ม');
fc('c0u2-fc-9', 'u2-abc-nz', 'u2-vocab2', 1, 'V v', 'van', 'รถตู้');
fc('c0u2-fc-10', 'u2-abc-nz', 'u2-vocab2', 1, 'W w', 'water', 'น้ำ');
fc('c0u2-fc-11', 'u2-abc-nz', 'u2-vocab2', 1, 'X x', 'box', 'กล่อง');
fc('c0u2-fc-12', 'u2-abc-nz', 'u2-vocab2', 1, 'Y y', 'yoyo', 'โยโย่');
fc('c0u2-fc-13', 'u2-abc-nz', 'u2-vocab2', 1, 'Z z', 'zoo', 'สวนสัตว์');
mt('c0u2-mt-1', 'u2-abc-nz', 'u2-checkpoint', 1, 'จับคู่ตัวอักษรกับคำ',
  ['N|nose|จมูก', 'O|orange|ส้ม', 'P|pen|ปากกา', 'Q|queen|ราชินี', 'S|sun|พระอาทิตย์']);

// ═══ U3 — Colors ══════════════════════════════════════════════════════════════
fc('c0u3-fc-1', 'u3-colors', 'u3-vocab', 1, 'red', 'สีแดง', 'สีแดง');
fc('c0u3-fc-2', 'u3-colors', 'u3-vocab', 1, 'blue', 'สีน้ำเงิน', 'สีน้ำเงิน');
fc('c0u3-fc-3', 'u3-colors', 'u3-vocab', 1, 'green', 'สีเขียว', 'สีเขียว');
fc('c0u3-fc-4', 'u3-colors', 'u3-vocab', 1, 'yellow', 'สีเหลือง', 'สีเหลือง');
fc('c0u3-fc-5', 'u3-colors', 'u3-vocab', 1, 'black', 'สีดำ', 'สีดำ');
fc('c0u3-fc-6', 'u3-colors', 'u3-vocab', 1, 'white', 'สีขาว', 'สีขาว');
mt('c0u3-mt-1', 'u3-colors', 'u3-checkpoint', 1, 'จับคู่สีกับคำไทย',
  ['red|แดง|สีแดง', 'blue|น้ำเงิน|สีน้ำเงิน', 'green|เขียว|สีเขียว', 'yellow|เหลือง|สีเหลือง', 'black|ดำ|สีดำ']);

// ═══ U4 — Hello! (greetings + politeness) ═════════════════════════════════════
fc('c0u4-fc-1', 'u4-hello', 'u4-vocab', 1, 'hello', 'สวัสดี', 'สวัสดี');
fc('c0u4-fc-2', 'u4-hello', 'u4-vocab', 1, 'hi', 'หวัดดี', 'หวัดดี');
fc('c0u4-fc-3', 'u4-hello', 'u4-vocab', 1, 'bye', 'ลาก่อน', 'ลาก่อน');
fc('c0u4-fc-4', 'u4-hello', 'u4-vocab', 1, 'yes', 'ใช่', 'ใช่');
fc('c0u4-fc-5', 'u4-hello', 'u4-vocab', 1, 'no', 'ไม่', 'ไม่');
fc('c0u4-fc-6', 'u4-hello', 'u4-vocab', 1, 'please', 'กรุณา', 'กรุณา');
fc('c0u4-fc-7', 'u4-hello', 'u4-vocab', 1, 'thank you', 'ขอบคุณ', 'ขอบคุณ');
mt('c0u4-mt-1', 'u4-hello', 'u4-checkpoint', 1, 'จับคู่คำทักทายกับคำไทย',
  ['hello|สวัสดี|สวัสดี', 'bye|ลาก่อน|ลาก่อน', 'yes|ใช่|ใช่', 'no|ไม่|ไม่', 'thank you|ขอบคุณ|ขอบคุณ']);

// ═══ U5 — In the Classroom ════════════════════════════════════════════════════
fc('c0u5-fc-1', 'u5-classroom', 'u5-vocab', 1, 'book', 'หนังสือ', 'หนังสือ');
fc('c0u5-fc-2', 'u5-classroom', 'u5-vocab', 1, 'pen', 'ปากกา', 'ปากกา');
fc('c0u5-fc-3', 'u5-classroom', 'u5-vocab', 1, 'pencil', 'ดินสอ', 'ดินสอ');
fc('c0u5-fc-4', 'u5-classroom', 'u5-vocab', 1, 'desk', 'โต๊ะ', 'โต๊ะ');
fc('c0u5-fc-5', 'u5-classroom', 'u5-vocab', 1, 'bag', 'กระเป๋า', 'กระเป๋า');
fc('c0u5-fc-6', 'u5-classroom', 'u5-vocab', 1, 'teacher', 'ครู', 'ครู');
fc('c0u5-fc-7', 'u5-classroom', 'u5-vocab', 1, 'student', 'นักเรียน', 'นักเรียน');
mt('c0u5-mt-1', 'u5-classroom', 'u5-checkpoint', 1, 'จับคู่ของในห้องเรียนกับคำไทย',
  ['book|หนังสือ|หนังสือ', 'pen|ปากกา|ปากกา', 'pencil|ดินสอ|ดินสอ', 'desk|โต๊ะ|โต๊ะ', 'bag|กระเป๋า|กระเป๋า']);

// ── sheets ───────────────────────────────────────────────────────────────────
const course = [{ id: 'pre-a1-c0-abc', title: 'ABC & First Words', emoji: '🔤', l1Ready: true }];
const units = [
  { id: 'u1-abc-am', title: 'Alphabet A–M', emoji: '🔠', order: 1, l1Enabled: true },
  { id: 'u2-abc-nz', title: 'Alphabet N–Z', emoji: '🔡', order: 2, l1Enabled: true },
  { id: 'u3-colors', title: 'Colors', emoji: '🌈', order: 3, l1Enabled: true },
  { id: 'u4-hello', title: 'Hello!', emoji: '👋', order: 4, l1Enabled: true },
  { id: 'u5-classroom', title: 'In the Classroom', emoji: '🎒', order: 5, l1Enabled: true },
];
// Vocab-only course: no gated bosses (boss runtime expects drill items); single final only.
const bosses = [
  { id: 'c0-final-abc', scope: 'final', afterUnit: '', reviewsUnits: 'u1-abc-am,u2-abc-nz,u3-colors,u4-hello,u5-classroom', reviewCount: 8, pinnedItemIds: '', rewardPetDefId: '' },
];

const ITEM_HEADER = ['id', 'kind', 'unit', 'node', 'level', 'front', 'back', 'l1_th', 'pair1', 'pair2', 'pair3', 'pair4', 'pair5'];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(course, { header: ['id', 'title', 'emoji', 'l1Ready'] }), 'Course');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(units, { header: ['id', 'title', 'emoji', 'order', 'l1Enabled'] }), 'Units');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items, { header: ITEM_HEADER }), 'Items');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bosses, { header: ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds', 'rewardPetDefId'] }), 'Bosses');

mkdirSync('courses', { recursive: true });
XLSX.writeFile(wb, 'courses/c0-abc-first-words.xlsx');
console.log(`wrote courses/c0-abc-first-words.xlsx — ${items.length} items, ${units.length} units, ${bosses.length} bosses`);

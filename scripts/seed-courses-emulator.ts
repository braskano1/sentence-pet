// Seed the Pre-A1 course workbooks into the LOCAL Firestore emulator so they show
// up in the app's course-select. Run with the emulator already running:
//   npx vite-node scripts/seed-courses-emulator.ts
// Mirrors src/firebase/content.ts saveCourse: writes content/courses/<id>/doc
// and the content/coursesIndex aggregate.
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { parseWorkbookToCourse } from '../src/content/excelImport';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const PROJECT_ID = 'demo-sentence-pet';

// Level order for the course-select list.
const FILES = [
  'courses/c0-abc-first-words.xlsx',
  'courses/pre-a1-first-sentences.xlsx',
  'courses/c2-i-am-you-are.xlsx',
  'courses/c3-yes-no-and-not.xlsx',
  'courses/c4-where-what.xlsx',
];

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const indexEntries: Array<Record<string, unknown>> = [];

for (const file of FILES) {
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
  const { course, errors } = parseWorkbookToCourse(wb);
  if (!course || errors.length) {
    console.error(`✗ ${file}: ${errors.join('; ') || 'no course'}`);
    process.exit(1);
  }
  await db.doc(`content/courses/${course.id}/doc`).set({ course });
  indexEntries.push({
    id: course.id,
    title: course.title,
    ...(course.emoji !== undefined ? { emoji: course.emoji } : {}),
    ...(course.l1Ready !== undefined ? { l1Ready: course.l1Ready } : {}),
  });
  const units = course.units.length;
  const items = Object.keys(course.pool).length;
  console.log(`✓ ${course.id} — ${course.title} (${units} units, ${items} items)`);
}

await db.doc('content/coursesIndex').set({ courses: indexEntries });
console.log(`\nseeded coursesIndex with ${indexEntries.length} courses → emulator ${process.env.FIRESTORE_EMULATOR_HOST}`);
process.exit(0);

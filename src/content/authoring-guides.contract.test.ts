// Contract guard for docs/authoring/*.md. Simulates a cold AI following the
// guides — emitting TSV tables per their documented output format — then asserts
// they import clean through parseWorkbookToCourse + validateCourse. If the
// importer's column contract changes, this fails, signalling the guides went
// stale and must be updated alongside the code.
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbookToCourse } from './excelImport';
import { validateCourse, validatePetDefs } from './validate';
import { importPets } from './petImport';
import { BUILTIN_PET_DEFS } from '../domain/petDef';
import { mergeById } from './mergeById';

// Each block is exactly what a guide tells the AI to emit (tab-separated),
// minus the `=== Sheet ===` label which only names the target sheet.
const COURSE = `id\ttitle\temoji\tl1Ready
thai-eng-starter\tThai → English Starter\t🐣\ttrue`;

const UNITS = `id\ttitle\temoji\torder\tl1Enabled
u1-basics\tBasics\t🐣\t1\ttrue
u2-next-steps\tNext Steps\t🌱\t2\ttrue`;

// All 4 item kinds. Each unit's LAST node group is its checkpoint.
const ITEMS = `id\tkind\tunit\tnode\tlevel\tvariant\tthaiHint\tslots\tanswer\tdistractors\tfront\tback\ttemplate\talternates\tl1_th\tpair1\tpair2
l1-1\tdragdrop\tu1-basics\tu1-pattern\t1\tpattern\tฉันวิ่ง\tPronoun,Verb\tI,run\t\t\t\t\t\t\t\t
wc-l1-1\tdragdrop\tu1-basics\tu1-wordchoice\t1\twordChoice\tฉันวิ่ง\tPronoun,Verb\tI,run\truns,running\t\t\t\t\t\t\t
fc-1\tflashcard\tu1-basics\tu1-checkpoint\t1\t\t\t\t\t\tdog\tหมา\t\t\tหมา\t\t
l2-1\tdragdrop\tu2-next-steps\tu2-pattern\t2\tpattern\tฉันกินข้าว\tPronoun,Verb,Object\tI,eat,rice\t\t\t\t\t\t\t\t
fb-1\tfillblank\tu2-next-steps\tu2-fill\t2\t\t\t\teat\t\t\t\tI ___ rice every day\teats\tฉันกินข้าว\t\t
mt-1\tmatching\tu2-next-steps\tu2-checkpoint\t1\t\t\t\t\t\t\t\t\t\t\tdog|หมา|หมา\tcat|แมว|แมว`;

const BOSSES = `id\tscope\tafterUnit\treviewsUnits\treviewCount\tpinnedItemIds\trewardPetDefId
gate-mid\tgated\tu1-basics\tu1-basics\t2\tl1-1\t
final-course\tfinal\t\tu1-basics,u2-next-steps\t3\tl2-1\t`;

function sheetFromTsv(tsv: string): XLSX.WorkSheet {
  const aoa = tsv.split('\n').map((line) => line.split('\t'));
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromTsv(COURSE), 'Course');
  XLSX.utils.book_append_sheet(wb, sheetFromTsv(UNITS), 'Units');
  XLSX.utils.book_append_sheet(wb, sheetFromTsv(ITEMS), 'Items');
  XLSX.utils.book_append_sheet(wb, sheetFromTsv(BOSSES), 'Bosses');
  return wb;
}

describe('authoring guides dry-run', () => {
  it('cold-AI emitted tables parse with no errors', () => {
    const { course, errors } = parseWorkbookToCourse(buildWorkbook());
    expect(errors).toEqual([]);
    expect(course).not.toBeNull();
  });

  it('parsed course passes validateCourse (incl. reward pet cross-ref)', () => {
    const { course } = parseWorkbookToCourse(buildWorkbook());
    expect(course).not.toBeNull();
    const res = validateCourse(course!, { petDefIds: new Set(['def-leaf']) });
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it('forms the expected lessons + checkpoints', () => {
    const { course } = parseWorkbookToCourse(buildWorkbook());
    const u1 = course!.units.find((u) => u.id === 'u1-basics')!;
    const u2 = course!.units.find((u) => u.id === 'u2-next-steps')!;
    expect(u1.lessons.map((l) => l.id)).toEqual(['u1-pattern', 'u1-wordchoice', 'u1-checkpoint']);
    expect(u1.lessons.at(-1)!.isCheckpoint).toBe(true);
    expect(u2.lessons.at(-1)!.id).toBe('u2-checkpoint');
    expect(u2.lessons.at(-1)!.isCheckpoint).toBe(true);
  });

  it('all four item kinds round-trip', () => {
    const { course } = parseWorkbookToCourse(buildWorkbook());
    const kinds = Object.values(course!.pool).map((i) => i.kind).sort();
    expect(kinds).toEqual(['dragdrop', 'dragdrop', 'dragdrop', 'fillblank', 'flashcard', 'matching']);
    const mt = course!.pool['mt-1'];
    expect(mt.kind === 'matching' && mt.pairs.length).toBe(2);
  });
});

// One new pet at a free (gen,dexNo); base omitted → builtin-identical stats.
const PETS = `id\tname\tgen\tdexNo\ttypes\telement\tenabled
def-sprig\tSprig\t2\t1\tleaf\tleaf\ttrue`;

function petsWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromTsv(PETS), 'Pets');
  return wb;
}

describe('pets authoring guide dry-run', () => {
  it('cold-AI Pets table imports + merges into a valid catalog', () => {
    const { entities, errors } = importPets(petsWorkbook());
    expect(errors).toEqual([]);
    const merged = mergeById([...BUILTIN_PET_DEFS], entities, (d) => d.id).merged;
    const res = validatePetDefs(merged);
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });
});

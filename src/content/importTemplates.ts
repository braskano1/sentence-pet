import * as XLSX from 'xlsx';

export type TemplateSurface = 'Course' | 'Units' | 'Items' | 'Bosses' | 'Pets';

interface TemplateSpec {
  columns: string[];    // header row, in order
  examples: string[][]; // valid example rows, cells in `columns` order
}

// Items header is the UNION of all per-kind columns; each row fills only its kind's cells.
const ITEM_COLUMNS = [
  'id', 'kind', 'unit', 'node', 'level', 'variant', 'thaiHint', 'slots', 'answer',
  'distractors', 'front', 'back', 'template', 'alternates', 'l1_th', 'pair1', 'pair2',
];

// One coherent mini course shared by the standalone Items/Units/Bosses templates AND the
// whole-course workbook. Units u1-basics / u2-next-steps; each unit's LAST node = checkpoint.
export const SURFACE_TEMPLATES: Record<TemplateSurface, TemplateSpec> = {
  Course: {
    columns: ['id', 'title', 'emoji', 'l1Ready'],
    examples: [['template-course', 'Template Course', '📘', 'false']],
  },
  Units: {
    columns: ['id', 'title', 'emoji', 'order', 'l1Enabled'],
    examples: [
      ['u1-basics', 'Basics', '🐣', '1', 'true'],
      ['u2-next-steps', 'Next Steps', '🌱', '2', 'false'],
    ],
  },
  Items: {
    columns: ITEM_COLUMNS,
    // Order matters: per unit, the checkpoint node must be the LAST node group to appear.
    examples: [
      ['it1', 'dragdrop', 'u1-basics', 'u1-pattern', '1', 'pattern', 'ฉันวิ่ง', 'Pronoun,Verb', 'I,run', '', '', '', '', '', '', '', ''],
      ['it2', 'flashcard', 'u1-basics', 'u1-words', '1', '', '', '', '', '', 'dog', 'หมา', '', '', 'หมา', '', ''],
      ['it3', 'fillblank', 'u1-basics', 'u1-words', '1', '', '', '', 'eat', '', '', '', 'I ___ rice every day', 'eats', 'ฉันกินข้าว', '', ''],
      ['it4', 'dragdrop', 'u1-basics', 'u1-checkpoint', '1', 'mixed', 'ฉันกินข้าว', 'Pronoun,Verb,Object', 'I,eat,rice', 'bread', '', '', '', '', '', '', ''],
      ['it5', 'matching', 'u2-next-steps', 'u2-pattern', '1', '', '', '', '', '', '', '', '', '', '', 'dog|หมา|หมา', 'cat|แมว|แมว'],
      ['it6', 'dragdrop', 'u2-next-steps', 'u2-checkpoint', '2', 'pattern', 'เธอเดิน', 'Pronoun,Verb', 'she,walks', '', '', '', '', '', '', '', ''],
    ],
  },
  Bosses: {
    columns: ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds', 'rewardPetDefId'],
    examples: [
      ['gate-1', 'gated', 'u1-basics', 'u1-basics', '2', 'it1', ''],
      ['final-1', 'final', '', 'u1-basics,u2-next-steps', '3', 'it4', ''],
    ],
  },
  Pets: {
    columns: [
      'id', 'name', 'gen', 'dexNo', 'types', 'element', 'base_min', 'base_max',
      'enabled', 'starter', 'rarity', 'gachaObtainable', 'evolvesFromId', 'evolvesToId', 'evolutionStage', 'spriteDefault',
    ],
    examples: [
      ['def-spark', 'Spark', '2', '1', 'fire', 'fire', '', '', 'true', '', '', '', '', 'def-blaze', '1', ''],
      ['def-blaze', 'Blaze', '2', '2', 'fire', 'fire', '50', '70', 'true', '', '', '', 'def-spark', '', '2', ''],
    ],
  },
};

/** Sheets composing the whole-course workbook (Pets intentionally excluded). */
export const COURSE_WORKBOOK_SURFACES: TemplateSurface[] = ['Course', 'Units', 'Items', 'Bosses'];

/** Build a workbook with one sheet per requested surface (header row + example rows). Pure. */
export function buildWorkbook(surfaces: TemplateSurface[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const surface of surfaces) {
    const spec = SURFACE_TEMPLATES[surface];
    const aoa = [spec.columns, ...spec.examples];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), surface);
  }
  return wb;
}

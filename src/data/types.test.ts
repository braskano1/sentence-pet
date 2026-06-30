import { describe, it, expect } from 'vitest';
import { isDragDrop, isFlashcard, isMatching, isFillBlank } from './types';
import type { ContentItem } from './types';

const dd: ContentItem = { id: 'd1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'แมว', slots: ['Subject'], answer: ['I'] };
const fc: ContentItem = { id: 'f1', kind: 'flashcard', level: 1, front: 'cat', back: 'แมว' };
const mt: ContentItem = { id: 'm1', kind: 'matching', level: 1, pairs: [{ left: 'cat', right: 'แมว' }, { left: 'dog', right: 'หมา' }] };
const fb: ContentItem = { id: 'b1', kind: 'fillblank', level: 1, template: 'I ___ rice', answer: 'eat' };

describe('content item type guards', () => {
  it('narrows by kind', () => {
    expect(isDragDrop(dd)).toBe(true);
    expect(isFlashcard(fc)).toBe(true);
    expect(isMatching(mt)).toBe(true);
    expect(isFillBlank(fb)).toBe(true);
    expect(isDragDrop(fc)).toBe(false);
    expect(isFlashcard(dd)).toBe(false);
  });
});

describe('DragDropItem slot labels + endPunct', () => {
  it('accepts the extended POS slot vocabulary and a question endPunct', () => {
    const q: ContentItem = {
      id: 'q1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'คุณชอบปลาไหม',
      slots: ['Helper', 'Subject', 'Verb', 'Object'],
      answer: ['do', 'you', 'like', 'fish'],
      endPunct: '?',
    };
    const stmt: ContentItem = {
      id: 's1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'เขาไม่สูง',
      slots: ['Subject', 'Be', 'Not', 'Adjective', 'Place', 'Question'],
      answer: ['he', 'is', 'not', 'tall', 'here', 'why'],
    };
    expect(isDragDrop(q)).toBe(true);
    if (q.kind === 'dragdrop') expect(q.endPunct).toBe('?');
    expect(isDragDrop(stmt)).toBe(true);
    if (stmt.kind === 'dragdrop') expect(stmt.endPunct).toBeUndefined();
  });
});

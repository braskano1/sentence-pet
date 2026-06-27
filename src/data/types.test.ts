import { describe, it, expect } from 'vitest';
import { isDragDrop, isFlashcard, isMatching, isFillBlank } from './types';
import type { ContentItem } from './types';

const dd: ContentItem = { id: 'd1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'แมว', slots: ['Pronoun'], answer: ['I'] };
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

import { describe, it, expect } from 'vitest';
import { itemLabel, itemSearchText } from './itemLabel';
import type {
  FlashcardItem, MatchingItem, DragDropItem, FillBlankItem,
} from '../../../data/types';

const flash: FlashcardItem = { id: 'f1', kind: 'flashcard', level: 1, front: 'hello', back: 'สวัสดี' };
const match: MatchingItem = { id: 'm1', kind: 'matching', level: 2, pairs: [{ left: 'cat', right: 'แมว' }] };
const drag: DragDropItem = { id: 'd1', kind: 'dragdrop', level: 1, drill: 'pattern', thaiHint: 'ฉันสั่ง', slots: ['Verb'], answer: ['I', 'order'] };
const fill: FillBlankItem = { id: 'fb1', kind: 'fillblank', level: 3, template: 'I ___ rice', answer: 'eat' };

describe('itemLabel', () => {
  it('uses front for flashcards', () => expect(itemLabel(flash)).toBe('hello'));
  it('uses the first pair for matching', () => expect(itemLabel(match)).toBe('cat → แมว'));
  it('joins the answer for dragdrop', () => expect(itemLabel(drag)).toBe('I order'));
  it('uses the template for fillblank', () => expect(itemLabel(fill)).toBe('I ___ rice'));
  it('falls back to id when content is empty', () =>
    expect(itemLabel({ id: 'x', kind: 'flashcard', level: 1, front: '', back: '' })).toBe('x'));
});

describe('itemSearchText', () => {
  it('includes label, id, kind and drill/kind meta, lowercased haystack', () => {
    const hay = itemSearchText(drag);
    expect(hay).toContain('i order');
    expect(hay).toContain('d1');
    expect(hay).toContain('dragdrop');
    expect(hay).toContain('pattern');
  });
});

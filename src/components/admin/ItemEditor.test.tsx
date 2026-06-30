import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemEditor } from './ItemEditor';
import type { ContentItem } from '../../data/types';

describe('ItemEditor by kind', () => {
  it('flashcard shows front/back inputs', () => {
    const item: ContentItem = { id: 'f1', kind: 'flashcard', level: 1, front: 'cat', back: 'แมว' };
    render(<ItemEditor item={item} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/front/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/back/i)).toBeInTheDocument();
  });
  it('dragdrop shows hidePos checkbox', () => {
    const item: ContentItem = { id: 'd1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'แมว', slots: ['Subject'], answer: ['I'] };
    render(<ItemEditor item={item} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/hidePos/i)).toBeInTheDocument();
  });
  it('fillblank shows template + answer', () => {
    const item: ContentItem = { id: 'b1', kind: 'fillblank', level: 1, template: 'I ___ rice', answer: 'eat' };
    render(<ItemEditor item={item} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/template/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/answer/i)).toBeInTheDocument();
  });
  it('switching kind resets to a minimal valid item of that kind', () => {
    const onChange = vi.fn();
    const item: ContentItem = { id: 'x1', kind: 'dragdrop', drill: 'pattern', level: 2, thaiHint: '', slots: [], answer: [] };
    render(<ItemEditor item={item} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/^kind/i), { target: { value: 'flashcard' } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.kind).toBe('flashcard');
    expect(next.id).toBe('x1');   // id preserved
    expect(next.front).toBe('');  // minimal valid flashcard
  });
});

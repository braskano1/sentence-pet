import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemEditor } from './ItemEditor';
import type { ContentItem } from '../../data/types';

// Stub the Storage-backed uploader; assert ItemEditor wires item.id + slot + setter into it.
vi.mock('./LessonImageUpload', () => ({
  LessonImageUpload: ({ label, itemId, slot, onUpload }: {
    label: string; itemId: string; slot: string; onUpload: (url: string) => void;
  }) => (
    <button type="button" aria-label={`${label} ${itemId} ${slot}`}
      onClick={() => onUpload(`https://uploaded/${slot}.png`)} />
  ),
}));

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

  it('edits a flashcard image URL and caption flag', () => {
    const onChange = vi.fn();
    const item = { id: 'fc1', kind: 'flashcard', level: 1, front: 'apple', back: 'แอปเปิล' } as const;
    render(<ItemEditor item={item as any} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('image (url)'), { target: { value: 'https://x/apple.png' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ image: 'https://x/apple.png' }));

    onChange.mockClear();
    // unchecking caption stores false
    fireEvent.click(screen.getByLabelText('image caption'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ imageCaption: false }));
  });

  it('edits a matching pair leftImage URL', () => {
    const onChange = vi.fn();
    const item = { id: 'm1', kind: 'matching', level: 1, pairs: [
      { left: 'apple', right: 'A' }, { left: 'ball', right: 'B' },
    ] } as const;
    render(<ItemEditor item={item as any} onChange={onChange} />);
    fireEvent.change(screen.getAllByLabelText('left image (url)')[0], { target: { value: 'https://x/apple.png' } });
    const arg = onChange.mock.calls.at(-1)![0];
    expect(arg.pairs[0].leftImage).toBe('https://x/apple.png');
  });

  it('wires the flashcard image uploader to item.id + slot "image", storing the returned url', () => {
    const onChange = vi.fn();
    const item = { id: 'c0u1-fc-1', kind: 'flashcard', level: 1, front: 'A', back: 'apple' } as const;
    render(<ItemEditor item={item as any} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'upload image c0u1-fc-1 image' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ image: 'https://uploaded/image.png' }));
  });

  it('wires the matching left/right uploaders to item.id + leftImage/rightImage slots', () => {
    const onChange = vi.fn();
    const item = { id: 'c0u1-mt-1', kind: 'matching', level: 1, pairs: [{ left: 'A', right: 'apple' }] } as const;
    render(<ItemEditor item={item as any} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'upload left image c0u1-mt-1 leftImage' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      pairs: [expect.objectContaining({ leftImage: 'https://uploaded/leftImage.png' })],
    }));
    fireEvent.click(screen.getByRole('button', { name: 'upload right image c0u1-mt-1 rightImage' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      pairs: [expect.objectContaining({ rightImage: 'https://uploaded/rightImage.png' })],
    }));
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PoolTab } from './PoolTab';
import type { ContentBundle } from '../../content/model';
import type { DrillItem } from '../../data/types';

const item = (id: string): DrillItem =>
  ({ id, drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

function bundle(): ContentBundle {
  return { pool: { a: item('a') }, units: [] };
}

describe('PoolTab', () => {
  it('lists pool items by id', () => {
    render(<PoolTab bundle={bundle()} onChange={() => {}} />);
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('adding a new item calls onChange with the item in the pool', () => {
    const onChange = vi.fn();
    render(<PoolTab bundle={bundle()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /new item/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as ContentBundle;
    expect(Object.keys(next.pool).length).toBe(2);
  });

  it('new-item id does not collide when item-1 and item-3 exist (post-delete gap)', () => {
    const onChange = vi.fn();
    const gappedBundle: ContentBundle = {
      pool: { 'item-1': item('item-1'), 'item-3': item('item-3') },
      units: [],
    };
    render(<PoolTab bundle={gappedBundle} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /new item/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as ContentBundle;
    const keys = Object.keys(next.pool);
    expect(keys.length).toBe(3);
    // The new id must not be 'item-3' (which would overwrite the existing entry)
    expect(next.pool['item-3'].id).toBe('item-3');
  });
});

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
});

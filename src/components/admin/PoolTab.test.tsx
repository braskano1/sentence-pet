import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PoolTab } from './PoolTab';
import type { Course } from '../../content/course';
import type { DrillItem } from '../../data/types';

const item = (id: string): DrillItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

function course(): Course {
  return { id: 'c', title: 'C', pool: { a: item('a') }, units: [], gates: [] };
}

describe('PoolTab', () => {
  it('lists pool items by id', () => {
    render(<PoolTab course={course()} onChange={() => {}} />);
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('adding a new item calls onChange with the item in the pool', () => {
    const onChange = vi.fn();
    render(<PoolTab course={course()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /new item/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as Course;
    expect(Object.keys(next.pool).length).toBe(2);
    // course-only fields must survive the pool edit
    expect(next.id).toBe('c');
    expect(next.gates).toEqual([]);
  });

  it('new-item id does not collide when item-1 and item-3 exist (post-delete gap)', () => {
    const onChange = vi.fn();
    const gappedCourse: Course = {
      id: 'c', title: 'C', gates: [],
      pool: { 'item-1': item('item-1'), 'item-3': item('item-3') },
      units: [],
    };
    render(<PoolTab course={gappedCourse} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /new item/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as Course;
    const keys = Object.keys(next.pool);
    expect(keys.length).toBe(3);
    // The new id must not be 'item-3' (which would overwrite the existing entry)
    expect(next.pool['item-3'].id).toBe('item-3');
  });
});

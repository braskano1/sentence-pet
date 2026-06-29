import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PoolTab } from './PoolTab';
import type { Course } from '../../content/course';
import type { DrillItem } from '../../data/types';

const item = (id: string): DrillItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

function course(): Course {
  return {
    id: 'c', title: 'C', pool: { a: item('a') }, units: [], gates: [],
    finalBoss: { id: 'fb', title: 'F', scope: 'final', reviewsUnitIds: ['u1'], reviewCount: 3,
      boss: { tierId: 't', element: 'leaf', name: 'F', rivalSprite: { species: 'leaf', stage: 'adult' } }, onClear: 'completeCourse' },
  };
}

describe('PoolTab', () => {
  it('lists pool items by their content label', () => {
    render(<PoolTab course={course()} onChange={() => {}} />);
    // item 'a' is a dragdrop with answer ['I','run'] -> label "I run"
    expect(screen.getByText('I run')).toBeInTheDocument();
    // id is still visible (in the meta line)
    expect(screen.getByText(/\ba\b/)).toBeInTheDocument();
  });

  it('filters the list by search query', () => {
    const c = course();
    c.pool = {
      a: item('a'),
      b: { id: 'b', kind: 'flashcard', level: 1, front: 'hello', back: 'hi' },
    };
    render(<PoolTab course={c} onChange={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'hello' } });
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.queryByText('I run')).not.toBeInTheDocument();
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
    expect(next.finalBoss?.id).toBe('fb');
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

describe('PoolTab import wiring', () => {
  it('opens the drawer and merges imported items additively', async () => {
    const onChange = vi.fn();
    const course = {
      id: 'c1', title: 'C1', pool: {
        'item-1': { id: 'item-1', kind: 'flashcard', level: 1, front: 'a', back: 'b' },
      }, units: [], gates: [],
    } as unknown as import('../../content/course').Course;
    const parseItemsFile = async () => ({
      entities: [{ id: 'item-2', kind: 'flashcard', level: 1, front: 'c', back: 'd' }] as import('../../data/types').ContentItem[],
      errors: [],
    });
    render(<PoolTab course={course} onChange={onChange} parseItemsFile={parseItemsFile} />);
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText(/choose a file/i), { target: { files: [new File([''], 'x.xlsx')] } });
    fireEvent.click(await screen.findByRole('button', { name: /apply 1 change/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as import('../../content/course').Course;
    expect(Object.keys(next.pool).sort()).toEqual(['item-1', 'item-2']);
  });
});

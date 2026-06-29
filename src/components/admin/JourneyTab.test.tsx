import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JourneyTab, eligibleItemIds } from './JourneyTab';
import type { Course } from '../../content/course';
import type { ContentItem, DrillItem } from '../../data/types';

const item = (id: string): DrillItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

function course(): Course {
  return {
    id: 'c', title: 'C', gates: [],
    pool: { a: item('a'), b: item('b') },
    units: [{ id: 'u1', title: 'One', emoji: '🐣', order: 1, lessons: [
      { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
      { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['a'], isCheckpoint: true },
    ]}],
  };
}

describe('eligibleItemIds', () => {
  const pool: Record<string, ContentItem> = {
    d1: { id: 'd1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: '', slots: [], answer: [] },
    f1: { id: 'f1', kind: 'flashcard', level: 1, front: 'a', back: 'b' },
    f2: { id: 'f2', kind: 'flashcard', level: 1, front: 'c', back: 'd' },
  };
  it('filters pool to the node kind', () => {
    expect(eligibleItemIds(pool, 'flashcard').sort()).toEqual(['f1', 'f2']);
    expect(eligibleItemIds(pool, 'dragdrop')).toEqual(['d1']);
  });
});

describe('JourneyTab', () => {
  it('renders units and their lessons', () => {
    render(<JourneyTab course={course()} onChange={() => {}} />);
    expect(screen.getByDisplayValue('One')).toBeInTheDocument();
    expect(screen.getByText('u1-l1')).toBeInTheDocument();
  });

  it('toggling an item id in the selected lesson calls onChange', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={course()} onChange={onChange} />);
    fireEvent.click(screen.getByText('u1-l1'));
    fireEvent.click(screen.getByRole('checkbox', { name: /item b/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as Course;
    expect(next.units[0].lessons[0].itemIds).toContain('b');
    // course-only fields must survive the units edit
    expect(next.id).toBe('c');
    expect(next.gates).toEqual([]);
  });

  it('changing the lesson kind writes lesson.kind', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={course()} onChange={onChange} />);
    fireEvent.click(screen.getByText('u1-l1'));
    fireEvent.change(screen.getByLabelText(/kind/i), { target: { value: 'flashcard' } });
    const next = onChange.mock.calls.at(-1)![0] as Course;
    expect(next.units[0].lessons[0].kind).toBe('flashcard');
  });

  it('changing the lesson kind prunes itemIds of the old kind', () => {
    const onChange = vi.fn();
    const c: Course = {
      id: 'c', title: 'C', gates: [],
      pool: {
        d1: { id: 'd1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: '', slots: [], answer: [] },
        f1: { id: 'f1', kind: 'flashcard', level: 1, front: 'a', back: 'b' },
      },
      units: [{ id: 'u1', title: 'One', emoji: '🐣', order: 1, lessons: [
        { id: 'u1-l1', drill: 'pattern', level: 1, kind: 'dragdrop', itemIds: ['d1'] },
      ]}],
    };
    render(<JourneyTab course={c} onChange={onChange} />);
    fireEvent.click(screen.getByText('u1-l1'));
    fireEvent.change(screen.getByLabelText(/kind/i), { target: { value: 'flashcard' } });
    const next = onChange.mock.calls.at(-1)![0] as Course;
    expect(next.units[0].lessons[0].kind).toBe('flashcard');
    expect(next.units[0].lessons[0].itemIds).not.toContain('d1');
  });

  it('toggling unit l1Enabled writes unit.l1Enabled', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={course()} onChange={onChange} />);
    fireEvent.click(screen.getByText('u1-l1'));
    fireEvent.click(screen.getByRole('checkbox', { name: /l1 enabled/i }));
    const next = onChange.mock.calls.at(-1)![0] as Course;
    expect(next.units[0].l1Enabled).toBe(true);
  });
});

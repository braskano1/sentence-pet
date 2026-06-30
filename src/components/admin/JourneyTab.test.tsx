import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JourneyTab, eligibleItemIds } from './JourneyTab';
import type { Course } from '../../content/course';
import type { ContentItem, DrillItem } from '../../data/types';

const item = (id: string): DrillItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Subject', 'Verb'], answer: ['I', 'run'] });

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
    expect(screen.getByRole('button', { name: /One/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'u1-l1' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /One/ }));      // select the unit
    fireEvent.click(screen.getByRole('checkbox', { name: /l1 enabled/i }));
    const next = onChange.mock.calls.at(-1)![0] as Course;
    expect(next.units[0].l1Enabled).toBe(true);
  });
});

describe('JourneyTab unit/lesson mutations', () => {
  const base = () => ({
    id: 'c1', title: 'C1', pool: {},
    units: [{ id: 'u1', title: 'U1', emoji: '📘', order: 1, lessons: [
      { id: 'u1-l1', kind: 'dragdrop', drill: 'pattern', level: 1, itemIds: [] },
    ] }],
    gates: [],
  } as unknown as import('../../content/course').Course);

  it('adds a unit to course.units', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={base()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ unit/i }));
    const next = onChange.mock.calls.at(-1)![0] as import('../../content/course').Course;
    expect(next.units.length).toBe(2);
  });

  it('deletes the selected unit', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={base()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /U1/ }));        // select the unit header
    fireEvent.click(screen.getByRole('button', { name: /delete unit/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    const next = onChange.mock.calls.at(-1)![0] as import('../../content/course').Course;
    expect(next.units.length).toBe(0);
  });

  it('adds a lesson to the selected unit', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={base()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add lesson/i }));
    const next = onChange.mock.calls.at(-1)![0] as import('../../content/course').Course;
    expect(next.units[0].lessons.length).toBe(2);
  });

  it('deletes the selected lesson', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={base()} onChange={onChange} />);
    // first lesson is selected by default; open its delete confirm
    fireEvent.click(screen.getByRole('button', { name: /delete lesson/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    const next = onChange.mock.calls.at(-1)![0] as import('../../content/course').Course;
    expect(next.units[0].lessons.length).toBe(0);
  });
});

describe('JourneyTab import wiring', () => {
  it('merges imported units additively', async () => {
    const onChange = vi.fn();
    const course = {
      id: 'c1', title: 'C1', pool: {},
      units: [{ id: 'u1', title: 'U1', emoji: '', order: 1, lessons: [] }],
      gates: [],
    } as unknown as import('../../content/course').Course;
    const parseUnitsFile = async () => ({
      entities: [{ id: 'u2', title: 'U2', emoji: '', order: 2, lessons: [] }] as import('../../content/model').Unit[],
      errors: [],
    });
    render(<JourneyTab course={course} onChange={onChange} parseUnitsFile={parseUnitsFile} />);
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText(/choose a file/i), { target: { files: [new File([''], 'x.xlsx')] } });
    fireEvent.click(await screen.findByRole('button', { name: /apply 1 change/i }));
    const next = onChange.mock.calls[0][0] as import('../../content/course').Course;
    expect(next.units.map((u) => u.id)).toEqual(['u1', 'u2']);
  });

  it('preserves existing lessons when an imported unit carries none', async () => {
    const onChange = vi.fn();
    const course = {
      id: 'c1', title: 'C1', pool: {},
      units: [{ id: 'u1', title: 'U1', emoji: '📘', order: 1, lessons: [
        { id: 'u1-l1', kind: 'dragdrop', drill: 'pattern', level: 1, itemIds: [] },
      ] }],
      gates: [],
    } as unknown as import('../../content/course').Course;
    const parseUnitsFile = async () => ({
      entities: [
        { id: 'u1', title: 'U1 renamed', emoji: '📗', order: 1, lessons: [] }, // meta update, no lessons
        { id: 'u2', title: 'U2', emoji: '', order: 2, lessons: [] },           // genuinely new
      ] as import('../../content/model').Unit[],
      errors: [],
    });
    render(<JourneyTab course={course} onChange={onChange} parseUnitsFile={parseUnitsFile} />);
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText(/choose a file/i), { target: { files: [new File([''], 'x.xlsx')] } });
    fireEvent.click(await screen.findByRole('button', { name: /apply/i }));  // some changes
    const next = onChange.mock.calls[0][0] as import('../../content/course').Course;
    const u1 = next.units.find((u) => u.id === 'u1')!;
    expect(u1.title).toBe('U1 renamed');     // meta updated
    expect(u1.lessons.map((l: { id: string }) => l.id)).toEqual(['u1-l1']); // lessons PRESERVED, not wiped
    expect(next.units.map((u) => u.id)).toEqual(['u1', 'u2']);              // new unit added
  });
});

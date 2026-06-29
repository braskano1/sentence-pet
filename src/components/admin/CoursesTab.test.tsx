import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoursesTab } from './CoursesTab';
import type { Course, CourseIndexEntry } from '../../content/course';

const COURSE: Course = {
  id: 'thai', title: 'Survival Thai', emoji: '🇹🇭',
  pool: { a: {} as never },
  units: [{ id: 'u1', title: 'U1', emoji: '🐣', order: 1, l1Enabled: false,
    lessons: [{ id: 'l1', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['a'] }] }],
  gates: [],
  finalBoss: undefined,
};
const INDEX: CourseIndexEntry[] = [
  { id: 'thai', title: 'Survival Thai', emoji: '🇹🇭' },
  { id: 'money', title: 'Market & Money', emoji: '💰' },
];

function setup(over: Partial<React.ComponentProps<typeof CoursesTab>> = {}) {
  const props = {
    course: COURSE, onChange: vi.fn(), index: INDEX,
    onCreate: vi.fn(), onDelete: vi.fn(), onSwitch: vi.fn(), onImport: vi.fn(),
    ...over,
  };
  render(<CoursesTab {...props} />);
  return props;
}

describe('CoursesTab', () => {
  it('lists courses and badges the active one', () => {
    setup();
    expect(screen.getByText('Survival Thai')).toBeInTheDocument();
    expect(screen.getByText('Market & Money')).toBeInTheDocument();
    expect(screen.getByText(/editing/i)).toBeInTheDocument();
  });

  it('shows the active course meta with a read-only id and the contents counts', () => {
    setup();
    expect(screen.getByLabelText(/title/i)).toHaveValue('Survival Thai');
    expect(screen.getByLabelText(/course id/i)).toHaveAttribute('readonly');
    expect(screen.getByText(/units/i)).toBeInTheDocument();
  });

  it('edits the title through onChange', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Survival Thai 2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'Survival Thai 2' }));
  });

  it('clicking a non-active course switches to it', () => {
    const { onSwitch } = setup();
    fireEvent.click(screen.getByText('Market & Money'));
    expect(onSwitch).toHaveBeenCalledWith('money');
  });

  it('delete requires confirmation then calls onDelete', () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByRole('button', { name: /delete course/i }));
    // confirm step
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(onDelete).toHaveBeenCalledWith('thai');
  });

  it('+ New course prompts for a title and calls onCreate', () => {
    const { onCreate } = setup();
    fireEvent.click(screen.getByRole('button', { name: /new course/i }));
    fireEvent.change(screen.getByLabelText(/new course title/i), { target: { value: 'Fresh' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(onCreate).toHaveBeenCalledWith({ title: 'Fresh' });
  });
});

describe('CoursesTab import errors', () => {
  it('shows an error when the whole-course file fails to read', async () => {
    const course = { id: 'c1', title: 'C1', emoji: '', pool: {}, units: [], gates: [] } as unknown as import('../../content/course').Course;
    render(
      <CoursesTab
        course={course}
        onChange={() => {}}
        index={[{ id: 'c1', title: 'C1' }]}
        onCreate={() => {}}
        onDelete={() => {}}
        onSwitch={() => {}}
        onImport={() => {}}
        readWorkbook={async () => { throw new Error('not an xlsx'); }}
      />,
    );
    fireEvent.change(screen.getByLabelText(/new from file/i), { target: { files: [new File([''], 'bad.xlsx')] } });
    await screen.findByText(/could not read file/i);
  });
});

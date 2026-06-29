import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Course } from '../../content/course';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { email: 'a@b.c', uid: 'admin1' }, signOut: vi.fn() }),
}));
const saveCourse = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/content', () => ({
  saveCourse: (c: unknown) => saveCourse(c),
  fetchCourse: vi.fn(),
}));

/** A valid Course that passes validateCourse (1 unit, 1 checkpoint dragdrop lesson, finalBoss). */
const IMPORTED_COURSE: Course = {
  id: 'imported-1',
  title: 'Imported',
  pool: {
    'i1': { id: 'i1', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] },
  },
  units: [
    { id: 'u1', title: 'Unit 1', emoji: '🐣', order: 1, l1Enabled: false,
      lessons: [{ id: 'u1-cp', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['i1'], isCheckpoint: true }] },
  ],
  gates: [],
  finalBoss: { id: 'fb', title: 'Final', scope: 'final', reviewsUnitIds: ['u1'], reviewCount: 3,
    boss: { tierId: 't', element: 'leaf', name: 'F', rivalSprite: { species: 'leaf', stage: 'adult' } },
    onClear: 'completeCourse' },
};

vi.mock('../../content/excelImport', () => ({
  parseWorkbookToCourse: () => ({ course: IMPORTED_COURSE, errors: [] }),
}));

import { AdminShell } from './AdminShell';
import { useContentStore } from '../../content/store';
import { SEED } from '../../content/seed';
import { bundleToDefaultCourse } from '../../content/migrate';

beforeEach(() => {
  saveCourse.mockClear();
  const course = bundleToDefaultCourse(SEED);
  useContentStore.setState({ course, activeCourseId: 'default', bundle: { pool: course.pool, units: course.units }, status: 'fallback' });
});

describe('AdminShell', () => {
  it('shows the signed-in admin email', () => {
    render(<AdminShell />);
    expect(screen.getByText(/a@b\.c/)).toBeInTheDocument();
  });

  it('shows Pool and Journey tabs and switches to Journey', () => {
    render(<AdminShell />);
    expect(screen.getByRole('tab', { name: /^pool$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^journey$/i }));
    // SEED's first lesson id is u1-pattern — it appears in the Journey tab
    expect(screen.getAllByText(/u1-pattern/i).length).toBeGreaterThan(0);
  });

  it('Save calls saveCourse with the draft course when valid', async () => {
    render(<AdminShell />);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(saveCourse).toHaveBeenCalled());
  });

  it('validation gate: Save is disabled and banner shows errors when draft is invalid', () => {
    // Set an invalid course (no units → validation fails) BEFORE render so the
    // draft seeded at mount is already invalid.
    const course = { ...bundleToDefaultCourse(SEED), units: [], finalBoss: undefined };
    useContentStore.setState({ course, bundle: { pool: course.pool, units: [] }, status: 'fallback' });
    render(<AdminShell />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    // The validation banner should list at least one error.
    expect(screen.getByText(/journey has no units/i)).toBeInTheDocument();
  });

  it('saveCourse rejection leaves live store unchanged and surfaces error text', async () => {
    saveCourse.mockRejectedValueOnce(new Error('boom'));
    const courseBefore = useContentStore.getState().course;
    render(<AdminShell />);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    // Wait for the async save to settle and error text to appear.
    await screen.findByText(/save failed/i);
    // The live store course must be the same reference — no partial update.
    expect(useContentStore.getState().course).toBe(courseBefore);
  });

  it('Import tab commit calls saveCourse and updates the live store course id', async () => {
    // Stub File.prototype.arrayBuffer so defaultReadWorkbook does not throw in jsdom
    // (parseWorkbookToCourse is mocked so the buffer content is irrelevant).
    Object.defineProperty(File.prototype, 'arrayBuffer', {
      value: async () => new ArrayBuffer(0),
      configurable: true,
    });

    render(<AdminShell />);
    fireEvent.click(screen.getByRole('tab', { name: /^import$/i }));

    const fileInput = screen.getByLabelText(/excel file/i);
    fireEvent.change(fileInput, { target: { files: [new File([''], 'c.xlsx')] } });

    // Wait for the Commit button to become enabled (validateCourse passes on IMPORTED_COURSE).
    const commitBtn = await screen.findByRole('button', { name: /commit/i });
    await waitFor(() => expect(commitBtn).not.toBeDisabled());
    fireEvent.click(commitBtn);

    await waitFor(() => expect(saveCourse).toHaveBeenCalled());
    expect(useContentStore.getState().course!.id).toBe('imported-1');
  });

  it('renders the tabs inside an accessible tablist', () => {
    render(<AdminShell />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^pets$/i })).toBeInTheDocument();
  });
});

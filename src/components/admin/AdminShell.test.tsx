import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { email: 'a@b.c', uid: 'admin1' }, signOut: vi.fn() }),
}));
const saveCourse = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/content', () => ({
  saveCourse: (c: unknown) => saveCourse(c),
  fetchCourse: vi.fn(),
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
    expect(screen.getByRole('button', { name: /^pool$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^journey$/i }));
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
});

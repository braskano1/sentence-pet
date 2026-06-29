import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseSwitcher } from './CourseSwitcher';
import type { CourseIndexEntry } from '../../../content/course';

const COURSES: CourseIndexEntry[] = [
  { id: 'thai', title: 'Survival Thai', emoji: '🇹🇭' },
  { id: 'money', title: 'Market & Money', emoji: '💰' },
];

describe('CourseSwitcher', () => {
  it('shows the active course on the trigger', () => {
    render(<CourseSwitcher courses={COURSES} activeId="thai" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /survival thai/i })).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('opens the listbox and selects a course', () => {
    const onSelect = vi.fn();
    render(<CourseSwitcher courses={COURSES} activeId="thai" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /survival thai/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /market & money/i }));
    expect(onSelect).toHaveBeenCalledWith('money');
    // closes after selection
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on Escape without selecting', () => {
    const onSelect = vi.fn();
    render(<CourseSwitcher courses={COURSES} activeId="thai" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /survival thai/i }));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

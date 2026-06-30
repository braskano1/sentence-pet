import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LessonShell } from './LessonShell';
import { useGameStore } from '../../state/gameStore';

describe('LessonShell', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders the title and one progress node per item', () => {
    render(
      <LessonShell title="Flip the cards" index={0} total={4}>
        <p>body</p>
      </LessonShell>,
    );
    expect(screen.getByText('Flip the cards')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^track-node-/)).toHaveLength(4);
  });

  it('exit ✕ opens a confirm; Leave returns to the lesson picker', () => {
    render(
      <LessonShell title="Match the pairs" index={0} total={2}>
        <p>body</p>
      </LessonShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /leave lesson/i }));
    expect(screen.getByRole('dialog', { name: /leave lesson\?/i })).toBeInTheDocument();
    expect(screen.getByText(/won't be saved/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^leave$/i }));
    expect(useGameStore.getState().screen).toBe('pickDrill');
  });

  it('Stay dismisses the confirm without leaving', () => {
    render(
      <LessonShell title="Fill the blank" index={0} total={2}>
        <p>body</p>
      </LessonShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /leave lesson/i }));
    fireEvent.click(screen.getByRole('button', { name: /stay/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useGameStore.getState().screen).not.toBe('pickDrill');
  });

  it('Escape opens the same confirm (a11y)', () => {
    render(
      <LessonShell title="Build the sentence" index={0} total={3}>
        <p>body</p>
      </LessonShell>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: /leave lesson\?/i })).toBeInTheDocument();
  });

  it('hides the streak chip when streak is undefined, shows it otherwise', () => {
    const { rerender } = render(
      <LessonShell title="x" index={0} total={2}>
        <p>body</p>
      </LessonShell>,
    );
    expect(screen.queryByTestId('streak')).not.toBeInTheDocument();
    rerender(
      <LessonShell title="x" index={0} total={2} streak={3}>
        <p>body</p>
      </LessonShell>,
    );
    expect(screen.getByTestId('streak')).toHaveTextContent('3');
  });

  it('renders the L1 toggle only when l1 is true', () => {
    const { rerender } = render(
      <LessonShell title="x" index={0} total={2}>
        <p>body</p>
      </LessonShell>,
    );
    expect(screen.queryByRole('group', { name: /language helper/i })).not.toBeInTheDocument();
    rerender(
      <LessonShell title="x" index={0} total={2} l1>
        <p>body</p>
      </LessonShell>,
    );
    expect(screen.getByRole('group', { name: /language helper/i })).toBeInTheDocument();
  });
});

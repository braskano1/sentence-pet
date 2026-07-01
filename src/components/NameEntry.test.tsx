import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGameStore } from '../state/gameStore';
import { NameEntry } from './NameEntry';

beforeEach(() => useGameStore.getState().resetForTest());

describe('NameEntry', () => {
  it('disables confirm until the name is valid', () => {
    render(<NameEntry />);
    const btn = screen.getByRole('button', { name: /that's me|confirm|start/i });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A' } });
    expect(btn).toBeDisabled(); // too short
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ava' } });
    expect(btn).not.toBeDisabled();
  });

  it('confirming stores the sanitized name and goes to petRoom', () => {
    render(<NameEntry />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Ava Lee  ' } });
    fireEvent.click(screen.getByRole('button', { name: /that's me|confirm|start/i }));
    expect(useGameStore.getState().displayName).toBe('Ava Lee');
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('shows a friendly hint when the name has disallowed characters', () => {
    render(<NameEntry />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ava123' } });
    expect(screen.getByText(/letters/i)).toBeInTheDocument();
  });
});

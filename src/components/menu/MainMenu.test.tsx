import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ linkEmail: vi.fn().mockResolvedValue(undefined), signIn: vi.fn().mockResolvedValue(undefined) }),
}));

import { MainMenu } from './MainMenu';

function openChoose() {
  render(<MainMenu onSignedUp={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /tap to start/i }));
}

describe('MainMenu', () => {
  it('tapping the title reveals New Game and Continue', () => {
    openChoose();
    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('New Game opens the sign-up form', () => {
    openChoose();
    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create & play/i })).toBeInTheDocument();
  });

  it('Continue opens the sign-in form', () => {
    openChoose();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('Back returns from a form to the choose screen', () => {
    openChoose();
    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
  });
});

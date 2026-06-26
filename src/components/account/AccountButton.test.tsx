import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let authValue: { isAnonymous: boolean; user: { email: string | null } | null; signOut: () => void; linkEmail: () => Promise<void> };
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authValue }));

import { AccountButton } from './AccountButton';

describe('AccountButton', () => {
  it('guest sees a Save-your-pets entry that opens the signup form', () => {
    authValue = { isAnonymous: true, user: { email: null }, signOut: vi.fn(), linkEmail: vi.fn() };
    render(<AccountButton />);
    const open = screen.getByRole('button', { name: /save your pets/i });
    fireEvent.click(open);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('signed-in student sees their email and a sign-out button', () => {
    const signOut = vi.fn();
    authValue = { isAnonymous: false, user: { email: 'k@s.th' }, signOut, linkEmail: vi.fn() };
    render(<AccountButton />);
    expect(screen.getByText(/k@s\.th/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });
});

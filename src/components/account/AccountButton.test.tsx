import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let authValue: { isAnonymous: boolean; user: { email: string | null } | null; loading: boolean; signOut: () => void };
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authValue }));

import { AccountButton } from './AccountButton';

describe('AccountButton', () => {
  it('signed-in student sees their email and a sign-out button', () => {
    const signOut = vi.fn();
    authValue = { isAnonymous: false, user: { email: 'k@s.th' }, loading: false, signOut };
    render(<AccountButton />);
    expect(screen.getByText(/k@s\.th/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it('anonymous guest renders nothing (menu owns sign-up)', () => {
    authValue = { isAnonymous: true, user: null, loading: false, signOut: vi.fn() };
    const { container } = render(<AccountButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while auth is loading', () => {
    authValue = { isAnonymous: false, user: null, loading: true, signOut: vi.fn() };
    const { container } = render(<AccountButton />);
    expect(container).toBeEmptyDOMElement();
  });
});

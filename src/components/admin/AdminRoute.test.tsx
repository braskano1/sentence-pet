import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const signOut = vi.fn();
let authState: Record<string, unknown>;
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authState }));

import { AdminRoute } from './AdminRoute';

describe('AdminRoute — not authorized', () => {
  it('shows a Sign out button for a signed-in non-admin and calls signOut', () => {
    signOut.mockClear();
    authState = { user: { email: 'x@y.z' }, isAdmin: false, loading: false, signIn: vi.fn(), signOut };
    render(<AdminRoute><div>secret</div></AdminRoute>);
    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });
});

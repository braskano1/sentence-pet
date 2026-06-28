import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthState } from '../../auth/AuthProvider';

const mockAuth = vi.fn<() => AuthState>();
vi.mock('../../auth/useAuth', () => ({ useAuth: () => mockAuth() }));

import { AdminRoute } from './AdminRoute';

function state(over: Partial<AuthState>): AuthState {
  return {
    user: null,
    isAdmin: false,
    loading: false,
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...over,
  } as AuthState;
}

describe('AdminRoute', () => {
  it('shows a spinner while loading', () => {
    mockAuth.mockReturnValue(state({ loading: true }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('shows the login form when signed out', () => {
    mockAuth.mockReturnValue(state({ user: null }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('calls signIn with entered credentials', async () => {
    const signIn = vi.fn(async () => {});
    mockAuth.mockReturnValue(state({ user: null, signIn }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'pw1234');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(signIn).toHaveBeenCalledWith('a@b.com', 'pw1234');
  });

  it('dev admin button signs in with the seeded dev credentials', async () => {
    const signIn = vi.fn(async () => {});
    mockAuth.mockReturnValue(state({ user: null, signIn }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    await userEvent.click(screen.getByRole('button', { name: /dev admin sign-in/i }));
    expect(signIn).toHaveBeenCalledWith('admin@test.dev', 'test1234');
  });

  it('denies a signed-in non-admin', () => {
    mockAuth.mockReturnValue(state({ user: { uid: 'u1' } as never, isAdmin: false }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    expect(screen.getByRole('alert')).toHaveTextContent(/not authorized/i);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('offers a Sign out escape to a signed-in non-admin', async () => {
    const signOut = vi.fn(async () => {});
    mockAuth.mockReturnValue(state({ user: { uid: 'u1' } as never, isAdmin: false, signOut }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it('renders children for an admin', () => {
    mockAuth.mockReturnValue(state({ user: { uid: 'u1' } as never, isAdmin: true }));
    render(<AdminRoute><div>secret</div></AdminRoute>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});

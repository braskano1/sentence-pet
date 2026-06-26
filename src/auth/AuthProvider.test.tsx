import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';

// Controls what the mocked onAuthChange emits.
let emit: (u: User | null) => void = () => {};

vi.mock('../firebase/auth', () => ({
  onAuthChange: (cb: (u: User | null) => void) => {
    emit = cb;
    return () => {};
  },
  signIn: vi.fn(),
  signOutUser: vi.fn(),
}));

import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

function Probe() {
  const { user, isAdmin, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
    </div>
  );
}

function fakeUser(admin: boolean): User {
  return {
    uid: 'u1',
    email: 'a@b.com',
    getIdTokenResult: async () => ({ claims: { admin } }),
  } as unknown as User;
}

describe('AuthProvider', () => {
  beforeEach(() => { emit = () => {}; });

  it('starts loading then resolves to signed-out', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    emit(null);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('email')).toHaveTextContent('none');
    expect(screen.getByTestId('admin')).toHaveTextContent('false');
  });

  it('exposes isAdmin from the ID-token claim', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    emit(fakeUser(true));
    await waitFor(() => expect(screen.getByTestId('admin')).toHaveTextContent('true'));
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com');
  });

  it('useAuth throws outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/within AuthProvider/);
    spy.mockRestore();
  });
});

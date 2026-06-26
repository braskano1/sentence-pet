import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';

// Controls what the mocked onAuthChange emits.
let emit: (u: User | null) => void = () => {};

const h = vi.hoisted(() => {
  const authObj: { currentUser: { uid: string } | null } = { currentUser: null };
  return {
    authObj,
    signInAnon: vi.fn().mockResolvedValue({}),
    linkEmailPassword: vi.fn().mockResolvedValue({}),
    signIn: vi.fn(async () => { authObj.currentUser = { uid: 'acct1' }; return { user: { uid: 'acct1' } }; }),
    reconcileFromCloud: vi.fn().mockResolvedValue(true),
    startCloudSync: vi.fn(() => () => {}),
  };
});

vi.mock('../firebase/auth', () => ({
  auth: h.authObj,
  onAuthChange: (cb: (u: User | null) => void) => { emit = cb; return () => {}; },
  signIn: h.signIn,
  signInAnon: h.signInAnon,
  linkEmailPassword: h.linkEmailPassword,
  signOutUser: vi.fn(),
}));
vi.mock('../sync/reconcile', () => ({ reconcileFromCloud: h.reconcileFromCloud }));
vi.mock('../sync/cloudSync', () => ({ startCloudSync: h.startCloudSync }));
vi.mock('../firebase/users', () => ({ loadCloudSave: vi.fn(), saveProfile: vi.fn(), savePet: vi.fn() }));

import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

function Probe() {
  const { user, isAdmin, isAnonymous, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="anon">{String(isAnonymous)}</span>
    </div>
  );
}

function fakeUser(admin: boolean, anonymous = false): User {
  return {
    uid: 'u1', email: anonymous ? null : 'a@b.com', isAnonymous: anonymous,
    getIdTokenResult: async () => ({ claims: { admin } }),
  } as unknown as User;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    emit = () => {};
    h.signInAnon.mockClear();
    h.signIn.mockClear();
    h.reconcileFromCloud.mockClear();
    h.startCloudSync.mockClear();
    h.authObj.currentUser = null;
  });

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

  it('player mode bootstraps an anonymous session when signed out', async () => {
    render(<AuthProvider player><Probe /></AuthProvider>);
    emit(null);
    await waitFor(() => expect(h.signInAnon).toHaveBeenCalledOnce());
  });

  it('non-player mode does NOT bootstrap anon (admin tree stays sign-in-only)', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    emit(null);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(h.signInAnon).not.toHaveBeenCalled();
  });

  it('exposes isAnonymous from the user', async () => {
    render(<AuthProvider player><Probe /></AuthProvider>);
    emit(fakeUser(false, true));
    await waitFor(() => expect(screen.getByTestId('anon')).toHaveTextContent('true'));
  });

  it('signing in reconciles from cloud for the signed-in uid (cloud wins)', async () => {
    function SignInProbe() {
      const { signIn } = useAuth();
      return <button onClick={() => void signIn('k@s.th', 'pw123456')}>go</button>;
    }
    render(<AuthProvider player><SignInProbe /></AuthProvider>);
    emit(fakeUser(false, true));
    await waitFor(() => expect(screen.getByText('go')).toBeInTheDocument());
    fireEvent.click(screen.getByText('go'));
    await waitFor(() =>
      expect(h.reconcileFromCloud).toHaveBeenCalledWith(expect.objectContaining({ uid: 'acct1' })),
    );
    expect(h.reconcileFromCloud).toHaveBeenCalledTimes(1);
  });
});

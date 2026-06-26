import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthState } from '../../auth/AuthProvider';

const mockAuth = vi.fn<() => AuthState>();
vi.mock('../../auth/useAuth', () => ({ useAuth: () => mockAuth() }));

const writePing = vi.fn(async (_uid: string) => {});
const readPing = vi.fn(async (_uid: string) => ({ at: 123 }));
vi.mock('../../firebase/ping', () => ({
  writePing: (uid: string) => writePing(uid),
  readPing: (uid: string) => readPing(uid),
}));

import { AdminShell } from './AdminShell';

function adminState(): AuthState {
  return {
    user: { uid: 'u1', email: 'a@b.com' } as never,
    isAdmin: true,
    loading: false,
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  } as AuthState;
}

describe('AdminShell', () => {
  it('shows the signed-in admin email', () => {
    mockAuth.mockReturnValue(adminState());
    render(<AdminShell />);
    expect(screen.getByText(/a@b\.com/)).toBeInTheDocument();
    expect(screen.getByText(/admin/i)).toBeInTheDocument();
  });

  it('round-trips a ping on click', async () => {
    mockAuth.mockReturnValue(adminState());
    render(<AdminShell />);
    await userEvent.click(screen.getByRole('button', { name: /ping/i }));
    expect(writePing).toHaveBeenCalledWith('u1');
    expect(readPing).toHaveBeenCalledWith('u1');
    expect(await screen.findByText(/ping ok/i)).toBeInTheDocument();
  });

  it('calls signOut', async () => {
    const s = adminState();
    mockAuth.mockReturnValue(s);
    render(<AdminShell />);
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(s.signOut).toHaveBeenCalled();
  });
});

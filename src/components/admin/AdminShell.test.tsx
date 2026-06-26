import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { email: 'a@b.c', uid: 'admin1' }, signOut: vi.fn() }),
}));
const saveContent = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/content', () => ({
  saveContent: (b: unknown) => saveContent(b),
  fetchContent: vi.fn(),
}));

import { AdminShell } from './AdminShell';
import { useContentStore } from '../../content/store';
import { SEED } from '../../content/seed';

beforeEach(() => {
  saveContent.mockClear();
  useContentStore.setState({ bundle: SEED, status: 'fallback' });
});

describe('AdminShell', () => {
  it('shows the signed-in admin email', () => {
    render(<AdminShell />);
    expect(screen.getByText(/a@b\.c/)).toBeInTheDocument();
  });

  it('shows Pool and Journey tabs and switches to Journey', () => {
    render(<AdminShell />);
    expect(screen.getByRole('button', { name: /^pool$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^journey$/i }));
    // SEED's first lesson id is u1-pattern — it appears in the Journey tab
    expect(screen.getAllByText(/u1-pattern/i).length).toBeGreaterThan(0);
  });

  it('Save calls saveContent with the draft bundle when valid', async () => {
    render(<AdminShell />);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(saveContent).toHaveBeenCalled());
  });
});

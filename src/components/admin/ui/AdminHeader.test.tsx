import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminHeader } from './AdminHeader';

describe('AdminHeader', () => {
  it('renders the console title', () => {
    render(<AdminHeader email="a@b.c" onSignOut={() => {}} />);
    expect(screen.getByRole('heading', { name: /sentence pet/i })).toBeInTheDocument();
  });

  it('shows the signed-in email with the admin marker', () => {
    render(<AdminHeader email="a@b.c" onSignOut={() => {}} />);
    expect(screen.getByText(/a@b\.c/)).toBeInTheDocument();
    expect(screen.getByText(/admin ✓/)).toBeInTheDocument();
  });

  it('fires onSignOut when Sign out is clicked', () => {
    const onSignOut = vi.fn();
    render(<AdminHeader email="a@b.c" onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('tolerates a missing email', () => {
    render(<AdminHeader email={null} onSignOut={() => {}} />);
    expect(screen.getByText(/admin ✓/)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const linkEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ linkEmail }) }));

import { SignUpForm } from './SignUpForm';

beforeEach(() => linkEmail.mockClear());

describe('SignUpForm', () => {
  it('submits email + password to linkEmail', async () => {
    render(<SignUpForm onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'k@s.th' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw123456' } });
    fireEvent.click(screen.getByRole('button', { name: /save|sign up|create/i }));
    await waitFor(() => expect(linkEmail).toHaveBeenCalledWith('k@s.th', 'pw123456'));
  });

  it('shows an error message when linking fails', async () => {
    linkEmail.mockRejectedValueOnce(new Error('email-already-in-use'));
    render(<SignUpForm onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'k@s.th' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw123456' } });
    fireEvent.click(screen.getByRole('button', { name: /save|sign up|create/i }));
    expect(await screen.findByText(/email-already-in-use|couldn't|could not/i)).toBeInTheDocument();
  });
});

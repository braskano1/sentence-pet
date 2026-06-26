import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const signIn = vi.fn().mockResolvedValue(undefined);
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ signIn }) }));

import { SignInForm } from './SignInForm';

beforeEach(() => signIn.mockClear());

describe('SignInForm', () => {
  it('submits email + password to signIn', async () => {
    render(<SignInForm onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'k@s.th' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw123456' } });
    fireEvent.click(screen.getByRole('button', { name: /continue|sign in/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('k@s.th', 'pw123456'));
  });

  it('shows an error message when sign-in fails', async () => {
    signIn.mockRejectedValueOnce(new Error('auth/wrong-password'));
    render(<SignInForm onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'k@s.th' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /continue|sign in/i }));
    expect(await screen.findByText(/wrong-password|couldn't|could not/i)).toBeInTheDocument();
  });
});

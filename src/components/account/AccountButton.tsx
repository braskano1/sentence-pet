import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { SignUpForm } from './SignUpForm';

/** Entry point for cloud save: guests sign up, signed-in students see their account. */
export function AccountButton() {
  const { isAnonymous, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isAnonymous && user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span>{user.email}</span>
        <button type="button" onClick={() => void signOut()} className="rounded border px-2 py-1">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="text-sm">
      {open ? (
        <SignUpForm onDone={() => setOpen(false)} />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="rounded border px-2 py-1">
          Save your pets across devices
        </button>
      )}
    </div>
  );
}

import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../../auth/useAuth';
import { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD } from '../../dev/adminAccount';

function LoginForm({ onSubmit }: { onSubmit: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handle(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await onSubmit(email, password);
    } catch {
      setError('Sign-in failed. Check your email and password.');
    }
  }

  async function devSignIn() {
    setError('');
    try {
      await onSubmit(DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD);
    } catch {
      setError('Dev admin not seeded. Run: npm run dev:admin (emulators must be up).');
    }
  }

  return (
    <form onSubmit={handle} className="mx-auto mt-24 flex max-w-xs flex-col gap-3 p-4">
      <h1 className="text-lg font-bold">Admin sign in</h1>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-2 py-1"
          autoComplete="username"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-2 py-1"
          autoComplete="current-password"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="rounded bg-slate-800 px-3 py-1 text-white">Sign in</button>
      {import.meta.env.DEV && (
        <button type="button" onClick={devSignIn}
          className="rounded border border-dashed border-fuchsia-400 px-3 py-1 text-sm text-fuchsia-700">
          🔑 Dev admin sign-in
        </button>
      )}
    </form>
  );
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, signIn, signOut } = useAuth();
  if (loading) return <p className="mt-24 text-center">Loading…</p>;
  if (!user) return <LoginForm onSubmit={signIn} />;
  if (!isAdmin) return (
    <div className="mt-24 flex flex-col items-center gap-3">
      <p role="alert">Not authorized.</p>
      <button type="button" onClick={() => void signOut()}
        className="rounded border px-3 py-1 text-sm">Sign out</button>
    </div>
  );
  return <>{children}</>;
}

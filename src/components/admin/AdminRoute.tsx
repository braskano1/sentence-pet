import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../../auth/useAuth';

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
    </form>
  );
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, signIn } = useAuth();
  if (loading) return <p className="mt-24 text-center">Loading…</p>;
  if (!user) return <LoginForm onSubmit={signIn} />;
  if (!isAdmin) return <p role="alert" className="mt-24 text-center">Not authorized.</p>;
  return <>{children}</>;
}

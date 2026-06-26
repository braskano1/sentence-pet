import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';

const fieldClass =
  'rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-shadow focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30';

/** Continue — returning-player sign-in. signIn() reconciles cloud-wins in AuthProvider. */
export function SignInForm({ onDone }: { onDone: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign you in.");
      return;
    } finally {
      setBusy(false);
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h2 className="text-xl font-black text-slate-900">Welcome back!</h2>
      <p className="-mt-1 text-sm text-slate-500">Sign in to load your saved pets.</p>

      <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
        Email
        <input
          type="email" required value={email} autoComplete="email"
          placeholder="you@school.th"
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
        Password
        <input
          type="password" required value={password} autoComplete="current-password"
          placeholder="Your password"
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass}
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit" disabled={busy}
        className="mt-1 rounded-2xl bg-amber-400 px-4 py-3.5 text-base font-black text-amber-950 shadow-lg shadow-amber-400/30 transition active:scale-[.98] hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Loading…' : 'Continue ▸'}
      </button>
    </form>
  );
}

import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';

const fieldClass =
  'rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30';

/** New Game — links the anonymous user to an email account. Lives in the menu's reveal sheet. */
export function SignUpForm({ onDone }: { onDone: () => void }) {
  const { linkEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await linkEmail(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your account.");
      return;
    } finally {
      setBusy(false);
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h2 className="text-xl font-black text-slate-900">New Game</h2>
      <p className="-mt-1 text-sm text-slate-500">Create an account to save your pets.</p>

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
          type="password" required minLength={6} value={password} autoComplete="new-password"
          placeholder="At least 6 characters"
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
        className="mt-1 rounded-2xl bg-emerald-500 px-4 py-3.5 text-base font-black text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98] hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Create & Play ▸'}
      </button>
    </form>
  );
}

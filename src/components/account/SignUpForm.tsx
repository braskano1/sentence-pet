import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';

/** Functional email/password upgrade form. Visual polish deferred to impeccable. */
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
    <form onSubmit={submit} className="flex flex-col gap-2 p-3">
      <p className="text-sm">Save your pets across devices.</p>
      <label className="flex flex-col text-sm">
        Email
        <input
          type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col text-sm">
        Password
        <input
          type="password" required minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-50">
        {busy ? 'Saving…' : 'Save my pets'}
      </button>
    </form>
  );
}

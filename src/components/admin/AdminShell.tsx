import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { writePing, readPing } from '../../firebase/ping';

export function AdminShell() {
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState('');

  async function ping() {
    if (!user) return;
    setStatus('pinging…');
    try {
      await writePing(user.uid);
      const v = await readPing(user.uid);
      setStatus(v ? `ping ok @ ${v.at}` : 'ping failed: no doc');
    } catch (e) {
      setStatus(`ping failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="mx-auto mt-24 flex max-w-sm flex-col gap-4 p-4">
      <h1 className="text-lg font-bold">Sentence Pet — Dashboard</h1>
      <p>Signed in as {user?.email} · admin ✓</p>
      <button type="button" onClick={ping} className="rounded bg-slate-800 px-3 py-1 text-white">
        Ping Firestore
      </button>
      {status && <p className="font-mono text-sm">{status}</p>}
      <button type="button" onClick={() => signOut()} className="rounded border px-3 py-1">
        Sign out
      </button>
    </div>
  );
}

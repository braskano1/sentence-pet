import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useContentStore } from '../../content/store';
import { validateContent } from '../../content/validate';
import { saveContent } from '../../firebase/content';
import type { ContentBundle } from '../../content/model';
import { PoolTab } from './PoolTab';
import { JourneyTab } from './JourneyTab';

export function AdminShell() {
  const { user, signOut } = useAuth();
  const liveBundle = useContentStore((s) => s.bundle);
  const setBundle = useContentStore((s) => s.setBundle);
  const [draft, setDraft] = useState<ContentBundle>(liveBundle);
  const [tab, setTab] = useState<'pool' | 'journey'>('pool');
  const [status, setStatus] = useState('');

  const validation = validateContent(draft);

  async function save() {
    if (!validation.ok) return;
    setStatus('saving…');
    try {
      await saveContent(draft);
      setBundle(draft, 'live');
      setStatus('saved ✓');
    } catch (e) {
      setStatus(`save failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="mx-auto mt-6 flex max-w-4xl flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Sentence Pet — Content</h1>
        <div className="flex items-center gap-2 text-sm">
          <span>{user?.email} · admin ✓</span>
          <button type="button" onClick={() => signOut()} className="rounded border px-2 py-1">Sign out</button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setTab('pool')}
          className={`rounded px-3 py-1 ${tab === 'pool' ? 'bg-indigo-600 text-white' : 'border'}`}>Pool</button>
        <button type="button" onClick={() => setTab('journey')}
          className={`rounded px-3 py-1 ${tab === 'journey' ? 'bg-indigo-600 text-white' : 'border'}`}>Journey</button>
        <span className="flex-1" />
        <button type="button" onClick={save} disabled={!validation.ok}
          className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-40">Save</button>
        {status && <span className="font-mono text-sm">{status}</span>}
      </div>

      {!validation.ok && (
        <ul className="rounded bg-red-50 p-2 text-sm text-red-700">
          {validation.errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      {tab === 'pool'
        ? <PoolTab bundle={draft} onChange={setDraft} />
        : <JourneyTab bundle={draft} onChange={setDraft} />}
    </div>
  );
}

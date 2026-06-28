import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useContentStore } from '../../content/store';
import { validateCourse } from '../../content/validate';
import { saveCourse } from '../../firebase/content';
import type { Course } from '../../content/course';
import { PoolTab } from './PoolTab';
import { JourneyTab } from './JourneyTab';
import { BossesTab } from './BossesTab';
import { ImportTab } from './ImportTab';

type Tab = 'pool' | 'journey' | 'bosses' | 'import';

export function AdminShell() {
  const { user, signOut } = useAuth();
  const liveCourse = useContentStore((s) => s.course);
  const setCourse = useContentStore((s) => s.setCourse);
  const [draft, setDraft] = useState<Course | null>(liveCourse);
  const [tab, setTab] = useState<Tab>('pool');
  const [status, setStatus] = useState('');

  if (!draft) return <p className="p-4 text-sm text-red-600">No course loaded.</p>;
  const currentDraft: Course = draft;
  const validation = validateCourse(currentDraft);

  async function save() {
    if (!validation.ok) return;
    setStatus('saving…');
    try {
      await saveCourse(currentDraft);
      setCourse(currentDraft, 'live');
      setStatus('saved ✓');
    } catch (e) {
      setStatus(`save failed: ${(e as Error).message}`);
    }
  }

  async function commitImport(c: Course) {
    setStatus('saving…');
    try {
      await saveCourse(c);
      setDraft(c);
      setCourse(c, 'live');
      setStatus('imported ✓');
    } catch (e) {
      setStatus(`import failed: ${(e as Error).message}`);
    }
  }

  const tabBtn = (id: Tab, label: string) => (
    <button type="button" onClick={() => setTab(id)}
      className={`rounded px-3 py-1 ${tab === id ? 'bg-indigo-600 text-white' : 'border'}`}>{label}</button>
  );

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
        {tabBtn('pool', 'Pool')}
        {tabBtn('journey', 'Journey')}
        {tabBtn('bosses', 'Bosses')}
        {tabBtn('import', 'Import')}
        <span className="flex-1" />
        <button type="button" onClick={save} disabled={!validation.ok}
          className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-40">Save</button>
        {status && <span className="font-mono text-sm">{status}</span>}
      </div>

      {!validation.ok && (
        <ul aria-live="polite" className="rounded bg-red-50 p-2 text-sm text-red-700">
          {validation.errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      {tab === 'pool' && <PoolTab course={draft} onChange={setDraft} />}
      {tab === 'journey' && <JourneyTab course={draft} onChange={setDraft} />}
      {tab === 'bosses' && <BossesTab course={draft} onChange={setDraft} />}
      {tab === 'import' && <ImportTab onCommit={commitImport} />}
    </div>
  );
}

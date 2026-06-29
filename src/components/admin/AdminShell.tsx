import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useContentStore } from '../../content/store';
import { validateCourse } from '../../content/validate';
import { getActivePetDefs } from '../../domain/petDef';
import { saveCourse } from '../../firebase/content';
import type { Course } from '../../content/course';
import { AdminHeader, Tabs, SaveBar, ValidationSummary, Card } from './ui';
import type { TabItem } from './ui';
import { PoolTab } from './PoolTab';
import { JourneyTab } from './JourneyTab';
import { BossesTab } from './BossesTab';
import { ImportTab } from './ImportTab';
import { PetsTab } from './PetsTab';

type Tab = 'pool' | 'journey' | 'bosses' | 'import' | 'pets';

const TABS: readonly TabItem<Tab>[] = [
  { id: 'pool', label: 'Pool' },
  { id: 'journey', label: 'Journey' },
  { id: 'bosses', label: 'Bosses' },
  { id: 'import', label: 'Import' },
  { id: 'pets', label: 'Pets' },
];

export function AdminShell() {
  const { user, signOut } = useAuth();
  const liveCourse = useContentStore((s) => s.course);
  const setCourse = useContentStore((s) => s.setCourse);
  const [draft, setDraft] = useState<Course | null>(liveCourse);
  const [tab, setTab] = useState<Tab>('pool');
  const [status, setStatus] = useState('');

  if (!draft) return <p className="p-4 text-sm text-red-600">No course loaded.</p>;
  const currentDraft: Course = draft;
  const validation = validateCourse(currentDraft, { petDefIds: new Set(getActivePetDefs().map((d) => d.id)) });

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

  return (
    <div className="admin-root mx-auto mt-6 flex max-w-4xl flex-col gap-4 p-4 text-base text-slate-800">
      <AdminHeader email={user?.email} onSignOut={() => signOut()} />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <span className="flex-1" />
        <SaveBar
          valid={validation.ok}
          status={status}
          onSave={save}
          errorCount={validation.errors.length}
        />
      </div>

      <ValidationSummary errors={validation.ok ? [] : validation.errors} />

      <Card>
        {tab === 'pool' && <PoolTab course={draft} onChange={setDraft} />}
        {tab === 'journey' && <JourneyTab course={draft} onChange={setDraft} />}
        {tab === 'bosses' && <BossesTab course={draft} onChange={setDraft} />}
        {tab === 'import' && <ImportTab onCommit={commitImport} />}
        {tab === 'pets' && <PetsTab />}
      </Card>
    </div>
  );
}

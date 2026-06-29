import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useContentStore } from '../../content/store';
import { validateCourse } from '../../content/validate';
import { getActivePetDefs } from '../../domain/petDef';
import { saveCourse } from '../../firebase/content';
import type { Course } from '../../content/course';
import { AdminHeader, AdminRail, CourseSwitcher, SaveBar, ValidationSummary } from './ui';
import type { RailGroup } from './ui';
import { useCoursesAdmin } from './useCoursesAdmin';
import { courseCounts } from './coursesTab/courseCounts';
import { CoursesTab } from './CoursesTab';
import { PoolTab } from './PoolTab';
import { JourneyTab } from './JourneyTab';
import { BossesTab } from './BossesTab';
import { PetsTab } from './PetsTab';

type Surface = 'courses' | 'pool' | 'journey' | 'bosses' | 'pets';

export function AdminShell() {
  const { user, signOut } = useAuth();
  const liveCourse = useContentStore((s) => s.course);
  const setCourse = useContentStore((s) => s.setCourse);
  const { index, activeCourseId, switchTo, create, remove } = useCoursesAdmin();

  const [draft, setDraft] = useState<Course | null>(liveCourse);
  const [surface, setSurface] = useState<Surface>('courses');
  const [status, setStatus] = useState('');

  // Resync the editing draft whenever the active course identity changes
  // (switch / create / delete-fallback replaces the store course).
  const liveId = liveCourse?.id ?? null;
  useEffect(() => { setDraft(liveCourse); }, [liveId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft) return <p className="p-4 text-sm text-red-600">No course loaded.</p>;
  const currentDraft: Course = draft;
  const dirty = currentDraft !== liveCourse;
  const validation = validateCourse(currentDraft, { petDefIds: new Set(getActivePetDefs().map((d) => d.id)) });
  const counts = courseCounts(currentDraft);

  const groups: RailGroup<Surface>[] = [
    { heading: 'Workspace', items: [{ id: 'courses', label: 'Courses', count: index.length }] },
    { heading: `Course · ${currentDraft.title}`, items: [
      { id: 'pool', label: 'Items', count: counts.items },
      { id: 'journey', label: 'Journey', count: counts.units },
      { id: 'bosses', label: 'Bosses', count: counts.bosses },
    ] },
    { heading: 'Creatures · global', items: [{ id: 'pets', label: 'Pets', count: getActivePetDefs().length }] },
  ];

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
      setCourse(c, 'live'); // draft resyncs via the effect (id change)
      setStatus('imported ✓');
    } catch (e) {
      setStatus(`import failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="admin-root mx-auto mt-6 flex max-w-7xl flex-col gap-4 p-4 text-base text-slate-800">
      <div className="flex flex-wrap items-center gap-4">
        <AdminHeader email={user?.email} onSignOut={() => signOut()} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <CourseSwitcher courses={index} activeId={activeCourseId} onSelect={(id) => void switchTo(id)} />
        <span className="flex-1" />
        <SaveBar
          valid={validation.ok}
          dirty={dirty}
          status={status}
          onSave={save}
          saveLabel="Save changes"
          errorCount={validation.errors.length}
        />
      </div>

      <ValidationSummary errors={validation.ok ? [] : validation.errors} />

      <div className="flex gap-6">
        <AdminRail groups={groups} active={surface} onSelect={setSurface} />
        <div className="min-w-0 flex-1">
          {surface === 'courses' && (
            <CoursesTab
              key={currentDraft.id}
              course={currentDraft}
              onChange={setDraft}
              index={index}
              onCreate={(meta) => void create(meta)}
              onDelete={(id) => void remove(id)}
              onSwitch={(id) => void switchTo(id)}
              onImport={commitImport}
            />
          )}
          {surface === 'pool' && <PoolTab course={currentDraft} onChange={setDraft} />}
          {surface === 'journey' && <JourneyTab course={currentDraft} onChange={setDraft} />}
          {surface === 'bosses' && <BossesTab course={currentDraft} onChange={setDraft} />}
          {surface === 'pets' && <PetsTab />}
        </div>
      </div>
    </div>
  );
}

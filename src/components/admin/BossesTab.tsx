import type { Course } from '../../content/course';
export function BossesTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  void course; void onChange;
  return <p className="text-sm text-slate-500">Bosses editor — coming soon.</p>;
}

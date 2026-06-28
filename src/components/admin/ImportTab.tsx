import type { Course } from '../../content/course';
export function ImportTab({ onCommit }: { onCommit: (c: Course) => void }) {
  void onCommit;
  return <p className="text-sm text-slate-500">Excel import — coming soon.</p>;
}

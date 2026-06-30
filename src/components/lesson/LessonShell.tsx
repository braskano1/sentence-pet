import { useEffect, useState, type ReactNode } from 'react';
import { useGameStore } from '../../state/gameStore';
import { L1Toggle } from '../L1Toggle';
import { PressButton } from '../PressButton';

/**
 * Shared lesson chrome (Spec: consistent header across all 4 lesson types).
 * Renders a fixed top bar — exit ✕ + title/instruction + progress nodes + optional
 * streak + optional L1 toggle — above the screen body (children) in a full-height flex column.
 *
 * Owns its own confirm-exit state. Exit ✕ (or the Escape key) opens a confirm dialog;
 * "Leave" returns to the lesson picker via setScreen('pickDrill'); "Stay" dismisses.
 * Layout/chrome only — it does not touch grading, scoring, or round state.
 */
export function LessonShell({
  title,
  instruction,
  index,
  total,
  streak,
  l1,
  children,
}: {
  title: string;
  instruction?: string;
  index: number;
  total: number;
  streak?: number;
  l1?: boolean;
  children: ReactNode;
}) {
  const setScreen = useGameStore((s) => s.setScreen);
  const [confirmExit, setConfirmExit] = useState(false);

  // a11y: Escape opens the same confirm as the exit ✕.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfirmExit(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1 px-4 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            aria-label="Leave lesson"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/85 text-lg font-bold text-slate-500 shadow ring-1 ring-inset ring-slate-200"
          >
            ✕
          </button>
          {streak !== undefined && (
            <span
              data-testid="streak"
              className="flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-sm font-extrabold text-orange-700 ring-1 ring-inset ring-orange-200"
            >
              🔥 {streak}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-center text-base font-extrabold text-slate-800">
            {title}
          </span>
          {l1 ? <L1Toggle /> : <span className="h-11 w-11 shrink-0" aria-hidden />}
        </div>
        {instruction && <p className="text-center text-sm text-slate-500">{instruction}</p>}
        <div className="flex justify-center gap-1.5 pt-1">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              data-testid={`track-node-${i}`}
              className={`h-2.5 w-2.5 rounded-full ${
                i < index ? 'bg-amber-400' : i === index ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-white ring-1 ring-inset ring-slate-300'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {confirmExit && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Leave lesson?"
            className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl"
          >
            <p className="text-base font-extrabold text-slate-800">Leave lesson?</p>
            <p className="mt-1 text-sm text-slate-500">Your progress won't be saved.</p>
            <div className="mt-4 flex gap-2">
              <PressButton
                onClick={() => setConfirmExit(false)}
                className="min-h-11 flex-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-extrabold text-slate-700"
              >
                Stay
              </PressButton>
              <PressButton
                onClick={() => setScreen('pickDrill')}
                className="min-h-11 flex-1 rounded-xl bg-rose-500 px-3 py-2 text-sm font-extrabold text-white"
              >
                Leave
              </PressButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

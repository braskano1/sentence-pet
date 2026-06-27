import type { ReactNode } from 'react';

/**
 * Owns all viewport layout (GAME_DESIGN.md §9a):
 * - ambient outer backdrop (slate-900) frames the column on wide screens
 * - centered max-w-md column at 100dvh, safe-area padded
 * - landscape "rotate" nudge (shown via the .rotate-nudge CSS media query in index.css)
 * Screens render INNER content only — they must not set their own height.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-slate-900 flex justify-center">
      <div className="rotate-nudge fixed inset-0 z-50 flex-col items-center justify-center gap-3 bg-slate-900 text-white text-center p-8">
        <span className="text-5xl">🔄</span>
        <p className="text-lg">Please rotate your phone to portrait.</p>
      </div>
      <main
        className="relative w-full max-w-md h-[100dvh] flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {children}
      </main>
    </div>
  );
}

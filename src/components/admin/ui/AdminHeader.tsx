import { Button } from './Button';

/**
 * Playful accent header for the admin console — the one branded flourish.
 * The warm gradient title is driven by the admin-scoped `.admin-title` class
 * (vars live under `.admin-root`, set on AdminShell). Never relies on global theme.
 */
export function AdminHeader({
  email,
  onSignOut,
}: {
  email?: string | null;
  onSignOut: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <h1 className="admin-title text-xl font-extrabold tracking-tight">
        Sentence Pet — Content
      </h1>
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span>
          {email && <>{email} · </>}
          <span className="font-medium text-emerald-600">admin ✓</span>
        </span>
        <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
      </div>
    </header>
  );
}

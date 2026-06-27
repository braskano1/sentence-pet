import { useAuth } from '../../auth/useAuth';

/** In-game signed-in control: shows the account email + Replay intro + Sign out. Hidden for guests (the menu owns sign-up). */
export function AccountButton({ onReplayIntro }: { onReplayIntro?: () => void }) {
  const { isAnonymous, user, loading, signOut } = useAuth();
  if (loading || isAnonymous || !user) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{user.email}</span>
      {onReplayIntro && (
        <button type="button" onClick={onReplayIntro} className="rounded border px-2 py-1">
          Replay intro
        </button>
      )}
      <button type="button" onClick={() => void signOut()} className="rounded border px-2 py-1">
        Sign out
      </button>
    </div>
  );
}

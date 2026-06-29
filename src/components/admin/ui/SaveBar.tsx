import { Button } from './Button';

export function SaveBar({
  valid,
  status,
  onSave,
  dirty = false,
  errorCount = 0,
  saveLabel = 'Save',
}: {
  valid: boolean;
  status: string;
  onSave: () => void;
  dirty?: boolean;
  errorCount?: number;
  saveLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {dirty && (
        <span className="flex items-center">
          <span aria-hidden className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="sr-only">unsaved changes</span>
        </span>
      )}
      {!valid && errorCount > 0 && (
        <span className="text-xs text-red-600">{errorCount} error{errorCount === 1 ? '' : 's'}</span>
      )}
      <Button variant="primary" onClick={onSave} disabled={!valid}>{saveLabel}</Button>
      <span aria-live="polite" className="font-mono text-xs text-slate-600">{status}</span>
    </div>
  );
}

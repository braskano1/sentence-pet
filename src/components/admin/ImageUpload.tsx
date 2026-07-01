import { useState } from 'react';
import { downscaleSprite } from '../../firebase/imageTranscode';
import { Button } from './ui';

/** Presentational image uploader: file picker → downscale → injected upload → onUpload(url),
 *  with a Clear button and best-effort orphan delete on replace/clear. Slot-specific I/O is
 *  injected via `upload`/`remove` so both sprite and lesson-image callers reuse this shell. */
export function ImageUpload({ label, value, onUpload, onClear, upload, remove }: {
  label: string;
  value?: string;
  onUpload: (url: string) => void;
  onClear: () => void;
  upload: (file: File) => Promise<string>;
  remove: (url: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Best-effort: a stored-file delete failure must never block the strip/upload; the orphan
  // is harmless and cleanup is non-critical.
  async function deleteOrphan(url: string) {
    try { await remove(url); } catch { /* leave orphan; cleanup is non-critical */ }
  }
  async function pick(file: File) {
    setBusy(true);
    setErr('');
    const prior = value; // the slot's current url, before the upload replaces it
    try {
      const toUpload = await downscaleSprite(file); // shrink oversized images; within-cap passes through untouched
      const url = await upload(toUpload);
      onUpload(url);
      // Replace: if a different file backed this slot, drop the now-orphaned old object.
      // Same-url overwrite (identical path/ext) already replaced the blob — never delete it.
      if (prior && prior !== url) await deleteOrphan(prior);
    } catch (e) {
      setErr((e as Error).message || 'upload failed');
    } finally {
      setBusy(false);
    }
  }
  function clear() {
    const prior = value; // capture before the parent strips it
    onClear(); // strip the url first so the UI updates immediately…
    if (prior) void deleteOrphan(prior); // …then best-effort delete the now-orphaned object
  }
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-slate-700">
        <span>{label}</span>
        <input type="file" accept="image/*" className="w-40 text-xs" aria-invalid={!!err || undefined}
          onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) pick(f); }} />
      </label>
      {value && (
        <>
          <img src={value} alt={`${label} preview`} className="h-10 w-10 rounded border border-slate-200 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          <Button variant="danger" aria-label={`clear ${label}`} onClick={clear} className="px-2 py-0.5 text-xs">Clear</Button>
        </>
      )}
      <span aria-live="polite" className="text-xs text-slate-600">{busy ? 'uploading…' : err ? `⚠ ${err}` : ''}</span>
    </div>
  );
}

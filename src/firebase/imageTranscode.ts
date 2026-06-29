export const MAX_SPRITE_DIM = 512;

/** Target dimensions to fit (w,h) within `max` preserving aspect ratio. Returns
 *  null when the image already fits (no resize needed). */
export function fitWithin(w: number, h: number, max: number = MAX_SPRITE_DIM): { w: number; h: number } | null {
  if (w <= max && h <= max) return null;
  const scale = max / Math.max(w, h);
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** Downscale an oversized sprite image to fit MAX_SPRITE_DIM, re-encoding lossless
 *  PNG. Images within the cap (or any failure) return the ORIGINAL file untouched —
 *  best-effort, never throws. Browser-only (uses createImageBitmap + canvas). */
export async function downscaleSprite(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== 'function') return file;
    const bitmap = await createImageBitmap(file);
    const target = fitWithin(bitmap.width, bitmap.height);
    if (!target) { bitmap.close?.(); return file; } // already fits
    const canvas = document.createElement('canvas');
    canvas.width = target.w; canvas.height = target.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, target.w, target.h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, '') || 'sprite';
    return new File([blob], `${base}.png`, { type: 'image/png' });
  } catch {
    return file; // best-effort: never block the upload on a transcode failure
  }
}

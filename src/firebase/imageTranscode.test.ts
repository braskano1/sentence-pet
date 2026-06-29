import { describe, it, expect, vi, afterEach } from 'vitest';
import { fitWithin, downscaleSprite, MAX_SPRITE_DIM } from './imageTranscode';

describe('fitWithin', () => {
  it('returns null when both dims are within the cap', () => {
    expect(fitWithin(100, 200)).toBeNull();
  });

  it('returns null at exactly the cap on both dims', () => {
    expect(fitWithin(512, 512)).toBeNull();
    expect(fitWithin(512, 100)).toBeNull();
    expect(fitWithin(100, 512)).toBeNull();
  });

  it('landscape over cap → width pinned to 512, height scaled', () => {
    expect(fitWithin(1024, 512)).toEqual({ w: 512, h: 256 });
  });

  it('portrait over cap → height pinned to 512, width scaled', () => {
    expect(fitWithin(512, 1024)).toEqual({ w: 256, h: 512 });
  });

  it('square over cap → 512x512', () => {
    expect(fitWithin(2048, 2048)).toEqual({ w: 512, h: 512 });
  });

  it('one dim over, one under → scales by the larger dim', () => {
    expect(fitWithin(1024, 256)).toEqual({ w: 512, h: 128 });
  });

  it('never returns a 0 dimension (1px floor for extreme aspect ratios)', () => {
    const out = fitWithin(10000, 1)!;
    expect(out.w).toBe(512);
    expect(out.h).toBe(1);
    expect(out.h).toBeGreaterThan(0);
  });

  it('honours a custom max', () => {
    expect(fitWithin(200, 100, 100)).toEqual({ w: 100, h: 50 });
    expect(fitWithin(100, 100, 100)).toBeNull();
  });

  it('MAX_SPRITE_DIM is 512', () => {
    expect(MAX_SPRITE_DIM).toBe(512);
  });
});

describe('downscaleSprite', () => {
  const origCIB = (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  const origToBlob = HTMLCanvasElement.prototype.toBlob;

  afterEach(() => {
    if (origCIB === undefined) delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
    else (globalThis as { createImageBitmap?: unknown }).createImageBitmap = origCIB;
    HTMLCanvasElement.prototype.getContext = origGetContext;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
    vi.restoreAllMocks();
  });

  it('returns the ORIGINAL file when createImageBitmap is unavailable (jsdom default)', async () => {
    // jsdom does not implement createImageBitmap — this is the real fallback path.
    const file = new File(['x'], 'big.webp', { type: 'image/webp' });
    expect(typeof (globalThis as { createImageBitmap?: unknown }).createImageBitmap).not.toBe('function');
    await expect(downscaleSprite(file)).resolves.toBe(file);
  });

  it('downscales an oversized image to a NEW lossless PNG File', async () => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = vi
      .fn()
      .mockResolvedValue({ width: 1024, height: 1024, close: vi.fn() });
    const drawImage = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage }) as never;
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/png' })));
    HTMLCanvasElement.prototype.toBlob = toBlob as never;

    const file = new File(['x'], 'big.webp', { type: 'image/webp' });
    const out = await downscaleSprite(file);

    expect(out).not.toBe(file);
    expect(out.type).toBe('image/png');
    expect(out.name).toBe('big.png');
    expect(drawImage).toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalled();
  });

  it('returns the ORIGINAL file untouched when the image already fits (no toBlob call)', async () => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = vi
      .fn()
      .mockResolvedValue({ width: 100, height: 100, close: vi.fn() });
    const toBlob = vi.fn();
    HTMLCanvasElement.prototype.toBlob = toBlob as never;

    const file = new File(['x'], 'small.webp', { type: 'image/webp' });
    const out = await downscaleSprite(file);

    expect(out).toBe(file);
    expect(toBlob).not.toHaveBeenCalled();
  });

  it('returns the ORIGINAL file when createImageBitmap rejects (catch path)', async () => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = vi
      .fn()
      .mockRejectedValue(new Error('decode failed'));
    const file = new File(['x'], 'bad.webp', { type: 'image/webp' });
    await expect(downscaleSprite(file)).resolves.toBe(file);
  });
});

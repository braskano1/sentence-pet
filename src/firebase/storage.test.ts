import { describe, it, expect, vi, beforeEach } from 'vitest';

const ref = vi.fn((_s: unknown, path: string) => ({ path }));
const uploadBytes = vi.fn().mockResolvedValue(undefined);
const getDownloadURL = vi.fn().mockResolvedValue('https://download/url');
const deleteObject = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  connectStorageEmulator: vi.fn(),
  ref: (s: unknown, p: string) => ref(s, p),
  uploadBytes: (...a: unknown[]) => uploadBytes(...a),
  getDownloadURL: (...a: unknown[]) => getDownloadURL(...a),
  deleteObject: (...a: unknown[]) => deleteObject(...a),
}));
vi.mock('./app', () => ({ firebaseApp: {} }));

import { uploadSprite, deleteSpriteByUrl } from './storage';

beforeEach(() => { ref.mockClear(); uploadBytes.mockClear(); getDownloadURL.mockClear(); deleteObject.mockClear(); });

describe('uploadSprite', () => {
  it('uploads the default slot to petDefs/{defId}/default.{ext} and returns the download URL', async () => {
    const file = new File(['x'], 'leaf.webp', { type: 'image/webp' });
    const url = await uploadSprite('def-leaf', 'default', file);
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'petDefs/def-leaf/default.webp');
    expect(uploadBytes).toHaveBeenCalledWith({ path: 'petDefs/def-leaf/default.webp' }, file);
    expect(url).toBe('https://download/url');
  });

  it('uses the stage-mood slot in the path for a variant', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await uploadSprite('def-fire', 'baby-happy', file);
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'petDefs/def-fire/baby-happy.png');
  });

  it('falls back to the mime subtype, then "img", when the filename has no extension', async () => {
    await uploadSprite('def-x', 'default', new File(['x'], 'noext', { type: 'image/webp' }));
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'petDefs/def-x/default.webp');
    await uploadSprite('def-y', 'default', new File(['x'], 'noext', { type: '' }));
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'petDefs/def-y/default.img');
  });
});

describe('deleteSpriteByUrl', () => {
  it('builds a ref from the download URL and deletes that object', async () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/x/o/petDefs%2Fdef-leaf%2Fdefault.webp?alt=media';
    await deleteSpriteByUrl(url);
    expect(ref).toHaveBeenCalledWith(expect.anything(), url);
    expect(deleteObject).toHaveBeenCalledWith({ path: url });
  });

  it('propagates a delete failure (callers decide whether to swallow)', async () => {
    deleteObject.mockRejectedValueOnce(new Error('not found'));
    await expect(deleteSpriteByUrl('https://download/gone.webp')).rejects.toThrow('not found');
  });
});

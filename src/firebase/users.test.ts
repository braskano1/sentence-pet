import { describe, it, expect, vi, beforeEach } from 'vitest';

const { setDoc, getDoc, getDocs, doc, collection } = vi.hoisted(() => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn((_db: unknown, ...segs: string[]) => ({ path: segs.join('/') })),
  collection: vi.fn((_db: unknown, ...segs: string[]) => ({ path: segs.join('/') })),
}));

vi.mock('firebase/firestore', () => ({
  doc, collection, setDoc, getDoc, getDocs,
  serverTimestamp: () => '<<ts>>',
}));
vi.mock('./db', () => ({ db: {} }));

import { saveProfile, savePet, loadCloudSave } from './users';

beforeEach(() => { setDoc.mockClear(); getDoc.mockReset(); getDocs.mockReset(); });

describe('users repo', () => {
  it('saveProfile writes users/{uid}/meta/profile with a server timestamp', async () => {
    await saveProfile('u1', { coins: 3, persistVersion: 9 } as never);
    expect(doc).toHaveBeenCalledWith({}, 'users', 'u1', 'meta', 'profile');
    const [, payload] = setDoc.mock.calls[0];
    expect(payload).toMatchObject({ coins: 3, persistVersion: 9, updatedAt: '<<ts>>' });
  });

  it('savePet writes users/{uid}/pets/{petId} with a server timestamp', async () => {
    await savePet('u1', { id: 'p1' } as never);
    expect(doc).toHaveBeenCalledWith({}, 'users', 'u1', 'pets', 'p1');
    const [, payload] = setDoc.mock.calls[0];
    expect(payload).toMatchObject({ id: 'p1', updatedAt: '<<ts>>' });
  });

  it('loadCloudSave returns null when the profile doc is missing', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    expect(await loadCloudSave('u1')).toBeNull();
  });

  it('loadCloudSave assembles profile + pets and strips updatedAt', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ coins: 5, persistVersion: 9, updatedAt: '<<ts>>' }) });
    getDocs.mockResolvedValue({ docs: [{ data: () => ({ id: 'p1', updatedAt: '<<ts>>' }) }] });
    const save = await loadCloudSave('u1');
    expect(save).toEqual({ profile: { coins: 5, persistVersion: 9 }, pets: [{ id: 'p1' }] });
  });
});

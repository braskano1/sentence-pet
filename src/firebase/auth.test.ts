import { describe, it, expect, vi, beforeEach } from 'vitest';

const { signInAnonymously, linkWithCredential, credential } = vi.hoisted(() => ({
  signInAnonymously: vi.fn().mockResolvedValue({}),
  linkWithCredential: vi.fn().mockResolvedValue({}),
  credential: vi.fn((email: string, pw: string) => ({ email, pw })),
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'anon1' } }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  connectAuthEmulator: vi.fn(),
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider: { credential },
}));
vi.mock('./app', () => ({ firebaseApp: {} }));

import { signInAnon, linkEmailPassword } from './auth';

beforeEach(() => { signInAnonymously.mockClear(); linkWithCredential.mockClear(); credential.mockClear(); });

describe('auth wrappers', () => {
  it('signInAnon delegates to signInAnonymously', async () => {
    await signInAnon();
    expect(signInAnonymously).toHaveBeenCalledOnce();
  });

  it('linkEmailPassword links an email credential onto the current user', async () => {
    await linkEmailPassword('k@s.th', 'pw123456');
    expect(credential).toHaveBeenCalledWith('k@s.th', 'pw123456');
    expect(linkWithCredential).toHaveBeenCalledWith({ uid: 'anon1' }, { email: 'k@s.th', pw: 'pw123456' });
  });
});

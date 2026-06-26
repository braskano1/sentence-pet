import {
  getAuth,
  signInWithEmailAndPassword,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator,
  type User,
} from 'firebase/auth';
import { firebaseApp } from './app';

export const auth = getAuth(firebaseApp);

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

export function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signInAnon() {
  return signInAnonymously(auth);
}

/** Upgrade the current (anonymous) user to an email/password account, preserving the uid. */
export function linkEmailPassword(email: string, password: string) {
  const cred = EmailAuthProvider.credential(email, password);
  return linkWithCredential(auth.currentUser!, cred);
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

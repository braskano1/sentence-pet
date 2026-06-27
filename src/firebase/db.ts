import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { firebaseApp } from './app';

export const db = getFirestore(firebaseApp);

// Point at the local Firestore emulator when explicitly enabled.
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  const host = import.meta.env.VITE_EMULATOR_HOST ?? '127.0.0.1';
  connectFirestoreEmulator(db, host, 8080);
}

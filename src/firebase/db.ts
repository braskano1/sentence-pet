import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { firebaseApp } from './app';

export const db = getFirestore(firebaseApp);

// Point at the local Firestore emulator when explicitly enabled.
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

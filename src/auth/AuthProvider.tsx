import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  auth, onAuthChange, signIn as fbSignIn, signInAnon, linkEmailPassword, signOutUser,
} from '../firebase/auth';
import { useGameStore, selectPersisted } from '../state/gameStore';
import { startCloudSync } from '../sync/cloudSync';
import { reconcileFromCloud } from '../sync/reconcile';
import { loadCloudSave, saveProfile, savePet } from '../firebase/users';

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isAnonymous: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  linkEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, player = false }: { children: ReactNode; player?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Track auth state; in player mode, auto-create an anonymous guest when signed out.
  useEffect(() => {
    return onAuthChange(async (u) => {
      if (!u && player) {
        // Bootstrap a guest; onAuthChange will fire again with the anon user.
        await signInAnon();
        return;
      }
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, [player]);

  // Player-only: mirror local -> cloud for the active uid.
  // NOTE: no reconcile here. Reconcile (cloud-wins) happens ONLY inside signIn()
  // — the explicit cross-device sign-in event. Reloads and anon->email link keep
  // the current uid and must NOT pull cloud, so local (localStorage) stays the
  // instant source of truth and offline progress is never clobbered.
  const uid = user?.uid;
  useEffect(() => {
    if (!player || !uid) return;
    const stop = startCloudSync({
      uid,
      getState: () => selectPersisted(useGameStore.getState()),
      subscribe: (listener) => useGameStore.subscribe(listener),
      repo: { saveProfile, savePet },
    });
    return () => stop();
  }, [player, uid]);

  const value: AuthState = {
    user,
    isAdmin,
    isAnonymous: user?.isAnonymous ?? false,
    loading,
    signIn: async (email, password) => {
      await fbSignIn(email, password);
      // Signing in on this device with an existing account: cloud always wins.
      const signedInUid = auth.currentUser?.uid;
      if (signedInUid) {
        await reconcileFromCloud({
          uid: signedInUid,
          loadCloudSave,
          applyState: (s) => useGameStore.setState(s),
        });
      }
      // The sync effect (re)starts for the new uid and re-pushes the reconciled state.
    },
    linkEmail: async (email, password) => { await linkEmailPassword(email, password); },
    signOut: async () => { await signOutUser(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

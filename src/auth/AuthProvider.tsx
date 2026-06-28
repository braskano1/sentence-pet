import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthChange, signIn as fbSignIn, signInAnon, linkEmailPassword, signOutUser,
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

// Guards against a duplicate anonymous sign-in when onAuthChange fires `null`
// twice before the first signInAnon resolves (e.g. React StrictMode double-invoke).
let anonBootstrapInFlight = false;

export function AuthProvider({ children, player = false }: { children: ReactNode; player?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // isAnonymous is explicit state, not derived from `user`. An anon->email link
  // (linkWithCredential) upgrades the SAME User object in place without refiring
  // onAuthChange, so deriving it off `user` would never re-render and the player
  // would bounce back to the menu after sign-up. Set it on every auth change and
  // flip it on a successful link.
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Track auth state; in player mode, auto-create an anonymous guest when signed out.
  useEffect(() => {
    return onAuthChange(async (u) => {
      if (!u && player) {
        // Bootstrap a guest; onAuthChange will fire again with the anon user.
        if (!anonBootstrapInFlight) {
          anonBootstrapInFlight = true;
          void signInAnon();
        }
        return;
      }
      anonBootstrapInFlight = false; // a user arrived — clear the in-flight guard
      setUser(u);
      setIsAnonymous(u?.isAnonymous ?? false);
      if (u) {
        // Force a refresh so a just-granted {admin:true} claim is picked up without
        // a manual sign-out/in (custom claims don't propagate to a cached ID token).
        const token = await u.getIdTokenResult(true);
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
    isAnonymous,
    loading,
    signIn: async (email, password) => {
      const cred = await fbSignIn(email, password);
      // Signing in on this device with an existing account: cloud always wins.
      await reconcileFromCloud({
        uid: cred.user.uid,
        loadCloudSave,
        applyState: (s) => useGameStore.setState(s),
      });
      // The sync effect (re)starts for the new uid and re-pushes the reconciled state.
    },
    linkEmail: async (email, password) => {
      await linkEmailPassword(email, password);
      // linkWithCredential mutates the current user in place (same uid, now non-anon)
      // and does NOT refire onAuthChange, so flip the flag ourselves to leave the menu.
      setIsAnonymous(false);
    },
    signOut: async () => { await signOutUser(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

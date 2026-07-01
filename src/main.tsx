import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { PlayerRoot } from './PlayerRoot.tsx'
import { useGameStore } from './state/gameStore'
import { useBattleStore } from './state/battleStore'
import { useContentStore } from './content/store'
import { isAdminEntry } from './auth/adminEntry'
import { hydrateCourse, hydratePetDefs, cachedPetDefs } from './content/load'
import { BUILTIN_PET_DEFS, getActivePetDefs, setActivePetDefs } from './domain/petDef'
import { AuthProvider } from './auth/AuthProvider'

const AdminApp = lazy(() => import('./admin-entry'))

if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useGameStore }).store = useGameStore
  ;(window as unknown as { battleStore: typeof useBattleStore }).battleStore = useBattleStore
  ;(window as unknown as { contentStore: typeof useContentStore }).contentStore = useContentStore
  // Pet-def registry handle for hermetic e2e (inject custom catalogs to drive the gacha pool).
  ;(window as unknown as { petDefs: { get: typeof getActivePetDefs; set: typeof setActivePetDefs; builtins: typeof BUILTIN_PET_DEFS } }).petDefs =
    { get: getActivePetDefs, set: setActivePetDefs, builtins: BUILTIN_PET_DEFS }
}

const isAdmin = isAdminEntry(window.location.hash)

// Seed the pet-def registry from last-good cache on BOTH routes (instant, no-clobber baseline).
// Admin's authoritative live-fetch is owned by PetsTab so it can gate Save; the player live-hydrates here.
setActivePetDefs(cachedPetDefs() ?? [...BUILTIN_PET_DEFS])

if (!isAdmin) {
  void hydrateCourse('default') // live fetch the default course → swap + cache; failures keep fallback
  // player live-fetch; swap + cache. Reconcile after it settles (success, failure, or cache
  // fallback) to heal any owned pet whose defId no longer exists in the active catalog.
  void hydratePetDefs().finally(() => { useGameStore.getState().reconcilePetDefs() })
}

const root = isAdmin
  ? <Suspense fallback={<p style={{ padding: 16 }}>Loading…</p>}><AdminApp /></Suspense>
  : <AuthProvider player><PlayerRoot /></AuthProvider>

createRoot(document.getElementById('root')!).render(<StrictMode>{root}</StrictMode>)

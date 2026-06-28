import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { PlayerRoot } from './PlayerRoot.tsx'
import { useGameStore } from './state/gameStore'
import { useBattleStore } from './state/battleStore'
import { useContentStore } from './content/store'
import { isAdminEntry } from './auth/adminEntry'
import { hydrateCourse, hydratePetDefs, cachedPetDefs } from './content/load'
import { BUILTIN_PET_DEFS, setActivePetDefs } from './domain/petDef'
import { AuthProvider } from './auth/AuthProvider'

const AdminApp = lazy(() => import('./admin-entry'))

if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useGameStore }).store = useGameStore
  ;(window as unknown as { battleStore: typeof useBattleStore }).battleStore = useBattleStore
  ;(window as unknown as { contentStore: typeof useContentStore }).contentStore = useContentStore
}

const isAdmin = isAdminEntry(window.location.hash)
if (!isAdmin) {
  void hydrateCourse('default') // live fetch the default course → swap + cache; failures keep fallback
  // Seed the pet-def registry from last-good cache (instant), then live-fetch → swap + cache.
  setActivePetDefs(cachedPetDefs() ?? [...BUILTIN_PET_DEFS])
  void hydratePetDefs()
}

const root = isAdmin
  ? <Suspense fallback={<p style={{ padding: 16 }}>Loading…</p>}><AdminApp /></Suspense>
  : <AuthProvider player><PlayerRoot /></AuthProvider>

createRoot(document.getElementById('root')!).render(<StrictMode>{root}</StrictMode>)

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
  // Restore the player's actual course (persist rehydrates synchronously), not a
  // hardcoded 'default' — the content store is not persisted, so on every reload/
  // remount it resets to the seed fallback; without this, a returning player whose
  // currentCourseId points at a real course sees the fallback journey instead.
  // Fresh player (null) skips this and picks a course via CourseSelect.
  const currentCourseId = useGameStore.getState().currentCourseId
  if (currentCourseId) void hydrateCourse(currentCourseId) // swap + cache; failures keep fallback
  void hydratePetDefs()                                     // player live-fetch; swap + cache
}

const root = isAdmin
  ? <Suspense fallback={<p style={{ padding: 16 }}>Loading…</p>}><AdminApp /></Suspense>
  : <AuthProvider player><PlayerRoot /></AuthProvider>

createRoot(document.getElementById('root')!).render(<StrictMode>{root}</StrictMode>)

import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { PlayerRoot } from './PlayerRoot.tsx'
import { useGameStore } from './state/gameStore'
import { useBattleStore } from './state/battleStore'
import { useContentStore } from './content/store'
import { isAdminEntry } from './auth/adminEntry'
import { hydrateContent } from './content/load'
import { AuthProvider } from './auth/AuthProvider'

const AdminApp = lazy(() => import('./admin-entry'))

if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useGameStore }).store = useGameStore
  ;(window as unknown as { battleStore: typeof useBattleStore }).battleStore = useBattleStore
  ;(window as unknown as { contentStore: typeof useContentStore }).contentStore = useContentStore
}

const isAdmin = isAdminEntry(window.location.hash)
if (!isAdmin) {
  void hydrateContent() // live fetch → swap + cache; failures keep the bundled fallback
}

const root = isAdmin
  ? <Suspense fallback={<p style={{ padding: 16 }}>Loading…</p>}><AdminApp /></Suspense>
  : <AuthProvider player><PlayerRoot /></AuthProvider>

createRoot(document.getElementById('root')!).render(<StrictMode>{root}</StrictMode>)

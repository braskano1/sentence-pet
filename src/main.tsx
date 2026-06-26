import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './state/gameStore'
import { isAdminEntry } from './auth/adminEntry'
import { hydrateContent } from './content/load'

const AdminApp = lazy(() => import('./admin-entry'))

if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useGameStore }).store = useGameStore
}

const isAdmin = isAdminEntry(window.location.hash)
if (!isAdmin) {
  void hydrateContent() // live fetch → swap + cache; failures keep the bundled fallback
}

const root = isAdmin
  ? <Suspense fallback={<p style={{ padding: 16 }}>Loading…</p>}><AdminApp /></Suspense>
  : <App />

createRoot(document.getElementById('root')!).render(<StrictMode>{root}</StrictMode>)

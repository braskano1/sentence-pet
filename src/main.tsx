import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './state/gameStore'
import { isAdminEntry } from './auth/adminEntry'
import { AuthProvider } from './auth/AuthProvider'
import { AdminRoute } from './components/admin/AdminRoute'
import { AdminShell } from './components/admin/AdminShell'

// Dev-only: expose the store for console debugging (store.getState().addXpForTest(3000)).
if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useGameStore }).store = useGameStore
}

const root = isAdminEntry(window.location.hash) ? (
  <AuthProvider>
    <AdminRoute>
      <AdminShell />
    </AdminRoute>
  </AuthProvider>
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {root}
  </StrictMode>,
)

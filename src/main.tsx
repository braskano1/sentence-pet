import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './state/gameStore'

// Dev-only: expose the store for console debugging (store.getState().addXpForTest(3000)).
if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useGameStore }).store = useGameStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

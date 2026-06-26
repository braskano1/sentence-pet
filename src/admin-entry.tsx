import { AuthProvider } from './auth/AuthProvider'
import { AdminRoute } from './components/admin/AdminRoute'
import { AdminShell } from './components/admin/AdminShell'

export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminRoute>
        <AdminShell />
      </AdminRoute>
    </AuthProvider>
  )
}

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ managerOnly = false }) {
  const { user, profile, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (managerOnly && profile?.role !== 'manager') {
    return <Navigate to="/goals" replace />
  }

  return <Outlet />
}

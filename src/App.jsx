import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { TodaysGoals } from './pages/TodaysGoals'
import { TaskList } from './pages/TaskList'
import { TaskDetail } from './pages/TaskDetail'
import { DailySummary } from './pages/DailySummary'
import { Dashboard } from './pages/Dashboard'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/goals" element={<TodaysGoals />} />
            <Route path="/tasks" element={<TaskList />} />
            <Route path="/tasks/:taskId" element={<TaskDetail />} />
            <Route path="/summary" element={<DailySummary />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute managerOnly />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/goals" replace />} />
        <Route path="*" element={<Navigate to="/goals" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App

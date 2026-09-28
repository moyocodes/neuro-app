import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/goals', label: 'Goals' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/summary', label: 'Summary' },
]

function NavItem({ to, label }) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <li className="relative">
      <NavLink
        to={to}
        className="relative flex flex-col items-center rounded-full px-4 py-2 text-xs font-medium"
      >
        {isActive && (
          <motion.span
            layoutId="nav-pill"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="absolute inset-0 rounded-full bg-zinc-800"
          />
        )}
        <span className={`relative ${isActive ? 'text-zinc-50' : 'text-zinc-500'}`}>
          {label}
        </span>
      </NavLink>
    </li>
  )
}

export function AppShell() {
  const { profile } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-24 pt-6 sm:px-6">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <ul className="mx-auto flex w-full max-w-2xl items-center justify-around py-2">
          {navItems.map((item) => (
            <NavItem key={item.to} to={item.to} label={item.label} />
          ))}
          {profile?.role === 'manager' && (
            <NavItem to="/dashboard" label="Dashboard" />
          )}
        </ul>
      </nav>
    </div>
  )
}

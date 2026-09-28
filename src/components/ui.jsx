import { motion } from 'framer-motion'

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function MotionCard({ children, className = '', ...props }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}) {
  const variants = {
    primary: 'bg-zinc-100 text-zinc-950 hover:bg-white',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
    ghost: 'bg-transparent text-zinc-300 hover:bg-zinc-800',
  }

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export function IconButton({ children, active, className = '', ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
        active
          ? 'bg-zinc-100 text-zinc-950'
          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      } ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export function StreakBadge({ count, label = 'day streak' }) {
  return (
    <motion.div
      key={count}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100"
    >
      {count} {label}
    </motion.div>
  )
}

export function StatusPill({ status }) {
  const styles = {
    pending: 'bg-zinc-800 text-zinc-300',
    completed: 'bg-zinc-100 text-zinc-950',
    flagged: 'bg-amber-500/10 text-amber-400',
  }

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  )
}

export function ToggleChip({ active, children, className = '', ...props }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-zinc-100 bg-zinc-100/10 text-zinc-100'
          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
      } ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start justify-between gap-3"
    >
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </motion.header>
  )
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center">
      {icon && <div className="text-zinc-600">{icon}</div>}
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
    </div>
  )
}

export function TextInput(props) {
  return (
    <input
      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-400"
      {...props}
    />
  )
}

export function TextArea(props) {
  return (
    <textarea
      className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-400"
      {...props}
    />
  )
}

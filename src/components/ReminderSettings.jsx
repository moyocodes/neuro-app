import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { enableReminderNotifications, notificationPermissionState } from '../lib/messaging'
import { Button } from './ui'

export function ReminderSettings() {
  const { user } = useAuth()
  const [permission, setPermission] = useState(notificationPermissionState())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (permission === 'unsupported') return null
  if (permission === 'granted') return null

  async function handleEnable() {
    setError('')
    setLoading(true)
    try {
      await enableReminderNotifications(user.id)
      setPermission('granted')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4"
    >
      <p className="mb-3 text-sm text-amber-200">
        Turn on notifications to get alarms for your goals and tasks, with a
        note reminding you why.
      </p>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <Button variant="secondary" onClick={handleEnable} disabled={loading}>
        {loading ? 'Enabling…' : 'Enable reminders'}
      </Button>
    </motion.div>
  )
}

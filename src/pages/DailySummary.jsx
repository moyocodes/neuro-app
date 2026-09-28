import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Card, MotionCard, PageHeader, StreakBadge } from '../components/ui'

const todayKey = () => new Date().toISOString().slice(0, 10)

export function DailySummary() {
  const { user, profile } = useAuth()
  const [recitationsCount, setRecitationsCount] = useState(0)
  const [tasksCompleted, setTasksCompleted] = useState(0)
  const [tasksFlagged, setTasksFlagged] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { count } = await supabase
        .from('recitations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', todayKey())
      setRecitationsCount(count ?? 0)

      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('assigned_to', user.id)
        .eq('due_date', todayKey())
      setTasksCompleted((tasks ?? []).filter((t) => t.status === 'completed').length)
      setTasksFlagged((tasks ?? []).filter((t) => t.status === 'flagged').length)
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })}
        title="Daily Summary"
        action={<StreakBadge count={profile?.streak_count ?? 0} />}
      />

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <MotionCard>
            <p className="text-2xl font-bold text-zinc-50">{recitationsCount}</p>
            <p className="text-xs text-zinc-400">Goals done</p>
          </MotionCard>
          <MotionCard>
            <p className="text-2xl font-bold text-zinc-50">{tasksCompleted}</p>
            <p className="text-xs text-zinc-400">Tasks completed</p>
          </MotionCard>
          <MotionCard>
            <p className="text-2xl font-bold text-amber-400">{tasksFlagged}</p>
            <p className="text-xs text-zinc-400">Flags today</p>
          </MotionCard>
          <MotionCard>
            <p className="text-2xl font-bold text-zinc-50">
              {profile?.trust_score ?? '—'}
            </p>
            <p className="text-xs text-zinc-400">Trust score</p>
          </MotionCard>
        </div>
      )}

      <Card>
        <p className="text-sm text-zinc-400">
          Longest streak:{' '}
          <span className="font-semibold text-zinc-200">
            {profile?.longest_streak ?? 0} days
          </span>
        </p>
      </Card>
    </div>
  )
}

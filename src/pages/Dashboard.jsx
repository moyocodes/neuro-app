import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, StatusPill } from '../components/ui'

function formatDateTime(isoString) {
  if (!isoString) return 'Never'
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function LoginHistory({ userId }) {
  const [events, setEvents] = useState(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('login_events')
      .select('*')
      .eq('user_id', userId)
      .order('at', { ascending: false })
      .limit(5)
    setEvents(data ?? [])
    setLoading(false)
  }

  if (events === null) {
    return (
      <button
        onClick={load}
        disabled={loading}
        className="text-xs font-medium text-zinc-100 hover:underline"
      >
        {loading ? 'Loading…' : 'View login history'}
      </button>
    )
  }

  return (
    <ul className="space-y-1">
      {events.length === 0 && (
        <li className="text-xs text-zinc-500">No login history yet.</li>
      )}
      {events.map((event) => (
        <li key={event.id} className="text-xs text-zinc-400">
          {formatDateTime(event.at)}
          {event.user_agent && (
            <span className="text-zinc-600"> · {event.user_agent.slice(0, 40)}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function TeamMemberCard({ member }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{member.name}</p>
          <p className="text-xs text-zinc-500">
            {member.streak_count ?? 0} day streak
          </p>
        </div>
        <p className="text-lg font-bold">{member.trust_score ?? '—'}</p>
      </div>

      <div className="mt-3 border-t border-zinc-800 pt-3">
        <p className="mb-1 text-xs text-zinc-500">
          Last login: {formatDateTime(member.last_login_at)}
        </p>
        <LoginHistory userId={member.id} />
      </div>
    </Card>
  )
}

export function Dashboard() {
  const { profile } = useAuth()
  const [teamMembers, setTeamMembers] = useState([])
  const [flaggedTasks, setFlaggedTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.team_id) {
      setLoading(false)
      return
    }
    async function load() {
      const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .eq('team_id', profile.team_id)
      setTeamMembers(members ?? [])

      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'flagged')
        .order('due_date', { ascending: false })
      setFlaggedTasks(tasks ?? [])
      setLoading(false)
    }
    load()
  }, [profile])

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Manager/team mode" title="Team Dashboard" subtitle="Trust scores and flags." />

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300">
              Team trust scores
            </h2>
            {teamMembers.length === 0 && (
              <Card>
                <p className="text-sm text-zinc-400">No team members yet.</p>
              </Card>
            )}
            {teamMembers.map((member) => (
              <TeamMemberCard key={member.id} member={member} />
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300">
              Flagged submissions
            </h2>
            {flaggedTasks.length === 0 && (
              <Card>
                <p className="text-sm text-zinc-400">Nothing flagged. Clean.</p>
              </Card>
            )}
            {flaggedTasks.map((task) => (
              <Card key={task.id}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{task.title}</p>
                  <StatusPill status={task.status} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Due {task.due_date}
                </p>
              </Card>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

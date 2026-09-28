import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { suggestGoals } from '../lib/anthropic'
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  MotionCard,
  PageHeader,
  StreakBadge,
  TextInput,
} from '../components/ui'
import { ReminderSettings } from '../components/ReminderSettings'
import { ReminderTimeField } from '../components/ReminderTimeField'
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
  XIcon,
} from '../components/icons'
import { formatHHMM, isWithinWindow } from '../lib/time'

const todayKey = () => new Date().toISOString().slice(0, 10)

function GoalEditForm({ goal, onSave, onCancel }) {
  const [text, setText] = useState(goal.text)
  const [windowStart, setWindowStart] = useState(goal.window_start ?? '')
  const [windowEnd, setWindowEnd] = useState(goal.window_end ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    try {
      await onSave({
        text: text.trim(),
        window_start: windowStart || null,
        window_end: windowEnd || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <TextInput value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-32 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Window start
          </label>
          <TextInput
            type="time"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
          />
        </div>
        <div className="min-w-32 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Window end
          </label>
          <TextInput
            type="time"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !text.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" className="w-auto px-4" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function AiGoalSuggestions({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [intent, setIntent] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [addedTexts, setAddedTexts] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!intent.trim()) return
    setLoading(true)
    setError('')
    try {
      const results = await suggestGoals(intent.trim())
      if (results.length === 0) {
        setError("Couldn't come up with suggestions. Try rephrasing.")
      }
      setSuggestions(results)
      setAddedTexts(new Set())
    } catch {
      setError('AI suggestion failed. Check your API key in .env.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(text) {
    await onAdd(text)
    setAddedTexts((prev) => new Set(prev).add(text))
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-800 py-3 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
      >
        <SparkleIcon className="h-4 w-4" />
        Suggest goals with AI
      </button>
    )
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <SparkleIcon className="h-4 w-4 text-zinc-100" />
          AI goal suggestions
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-zinc-500 hover:text-zinc-300"
          aria-label="Close"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <TextInput
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="What do you want to work on? e.g. be more patient"
          className="flex-1"
        />
        <Button
          type="submit"
          className="w-auto shrink-0 px-4"
          disabled={loading || !intent.trim()}
        >
          {loading ? '…' : 'Ask'}
        </Button>
      </form>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {suggestions.length > 0 && (
        <ul className="space-y-2">
          {suggestions.map((text) => {
            const added = addedTexts.has(text)
            return (
              <li
                key={text}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5"
              >
                <p className="text-sm text-zinc-200">{text}</p>
                <IconButton
                  active={added}
                  onClick={() => !added && handleAdd(text)}
                  aria-label={added ? 'Added' : 'Add goal'}
                  className="h-7 w-7"
                >
                  {added ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : (
                    <PlusIcon className="h-3.5 w-3.5" />
                  )}
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function TodaysGoals() {
  const { user, profile } = useAuth()
  const [goals, setGoals] = useState([])
  const [confirmedGoalIds, setConfirmedGoalIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [newGoalText, setNewGoalText] = useState('')
  const [windowStart, setWindowStart] = useState('')
  const [windowEnd, setWindowEnd] = useState('')
  const [addingGoal, setAddingGoal] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState(null)

  async function loadGoals(userId) {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
    setGoals(data ?? [])
  }

  useEffect(() => {
    if (!user) return
    async function load() {
      await loadGoals(user.id)

      const { data } = await supabase
        .from('recitations')
        .select('goal_id')
        .eq('user_id', user.id)
        .eq('date', todayKey())
      setConfirmedGoalIds(new Set((data ?? []).map((r) => r.goal_id)))
      setLoading(false)
    }
    load()
  }, [user])

  async function createGoal(text, extra = {}) {
    await supabase.from('goals').insert({
      user_id: user.id,
      text,
      active: true,
      window_start: null,
      window_end: null,
      ...extra,
    })
    await loadGoals(user.id)
  }

  async function handleAddGoal(e) {
    e.preventDefault()
    const text = newGoalText.trim()
    if (!text) return

    setAddingGoal(true)
    try {
      await createGoal(text, {
        window_start: windowStart || null,
        window_end: windowEnd || null,
      })
      setNewGoalText('')
      setWindowStart('')
      setWindowEnd('')
    } finally {
      setAddingGoal(false)
    }
  }

  async function handleUpdateGoal(goalId, changes) {
    await supabase.from('goals').update(changes).eq('id', goalId)
    setEditingGoalId(null)
    await loadGoals(user.id)
  }

  async function handleDeleteGoal(goalId) {
    await supabase.from('goals').delete().eq('id', goalId)
    await loadGoals(user.id)
  }

  async function markDone(goalId) {
    await supabase.from('recitations').insert({
      user_id: user.id,
      goal_id: goalId,
      date: todayKey(),
    })
    setConfirmedGoalIds((prev) => new Set(prev).add(goalId))
  }

  const allConfirmed = goals.length > 0 && goals.every((g) => confirmedGoalIds.has(g.id))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily checklist"
        title="Today's Goals"
        subtitle="Check off each goal as you go."
        action={<StreakBadge count={profile?.streak_count ?? 0} />}
      />

      <ReminderSettings />

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && goals.length === 0 && (
        <EmptyState
          title="No goals set yet"
          subtitle="Add one below to start your streak."
        />
      )}

      <div className="space-y-3">
        <AnimatePresence initial={false}>
        {goals.map((goal) => {
          const confirmed = confirmedGoalIds.has(goal.id)
          const hasWindow = goal.window_start && goal.window_end
          const inWindow = isWithinWindow(goal.window_start, goal.window_end)
          const locked = hasWindow && !inWindow && !confirmed
          const editing = editingGoalId === goal.id

          if (editing) {
            return (
              <Card key={goal.id}>
                <GoalEditForm
                  goal={goal}
                  onSave={(changes) => handleUpdateGoal(goal.id, changes)}
                  onCancel={() => setEditingGoalId(null)}
                />
              </Card>
            )
          }

          return (
            <MotionCard
              key={goal.id}
              className={confirmed ? 'border-zinc-700 bg-zinc-800/40' : ''}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-zinc-100">
                  {goal.text}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => setEditingGoalId(goal.id)}
                    aria-label="Edit goal"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    aria-label="Delete goal"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => !confirmed && !locked && markDone(goal.id)}
                    disabled={confirmed || locked}
                    aria-label={confirmed ? 'Done' : 'Mark done'}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                      confirmed
                        ? 'border-zinc-100 bg-zinc-100 text-zinc-950'
                        : locked
                          ? 'cursor-not-allowed border-zinc-800 text-zinc-700'
                          : 'border-zinc-700 text-transparent hover:border-zinc-100 hover:text-zinc-100'
                    }`}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {hasWindow && (
                <p className="mt-2 text-xs text-zinc-500">
                  {locked ? 'Available' : 'Window'}{' '}
                  {formatHHMM(goal.window_start)}–{formatHHMM(goal.window_end)}
                </p>
              )}

              <div className="mt-3 border-t border-zinc-800 pt-3">
                <ReminderTimeField
                  table="goals"
                  rowId={goal.id}
                  value={goal.reminder_time}
                />
              </div>
            </MotionCard>
          )
        })}
        </AnimatePresence>
      </div>

      <Card className="space-y-3">
        <form onSubmit={handleAddGoal} className="space-y-3">
          <TextInput
            type="text"
            value={newGoalText}
            onChange={(e) => setNewGoalText(e.target.value)}
            placeholder="Add a goal or affirmation…"
          />

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-32 flex-1">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Window start (optional)
              </label>
              <TextInput
                type="time"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
              />
            </div>
            <div className="min-w-32 flex-1">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Window end
              </label>
              <TextInput
                type="time"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" disabled={addingGoal || !newGoalText.trim()}>
            <PlusIcon className="h-4 w-4" />
            {addingGoal ? 'Adding…' : 'Add goal'}
          </Button>
        </form>
      </Card>

      <AiGoalSuggestions onAdd={(text) => createGoal(text)} />

      {allConfirmed && (
        <p className="text-center text-sm font-medium text-zinc-100">
          All goals done. Streak continues.
        </p>
      )}
    </div>
  )
}

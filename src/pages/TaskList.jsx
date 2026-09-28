import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Button,
  Card,
  EmptyState,
  MotionCard,
  PageHeader,
  StatusPill,
  TextArea,
  TextInput,
  ToggleChip,
} from '../components/ui'
import { ReminderTimeField } from '../components/ReminderTimeField'
import {
  CameraIcon,
  ChecklistIcon,
  ClipboardIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  TrashIcon,
} from '../components/icons'
import { formatHHMM } from '../lib/time'

const todayKey = () => new Date().toISOString().slice(0, 10)

function TaskForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? todayKey())
  const [dueTime, setDueTime] = useState(initial?.due_time ?? '')
  const [wantsPhoto, setWantsPhoto] = useState(initial?.proof_required?.photo ?? false)
  const [wantsGps, setWantsGps] = useState(initial?.proof_required?.gps ?? false)
  const [wantsChecklist, setWantsChecklist] = useState(
    (initial?.proof_required?.checklist?.length ?? 0) > 0,
  )
  const [checklistText, setChecklistText] = useState(
    (initial?.proof_required?.checklist ?? []).join('\n'),
  )
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    setSubmitting(true)
    try {
      const checklist = wantsChecklist
        ? checklistText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        : []

      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || null,
        due_date: dueDate,
        due_time: dueTime || null,
        proof_required: {
          photo: wantsPhoto,
          gps: wantsGps,
          checklist,
        },
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <TextInput
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title…"
        autoFocus
      />
      <TextArea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Description (optional)"
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-32 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Due date
          </label>
          <TextInput
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="min-w-32 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Due time (optional)
          </label>
          <TextInput
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">
          Proof required
        </label>
        <div className="flex flex-wrap gap-2">
          <ToggleChip active={wantsPhoto} onClick={() => setWantsPhoto((v) => !v)}>
            <CameraIcon className="h-3.5 w-3.5" />
            Photo
          </ToggleChip>
          <ToggleChip active={wantsGps} onClick={() => setWantsGps((v) => !v)}>
            <PinIcon className="h-3.5 w-3.5" />
            Location
          </ToggleChip>
          <ToggleChip
            active={wantsChecklist}
            onClick={() => setWantsChecklist((v) => !v)}
          >
            <ChecklistIcon className="h-3.5 w-3.5" />
            Checklist
          </ToggleChip>
        </div>
      </div>

      {wantsChecklist && (
        <TextArea
          value={checklistText}
          onChange={(e) => setChecklistText(e.target.value)}
          rows={3}
          placeholder="One step per line…"
        />
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !title.trim()}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" className="w-auto px-4" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

function AddTaskForm({ userId, onCreated }) {
  const [open, setOpen] = useState(false)

  async function handleCreate(values) {
    await supabase.from('tasks').insert({
      assigned_to: userId,
      status: 'pending',
      ...values,
    })
    setOpen(false)
    onCreated()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-800 py-3.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
      >
        <PlusIcon className="h-4 w-4" />
        New task
      </button>
    )
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">New task</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </button>
      </div>
      <TaskForm onSubmit={handleCreate} submitLabel="Create task" />
    </Card>
  )
}

function ProofBadges({ proofRequired }) {
  if (!proofRequired) return null
  const badges = []
  if (proofRequired.photo) badges.push({ key: 'photo', icon: CameraIcon })
  if (proofRequired.gps) badges.push({ key: 'gps', icon: PinIcon })
  if (proofRequired.checklist?.length) badges.push({ key: 'checklist', icon: ChecklistIcon })
  if (badges.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 text-zinc-500">
      {badges.map(({ key, icon: BadgeIcon }) => (
        <BadgeIcon key={key} className="h-3.5 w-3.5" />
      ))}
    </div>
  )
}

export function TaskList() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingTaskId, setEditingTaskId] = useState(null)

  async function loadTasks(userId) {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userId)
      .eq('due_date', todayKey())
    setTasks(data ?? [])
  }

  useEffect(() => {
    if (!user) return
    loadTasks(user.id).then(() => setLoading(false))
  }, [user])

  async function handleUpdateTask(taskId, values) {
    await supabase.from('tasks').update(values).eq('id', taskId)
    setEditingTaskId(null)
    await loadTasks(user.id)
  }

  async function handleDeleteTask(taskId) {
    await supabase.from('tasks').delete().eq('id', taskId)
    await loadTasks(user.id)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Today"
        title="Tasks"
        subtitle="Complete each task with proof to keep your trust score clean."
      />

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && tasks.length === 0 && (
        <EmptyState
          icon={<ClipboardIcon className="h-6 w-6" />}
          title="No tasks for today"
          subtitle="Add one below to get started."
        />
      )}

      <div className="space-y-3">
        <AnimatePresence initial={false}>
        {tasks.map((task) => {
          if (editingTaskId === task.id) {
            return (
              <Card key={task.id}>
                <TaskForm
                  initial={task}
                  submitLabel="Save"
                  onCancel={() => setEditingTaskId(null)}
                  onSubmit={(values) => handleUpdateTask(task.id, values)}
                />
              </Card>
            )
          }

          return (
            <MotionCard key={task.id}>
              <div className="flex items-start justify-between gap-3">
                <Link to={`/tasks/${task.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    {task.due_time && (
                      <p className="text-xs text-zinc-500">
                        Due {formatHHMM(task.due_time)}
                      </p>
                    )}
                    <ProofBadges proofRequired={task.proof_required} />
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => setEditingTaskId(task.id)}
                    aria-label="Edit task"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    aria-label="Delete task"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                  <StatusPill status={task.status} />
                </div>
              </div>
              <div
                className="mt-3 border-t border-zinc-800 pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                <ReminderTimeField
                  table="tasks"
                  rowId={task.id}
                  value={task.reminder_time}
                />
              </div>
            </MotionCard>
          )
        })}
        </AnimatePresence>
      </div>

      <AddTaskForm userId={user?.id} onCreated={() => loadTasks(user.id)} />
    </div>
  )
}

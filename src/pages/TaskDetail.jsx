import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { distanceMeters, getCurrentPosition } from '../lib/geo'
import { formatHHMM } from '../lib/time'
import { Button, MotionCard, PageHeader, StatusPill } from '../components/ui'
import { CameraIcon, ChecklistIcon, HeartPulseIcon, PinIcon } from '../components/icons'

const DURATION_ANOMALY_RATIO = 0.4 // flag if actual is <40% or >250% of expected

export function TaskDetail() {
  const { taskId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [task, setTask] = useState(null)
  const [template, setTemplate] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [photoFile, setPhotoFile] = useState(null)
  const [startedAt] = useState(Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()
      if (!taskData) return
      setTask(taskData)

      // Manager-assigned tasks carry proof/duration config on a shared
      // task_templates row; self-serve tasks carry it directly on the task.
      let templateData
      if (taskData.template_id) {
        const { data } = await supabase
          .from('task_templates')
          .select('*')
          .eq('id', taskData.template_id)
          .single()
        templateData = data
      } else {
        templateData = {
          title: taskData.title,
          description: taskData.description,
          proofRequired: taskData.proof_required,
          expectedDurationMinutes: null,
          locationLat: null,
          locationLng: null,
          radiusMeters: null,
        }
      }

      if (templateData) {
        // Normalize manager-assigned rows (snake_case from Postgres) onto
        // the same shape self-serve tasks already use above.
        const normalized = taskData.template_id
          ? {
              title: templateData.title,
              description: templateData.description,
              proofRequired: templateData.proof_required,
              expectedDurationMinutes: templateData.expected_duration_minutes,
              locationLat: templateData.location_lat,
              locationLng: templateData.location_lng,
              radiusMeters: templateData.radius_meters,
            }
          : templateData

        setTemplate(normalized)
        setChecklist(
          (normalized.proofRequired?.checklist ?? []).map((step) => ({
            step,
            done: false,
          })),
        )
      }
    }
    load()
  }, [taskId])

  function toggleChecklistStep(index) {
    setChecklist((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, done: !item.done } : item,
      ),
    )
  }

  async function handleComplete() {
    setError('')
    setSubmitting(true)
    try {
      const durationMinutes = Math.round((Date.now() - startedAt) / 60000)
      let photoUrls = []
      let gpsLat = null
      let gpsLng = null
      let flagged = false
      const flagReasons = []

      if (template?.proofRequired?.photo && photoFile) {
        const path = `${taskId}/${Date.now()}-${photoFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(path, photoFile)
        if (uploadError) throw uploadError

        const { data: signedUrl } = await supabase.storage
          .from('submissions')
          .createSignedUrl(path, 60 * 60 * 24 * 365)
        photoUrls = signedUrl ? [signedUrl.signedUrl] : []
      } else if (template?.proofRequired?.photo && !photoFile) {
        setError('A photo is required to complete this task.')
        setSubmitting(false)
        return
      }

      if (template?.proofRequired?.gps) {
        const pos = await getCurrentPosition()
        gpsLat = pos.lat
        gpsLng = pos.lng
        if (template.locationLat != null && template.locationLng != null) {
          const dist = distanceMeters(
            pos.lat,
            pos.lng,
            template.locationLat,
            template.locationLng,
          )
          if (dist > (template.radiusMeters ?? 100)) {
            flagged = true
            flagReasons.push(
              `Location ${Math.round(dist)}m from job site (limit ${template.radiusMeters}m)`,
            )
          }
        }
      }

      if (template?.proofRequired?.checklist?.length) {
        const incomplete = checklist.filter((c) => !c.done)
        if (incomplete.length > 0) {
          setError('Complete all checklist steps before submitting.')
          setSubmitting(false)
          return
        }
      }

      if (template?.expectedDurationMinutes) {
        const ratio = durationMinutes / template.expectedDurationMinutes
        if (ratio < DURATION_ANOMALY_RATIO || ratio > 2.5) {
          flagged = true
          flagReasons.push(
            `Duration ${durationMinutes}min vs expected ${template.expectedDurationMinutes}min`,
          )
        }
      }

      await supabase.from('submissions').insert({
        task_id: taskId,
        user_id: user.id,
        duration_minutes: durationMinutes,
        photo_urls: photoUrls,
        gps_lat: gpsLat,
        gps_lng: gpsLng,
        flagged,
        flag_reason: flagReasons.join('; ') || null,
      })

      await supabase
        .from('tasks')
        .update({ status: flagged ? 'flagged' : 'completed' })
        .eq('id', taskId)

      navigate('/tasks')
    } catch (err) {
      setError(err.message ?? 'Something went wrong submitting this task.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!task) return <p className="text-sm text-zinc-500">Loading…</p>

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={task.due_time ? `Due ${formatHHMM(task.due_time)}` : 'Task'}
        title={template?.title ?? task.title}
        subtitle={template?.description}
        action={<StatusPill status={task.status} />}
      />

      {template?.proofRequired?.checklist?.length > 0 && (
        <MotionCard>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <ChecklistIcon className="h-4 w-4 text-zinc-400" />
            Checklist
          </h2>
          <ul className="space-y-2">
            {checklist.map((item, i) => (
              <li key={item.step}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleChecklistStep(i)}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-zinc-100"
                  />
                  {item.step}
                </label>
              </li>
            ))}
          </ul>
        </MotionCard>
      )}

      {template?.proofRequired?.photo && (
        <MotionCard>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <CameraIcon className="h-4 w-4 text-zinc-400" />
            Photo proof
          </h2>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-zinc-400"
          />
        </MotionCard>
      )}

      {template?.proofRequired?.gps && (
        <MotionCard>
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <PinIcon className="h-4 w-4 text-zinc-400" />
            Location
          </h2>
          <p className="text-xs text-zinc-500">
            Captured automatically when you complete this task.
          </p>
        </MotionCard>
      )}

      <MotionCard className="opacity-60">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <HeartPulseIcon className="h-4 w-4 text-zinc-400" />
          Heart-rate verification
          <span className="ml-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            Coming soon
          </span>
        </h2>
        <p className="text-xs text-zinc-500">
          A future proof type: confirm a task was actually done using a heart-rate
          signal from your phone camera or a paired wearable, alongside photo and
          checklist proof.
        </p>
      </MotionCard>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button onClick={handleComplete} disabled={submitting}>
        {submitting ? 'Submitting…' : 'Complete task'}
      </Button>
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { AlarmIcon } from './icons'

export function ReminderTimeField({ table, rowId, value }) {
  const [time, setTime] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  async function handleChange(e) {
    const next = e.target.value
    setTime(next)
    setSaving(true)
    await supabase
      .from(table)
      .update({ reminder_time: next || null })
      .eq('id', rowId)
    setSaving(false)
  }

  return (
    <label className="flex items-center gap-2 text-xs text-zinc-400">
      <AlarmIcon className="h-3.5 w-3.5" />
      <span>Alarm</span>
      <input
        type="time"
        value={time}
        onChange={handleChange}
        className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-400"
      />
      {saving && <span className="text-zinc-600">saving…</span>}
    </label>
  )
}

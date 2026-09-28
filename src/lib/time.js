export function currentHHMM() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Window end can be earlier than start (e.g. 22:00–02:00) to span midnight.
export function isWithinWindow(start, end, atHHMM = currentHHMM()) {
  if (!start || !end) return true
  if (start <= end) return atHHMM >= start && atHHMM <= end
  return atHHMM >= start || atHHMM <= end
}

export function formatHHMM(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

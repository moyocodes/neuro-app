// Runs on a schedule (pg_cron, every minute — see 0004_schedule_reminders.sql).
// Finds goals/tasks whose effective reminder time matches the current
// minute, and sends a Web Push notification to each of that user's
// subscriptions. The note (why it fired) is the goal text or task
// description, shown in the notification body by public/push-sw.js.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails(
  'mailto:noreply@example.com',
  vapidPublicKey,
  vapidPrivateKey,
)

const supabase = createClient(supabaseUrl, serviceRoleKey)

function currentHHMM() {
  const now = new Date()
  return `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
}

async function sendToUser(userId: string, title: string, note: string, url: string) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({ title, note, url }),
      )
    } catch (err) {
      // 404/410 means the subscription is gone (browser data cleared,
      // uninstalled, etc.) — clean it up so we stop retrying it forever.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
}

Deno.serve(async () => {
  const hhmm = currentHHMM()

  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('active', true)
    .eq('notify_enabled', true)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .eq('notify_enabled', true)

  const dueGoals = (goals ?? []).filter(
    (g) => (g.reminder_time ?? g.window_start ?? '09:00') === hhmm,
  )
  const dueTasks = (tasks ?? []).filter(
    (t) => (t.reminder_time ?? t.due_time ?? '09:00') === hhmm,
  )

  await Promise.all([
    ...dueGoals.map((g) =>
      sendToUser(g.user_id, 'Goal reminder', g.text, '/goals'),
    ),
    ...dueTasks.map((t) =>
      sendToUser(
        t.assigned_to,
        `Task due: ${t.title}`,
        t.description ?? t.title,
        `/tasks/${t.id}`,
      ),
    ),
  ])

  return new Response(
    JSON.stringify({ checked: hhmm, goals: dueGoals.length, tasks: dueTasks.length }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})

# Habit & Task Verification

A personal habit and to-do app: a daily goal checklist for habit
formation, plus proof-of-completion task verification. Built for
self-use — you create and manage your own goals and tasks, no
manager/team account required. (The original concept had a
manager-assigns-tasks-to-a-team model; that code path still exists — see
"Manager/team mode" below — but it's not the primary experience.)

React + Vite PWA, Tailwind CSS, Framer Motion, Supabase (Auth, Postgres,
Storage, Edge Functions), Claude API (AI goal suggestions), Web Push for
alarms.

## Design system

Monochrome — zinc grey scale, no brand hue (no green/blue/etc; `amber` is
kept only as a semantic warning color for flags). Custom components only,
no UI kit — see [src/components/ui.jsx](src/components/ui.jsx)
(`Card`/`MotionCard`, `Button`, `IconButton`, `PageHeader`, `EmptyState`,
`ToggleChip`, `TextInput`/`TextArea`) and
[src/components/icons.jsx](src/components/icons.jsx) (hand-drawn inline
SVG icons, no icon library). Framer Motion drives the "alive" feel
throughout: tap/hover feedback on every button, spring-animated card
enter/exit (`AnimatePresence` on goal and task lists so add/delete
animate rather than snap), and a sliding pill indicator on the bottom nav
(`layoutId`-based).

## Screen flow

Login/Signup → Today's Goals (checklist) → Task List → Task Detail
(complete + proof) → Daily Summary → (optional, manager role only)
Dashboard

## Why Supabase, not Firebase

This app started on Firebase. It moved to Supabase specifically so
scheduled background alarms (below) don't require a paid plan — Firebase
needs the Blaze (pay-as-you-go) plan for scheduled Cloud Functions,
Supabase's `pg_cron` + Edge Functions cover the same job on the free
tier. Everything else (Auth, database, file storage, RLS) is a
like-for-like swap; see [supabase/migrations/](supabase/migrations/) for
the full schema translated from the original Firestore data model.

## Setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
3. Run the SQL migrations against your project, in order, via the SQL
   Editor (Dashboard → SQL Editor → New query → paste → Run) or the CLI
   (`npx supabase login && npx supabase link --project-ref <ref> && npx
   supabase db push`):
   - [0001_init.sql](supabase/migrations/0001_init.sql) — core schema +
     RLS
   - [0002_fix_manager_recursion.sql](supabase/migrations/0002_fix_manager_recursion.sql) —
     fixes infinite-recursion in the manager-role RLS check (Postgres
     error `42P17`) by moving it into a `SECURITY DEFINER` function
   - [0003_push_and_auto_reminders.sql](supabase/migrations/0003_push_and_auto_reminders.sql) —
     push subscriptions table + default-on reminder columns
   - [0004_schedule_reminders.sql](supabase/migrations/0004_schedule_reminders.sql) —
     `pg_cron` schedule for the reminder Edge Function (run this **after**
     deploying the function — see "Reminders" below; it needs the
     deployed URL and a real service_role key filled in by hand, don't
     commit those values)
4. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

5. Sign up in the app (`/signup`) to create your account. That's it —
   goals and tasks are self-serve from there, no manager account needed.
   A database trigger (`handle_new_user` in `0001_init.sql`) creates your
   `profiles` row automatically.

## Data model (Postgres)

- `profiles` — one row per `auth.users` row (created automatically on
  signup). name, email, role (`manager` | `member`, see "Manager/team
  mode"), team_id, streak_count, longest_streak, trust_score,
  last_login_at
- `goals` — user_id, text, active, window_start/window_end (recitation
  time window, optional), reminder_time (optional alarm),
  notify_enabled
- `recitations` — user_id, goal_id, date, confirmed_at (one row per goal
  marked done per day)
- `tasks` — assigned_to, title, description, due_date, due_time
  (optional), status (`pending` | `completed` | `flagged`),
  proof_required (jsonb: `{photo, gps, checklist}`), reminder_time
  (optional), notify_enabled. Self-serve tasks carry their proof config
  directly on the row; manager-assigned tasks (v2) instead reference
  `template_id` → `task_templates`.
- `task_templates` — created_by, title, description, proof_required,
  expected_duration_minutes, location_lat/lng, radius_meters. Only used
  by manager/team mode (v2) — self-serve tasks don't create these.
- `submissions` — task_id, user_id, completed_at, duration_minutes,
  photo_urls, gps_lat/lng, flagged, flag_reason
- `login_events` — user_id, at, user_agent. One row per login;
  `profiles.last_login_at` is the fast-read summary of the most recent
  one.
- `push_subscriptions` — user_id, endpoint, subscription (jsonb Web Push
  subscription object). One row per browser/device registered for
  alarms.

All tables have row-level security scoping reads/writes to the signed-in
user (or a manager, for team-mode reads) — see the migrations for the
exact policies.

## Goals: daily checklist with a recitation window

Goals recur daily — check one off (`recitations`) each day it applies. An
optional `window_start`/`window_end` time range constrains *when* a goal
can be marked done (e.g. only between 6:00–9:00 AM); outside that window
the checkbox is disabled. Set the window when adding a goal, or edit it
later (pencil icon on the goal card). This is separate from
`reminder_time`, which just fires a push notification — the window is an
enforcement rule, the reminder is a nudge.

## Tasks: one-off to-dos with a deadline

Unlike goals, tasks are one-off — a `due_date` and optional `due_time`
give it a real deadline instead of a recurring schedule. Add one from the
Tasks screen ("+ New task"): title, description, due date/time, and
which proof types to require (photo, GPS, checklist steps). Edit
(pencil) or delete (trash) any task you own from the list.

## Full CRUD

Goals and tasks both support create, read, update, and delete from the
UI — not just create. Edit and delete icons appear on each goal/task
card, scoped to the signed-in user's own rows by RLS.

## AI goal suggestions

On Today's Goals, "Suggest goals with AI" turns a vague intent ("be more
patient", "exercise more") into 3–5 concrete, daily-recitable goal
suggestions you can add with one tap — see
[src/lib/anthropic.js](src/lib/anthropic.js) and the `AiGoalSuggestions`
component in [TodaysGoals.jsx](src/pages/TodaysGoals.jsx). Uses the Claude
API (`claude-haiku-4-5`) — cheap for this (short prompt in, a few short
strings out — a fraction of a cent per request) but not free; you need
your own API key with billing enabled at
[console.anthropic.com](https://console.anthropic.com), set as
`VITE_ANTHROPIC_API_KEY` in `.env`.

**This calls the Anthropic API directly from the browser** (no backend —
your API key ships in the built JS bundle and anyone with devtools
access to your deployed site could read and reuse it). Fine for running
this yourself locally or on a private deployment only you use; never
deploy this build somewhere the public can reach it without moving this
call behind a backend first.

`suggestGoals` strips a ```` ```json ````/```` ``` ```` fence before
parsing — Claude sometimes wraps the array in a markdown code fence
despite the system prompt asking for raw JSON, and an unguarded
`JSON.parse` on that fenced text throws, is caught, and silently returns
no suggestions.

## Verification signals

Implemented client-side in [src/pages/TaskDetail.jsx](src/pages/TaskDetail.jsx):

- **Location distance** — compares GPS at submission against the task
  template's saved location; flags if beyond `radius_meters`.
- **Duration anomalies** — flags tasks completed in <40% or >250% of
  `expected_duration_minutes`.

Trust score and cross-submission pattern analysis (flag frequency,
time-of-day, proof consistency) aren't implemented yet — the client only
writes `flagged`/`flag_reason` on the submission and task rows.

## Login tracking

Every successful login (via [AuthContext.jsx](src/context/AuthContext.jsx)'s
`recordLogin`) writes a `login_events` row (timestamp + user agent) and
updates `profiles.last_login_at`. Managers see each team member's last
login and a "View login history" expander (last 5 logins) on the
[Dashboard](src/pages/Dashboard.jsx). Members can only read their own
login events — enforced by RLS.

This does not capture IP address or failed login attempts — IP isn't
available client-side; would need to be captured server-side (e.g. an
Edge Function on the auth webhook) in a later pass.

## Manager/team mode (optional, not the primary experience)

The original concept for this app was a manager-assigns-tasks-to-a-team
tool with per-user trust scores. That data model and UI still exist
([Dashboard.jsx](src/pages/Dashboard.jsx), `task_templates`,
`trust_score`, `team_id`) but this app is built and used as a **self**
app — you manage your own goals/tasks, no manager needed. To use team
mode instead: set `role = 'manager'` and a shared `team_id` on the
relevant `profiles` rows by hand in the Supabase table editor or SQL
Editor (signup always creates `role = 'member'` — client updates can
never change `role`/`trust_score`, enforced by the
`protect_profile_privileged_columns` trigger in `0001_init.sql`), then a
manager account sees the team Dashboard link and can create
`task_templates` for others. This path is unmaintained relative to the
self-serve flow and not verified working end-to-end — treat it as a
starting point, not a finished feature.

## Reminders / alarms with notes

Every goal and task alarms automatically — no per-item opt-in required.
The effective alarm time is `reminder_time` if you've set one, else the
goal's `window_start` or the task's `due_time`, else 09:00 (see
`effective_reminder_time_goals`/`_tasks` in `0003_push_and_auto_reminders.sql`
and the equivalent filter logic in the Edge Function). Turn a specific
item's alarm off via its `notify_enabled` flag without deleting it (not
yet wired to a UI toggle — currently a direct DB edit).

A scheduled Edge Function
([supabase/functions/send-reminders/index.ts](supabase/functions/send-reminders/index.ts))
runs every minute via `pg_cron`, finds anything due at that minute, and
sends a Web Push notification to every device you've registered — the
notification body includes the goal text or task description as the
note explaining why it fired. This works even when the app is fully
closed, unlike an in-page timer, and needs no paid plan.

Setup:

1. Generate a VAPID key pair:

   ```bash
   npx web-push generate-vapid-keys
   ```

   Put the **public** key in `.env` as `VITE_VAPID_PUBLIC_KEY`. The
   **private** key is a server secret — never put it in `.env` or commit
   it anywhere; it goes into Supabase's Edge Function secrets in step 3.

2. Log in and link the Supabase CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```

3. Set the Edge Function secrets (the private VAPID key plus the two the
   function needs to call Supabase itself with elevated access):

   ```bash
   npx supabase secrets set \
     VAPID_PUBLIC_KEY=<public key from step 1> \
     VAPID_PRIVATE_KEY=<private key from step 1>
   ```

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available
   to every Edge Function automatically — no need to set those.

4. Deploy the function:

   ```bash
   npx supabase functions deploy send-reminders
   ```

5. Run [0004_schedule_reminders.sql](supabase/migrations/0004_schedule_reminders.sql)
   in the SQL Editor, with `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>`
   (Project Settings → API → service_role — **not** the anon key) filled
   in by hand. This is the one migration file that intentionally isn't
   safe to commit with real values — keep the placeholders in git,
   fill them in only in the editor when you run it.

6. In the app, open Today's Goals and tap **Enable reminders** to grant
   notification permission and register this device — this registers a
   `push_subscriptions` row via
   [src/lib/messaging.js](src/lib/messaging.js) and
   [public/push-sw.js](public/push-sw.js).

Notes:

- The Edge Function currently checks reminder times against **UTC** for
  all users (see `currentHHMM()` in the function). Add a per-user
  `time_zone` column and pass it there if your users span time zones.
- iOS requires the PWA to be installed via Add to Home Screen (Safari
  tabs don't support push); notification permission must be granted from
  within the installed app.
- `enableReminderNotifications` in
  [src/lib/messaging.js](src/lib/messaging.js) waits for the registered
  service worker to reach `activated` state before subscribing — without
  this, `pushManager.subscribe()` can fail with "Subscription failed -
  no active Service Worker" if it runs right after `register()` returns.

## Install as a PWA (iPhone)

Safari → Share → Add to Home Screen. Apple Watch does not support PWAs; a
watch companion would need a native Swift/WatchKit app.

## Still needed before this is production-ready

- Streak counting (`streak_count`/`longest_streak` on `profiles`) has no
  writer yet — nothing currently increments it when goals are completed
  or resets it when a day is missed
- Trust score / cross-submission pattern analysis not implemented (see
  Verification signals above)
- PWA icons at `public/icons/icon-192.png` and `icon-512.png` (referenced
  in `vite.config.js` but not yet generated)
- Per-user time zone for reminders (see note above — currently UTC for
  everyone)
- `notify_enabled` has no UI toggle yet — currently a direct DB edit to
  silence a specific item's alarm
- Login tracking captures successful logins only, no IP or failed
  attempts (see Login tracking section above)
- AI goal suggestions call the Claude API directly from the browser with
  a client-exposed API key — personal-use only, needs a backend before
  any public deployment (see AI goal suggestions section above)
- Manager/team mode (Dashboard, trust score, task_templates) is present
  but unmaintained relative to the self-serve flow — see that section
  above

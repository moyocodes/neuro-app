-- Web Push subscriptions (replaces Firebase Cloud Messaging tokens) plus
-- default-on reminders: every goal/task notifies automatically unless the
-- user has explicitly turned it off, instead of requiring an opt-in time
-- per item.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_self"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy "push_subscriptions_insert_self"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "push_subscriptions_update_self"
  on public.push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_subscriptions_delete_self"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- Every goal/task alarms by default — reminder_time is now derived, not
-- opt-in. A goal alarms at its window_start (falling back to 09:00 if no
-- window is set); a task alarms at its due_time (falling back to 09:00 on
-- its due_date). notify_enabled lets a user turn a specific item's alarm
-- off without deleting the item.
alter table public.goals add column notify_enabled boolean not null default true;
alter table public.tasks add column notify_enabled boolean not null default true;

create or replace function public.effective_reminder_time_goals(g public.goals)
returns time
language sql
stable
as $$
  select coalesce(g.reminder_time, g.window_start, '09:00'::time);
$$;

create or replace function public.effective_reminder_time_tasks(t public.tasks)
returns time
language sql
stable
as $$
  select coalesce(t.reminder_time, t.due_time, '09:00'::time);
$$;

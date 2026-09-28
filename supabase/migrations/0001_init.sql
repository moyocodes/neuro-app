-- Habit & Task Verification — initial schema
-- Mirrors the Firestore data model (see README) on Postgres + RLS.
-- Auth is Supabase Auth; auth.uid() replaces Firebase's request.auth.uid.

create extension if not exists "pgcrypto";

-- profiles ---------------------------------------------------------------
-- One row per auth.users row, created by the handle_new_user trigger below
-- (mirrors Firestore's "users/{uid}" doc created at signup).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'member' check (role in ('member', 'manager')),
  team_id uuid,
  streak_count integer not null default 0,
  longest_streak integer not null default 0,
  trust_score integer not null default 100,
  last_login_at timestamptz,
  fcm_tokens text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_self_or_manager"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

-- Self-signup: a user may insert only their own row, only as an
-- unprivileged member with the default trust score — mirrors the
-- Firestore rule that blocked self-assigning role/trustScore.
create policy "profiles_insert_self_unprivileged"
  on public.profiles for insert
  with check (id = auth.uid() and role = 'member' and trust_score = 100);

-- Users may touch only their own bookkeeping columns. Role/trust_score
-- changes must go through a trusted server context (service_role key),
-- never a client update — Postgres RLS has no column-level granularity
-- for UPDATE, so this is enforced by the set_updatable_profile_fields
-- trigger below instead of the policy itself.
create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  -- Client updates may not change role or trust_score.
  new.role := old.role;
  new.trust_score := old.trust_score;
  return new;
end;
$$;

create trigger protect_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- Auto-create a profile row when a new auth user signs up. The client
-- passes name via signUp's options.data so this trigger can read it.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- login_events -------------------------------------------------------------
create table public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  user_agent text
);

alter table public.login_events enable row level security;

create policy "login_events_select_self_or_manager"
  on public.login_events for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

create policy "login_events_insert_self"
  on public.login_events for insert
  with check (user_id = auth.uid());

-- goals ----------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  active boolean not null default true,
  window_start time,
  window_end time,
  reminder_time time,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "goals_select_self_or_manager"
  on public.goals for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

create policy "goals_insert_self"
  on public.goals for insert
  with check (user_id = auth.uid());

create policy "goals_update_self"
  on public.goals for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "goals_delete_self"
  on public.goals for delete
  using (user_id = auth.uid());

-- recitations ------------------------------------------------------------
create table public.recitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  date date not null,
  confirmed_at timestamptz not null default now()
);

alter table public.recitations enable row level security;

create policy "recitations_select_self_or_manager"
  on public.recitations for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

create policy "recitations_insert_self"
  on public.recitations for insert
  with check (user_id = auth.uid());

-- task_templates -----------------------------------------------------------
-- Manager/team mode only (v2) — self-serve tasks don't create these.
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  proof_required jsonb not null default '{"photo": false, "gps": false, "checklist": []}',
  expected_duration_minutes integer,
  location_lat double precision,
  location_lng double precision,
  radius_meters integer,
  created_at timestamptz not null default now()
);

alter table public.task_templates enable row level security;

create policy "task_templates_select_signed_in"
  on public.task_templates for select
  using (auth.uid() is not null);

create policy "task_templates_write_manager"
  on public.task_templates for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

-- tasks ------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.task_templates (id) on delete set null,
  assigned_to uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  due_time time,
  reminder_time time,
  status text not null default 'pending' check (status in ('pending', 'completed', 'flagged')),
  proof_required jsonb not null default '{"photo": false, "gps": false, "checklist": []}',
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks_select_assignee_or_manager"
  on public.tasks for select
  using (
    assigned_to = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

-- Self-serve: a user creates their own task; a manager may create one for
-- someone else (manager-assigns model, kept for v2 team use).
create policy "tasks_insert_self_or_manager"
  on public.tasks for insert
  with check (
    assigned_to = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

create policy "tasks_update_assignee_or_manager"
  on public.tasks for update
  using (
    assigned_to = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  )
  with check (
    -- Assignees may edit their own task's content/status/reminder but
    -- never reassign it to someone else.
    assigned_to = (select t.assigned_to from public.tasks t where t.id = id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

create policy "tasks_delete_assignee_or_manager"
  on public.tasks for delete
  using (
    assigned_to = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

-- submissions --------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  duration_minutes integer,
  photo_urls text[] not null default '{}',
  gps_lat double precision,
  gps_lng double precision,
  flagged boolean not null default false,
  flag_reason text
);

alter table public.submissions enable row level security;

create policy "submissions_select_self_or_manager"
  on public.submissions for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

create policy "submissions_insert_self"
  on public.submissions for insert
  with check (user_id = auth.uid());

-- Storage: a "submissions" bucket replaces Firebase Storage for photo
-- proof uploads, path-scoped as submissions/{task_id}/{filename}.
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

create policy "submissions_bucket_read_signed_in"
  on storage.objects for select
  using (bucket_id = 'submissions' and auth.uid() is not null);

create policy "submissions_bucket_write_signed_in"
  on storage.objects for insert
  with check (bucket_id = 'submissions' and auth.uid() is not null);

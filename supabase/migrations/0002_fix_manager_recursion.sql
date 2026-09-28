-- Fix: profiles_select_self_or_manager (and every other table's manager
-- check) queried public.profiles from inside a policy ON public.profiles,
-- which re-triggers that same policy — infinite recursion (Postgres
-- error 42P17). A SECURITY DEFINER function bypasses RLS internally, so
-- the manager check no longer re-enters the policy it's used from.

create function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'
  );
$$;

-- profiles ---------------------------------------------------------------
drop policy "profiles_select_self_or_manager" on public.profiles;
create policy "profiles_select_self_or_manager"
  on public.profiles for select
  using (id = auth.uid() or public.is_manager());

-- login_events -------------------------------------------------------------
drop policy "login_events_select_self_or_manager" on public.login_events;
create policy "login_events_select_self_or_manager"
  on public.login_events for select
  using (user_id = auth.uid() or public.is_manager());

-- goals ----------------------------------------------------------------
drop policy "goals_select_self_or_manager" on public.goals;
create policy "goals_select_self_or_manager"
  on public.goals for select
  using (user_id = auth.uid() or public.is_manager());

-- recitations ------------------------------------------------------------
drop policy "recitations_select_self_or_manager" on public.recitations;
create policy "recitations_select_self_or_manager"
  on public.recitations for select
  using (user_id = auth.uid() or public.is_manager());

-- task_templates -----------------------------------------------------------
drop policy "task_templates_write_manager" on public.task_templates;
create policy "task_templates_write_manager"
  on public.task_templates for all
  using (public.is_manager())
  with check (public.is_manager());

-- tasks ------------------------------------------------------------------
drop policy "tasks_select_assignee_or_manager" on public.tasks;
create policy "tasks_select_assignee_or_manager"
  on public.tasks for select
  using (assigned_to = auth.uid() or public.is_manager());

drop policy "tasks_insert_self_or_manager" on public.tasks;
create policy "tasks_insert_self_or_manager"
  on public.tasks for insert
  with check (assigned_to = auth.uid() or public.is_manager());

drop policy "tasks_update_assignee_or_manager" on public.tasks;
create policy "tasks_update_assignee_or_manager"
  on public.tasks for update
  using (assigned_to = auth.uid() or public.is_manager())
  with check (
    assigned_to = (select t.assigned_to from public.tasks t where t.id = id)
    or public.is_manager()
  );

drop policy "tasks_delete_assignee_or_manager" on public.tasks;
create policy "tasks_delete_assignee_or_manager"
  on public.tasks for delete
  using (assigned_to = auth.uid() or public.is_manager());

-- submissions --------------------------------------------------------------
drop policy "submissions_select_self_or_manager" on public.submissions;
create policy "submissions_select_self_or_manager"
  on public.submissions for select
  using (user_id = auth.uid() or public.is_manager());

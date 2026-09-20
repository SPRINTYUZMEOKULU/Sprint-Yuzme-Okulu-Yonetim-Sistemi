-- SprintOS — Ortak seans / ayrı tut tercihi
begin;

create table if not exists public.lesson_shared_session_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id uuid not null references public.lesson_schedules(id) on delete cascade,
  mode text not null default 'auto' check (mode in ('auto','shared','separate')),
  lane_label text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, schedule_id)
);

create index if not exists lesson_shared_session_preferences_lookup
  on public.lesson_shared_session_preferences(organization_id, mode, schedule_id);

alter table public.lesson_shared_session_preferences enable row level security;

drop policy if exists lesson_shared_session_preferences_select on public.lesson_shared_session_preferences;
create policy lesson_shared_session_preferences_select
on public.lesson_shared_session_preferences
for select to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in (
    'owner','admin','branch_manager','registration_staff','accounting','coach'
  )
);

drop policy if exists lesson_shared_session_preferences_write on public.lesson_shared_session_preferences;
create policy lesson_shared_session_preferences_write
on public.lesson_shared_session_preferences
for all to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager')
);

commit;

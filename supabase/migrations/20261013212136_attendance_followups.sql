create table public.attendance_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  lesson_date date not null,
  start_time time not null,
  status text not null check (status in ('open','completed','removed')),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (organization_id,branch_id,lesson_date,start_time)
);
alter table public.attendance_followups enable row level security;
revoke all on public.attendance_followups from anon, authenticated;
grant select on public.attendance_followups to authenticated;
grant all on public.attendance_followups to service_role;
create policy attendance_followup_read on public.attendance_followups for select to authenticated
using (exists (
  select 1 from public.profiles p where p.id = (select auth.uid())
  and p.organization_id = attendance_followups.organization_id
  and p.role::text in ('owner','admin','branch_manager','registration_staff','accounting','coach')
));
comment on table public.attendance_followups is 'Dashboard followup acknowledgements only; does not change attendance or lesson rights.';

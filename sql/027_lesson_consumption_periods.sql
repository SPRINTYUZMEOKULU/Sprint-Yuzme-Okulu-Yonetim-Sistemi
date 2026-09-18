-- SprintOS: merkezi ders tüketimi, seans istisnaları ve kayıt dönemi görünümü
begin;

create table if not exists public.lesson_consumption_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.training_groups(id) on delete cascade,
  schedule_id uuid references public.lesson_schedules(id) on delete set null,
  lesson_date date not null,
  consume_right boolean not null default false,
  reason text not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, group_id, schedule_id, lesson_date)
);
create index if not exists lesson_consumption_exceptions_lookup_idx
  on public.lesson_consumption_exceptions(organization_id, lesson_date, group_id, schedule_id);
alter table public.lesson_consumption_exceptions enable row level security;
drop policy if exists lesson_consumption_exceptions_staff_all on public.lesson_consumption_exceptions;
create policy lesson_consumption_exceptions_staff_all on public.lesson_consumption_exceptions for all to authenticated
using (organization_id=public.current_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting','coach'))
with check (organization_id=public.current_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting','coach'));

create or replace view public.student_registration_periods as
select
  e.*,
  row_number() over (partition by e.student_id order by e.created_at, e.id) as period_number,
  count(*) over (partition by e.student_id) as total_periods
from public.student_enrollments e;

commit;

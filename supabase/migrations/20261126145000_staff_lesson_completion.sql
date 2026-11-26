alter table public.staff_checkins add column if not exists completed_at timestamptz;
alter table public.staff_checkins add column if not exists completed_by uuid;

-- Preserve the eligibility of pre-existing check-ins.
update public.staff_checkins
set completed_at = checked_in_at, completed_by = created_by
where completed_at is null;

create or replace function public.complete_staff_lesson(
  p_organization_id uuid,
  p_staff_id uuid,
  p_schedule_id uuid,
  p_lesson_date date
) returns text
language plpgsql
set search_path = ''
as $$
declare
  entry public.staff_checkins%rowtype;
begin
  select * into entry from public.staff_checkins
  where organization_id = p_organization_id
    and staff_id = p_staff_id and schedule_id = p_schedule_id and lesson_date = p_lesson_date
  for update;

  if not found or entry.approval_status = 'rejected' then
    return 'checkin_missing';
  end if;
  if entry.completed_at is not null then
    return 'completed';
  end if;
  if exists (
    select 1 from public.staff_payroll_periods p
    where p.organization_id = p_organization_id and p.staff_id = p_staff_id
      and p.period_month = date_trunc('month', p_lesson_date::timestamp)::date
      and p.status in ('awaiting_payment', 'paid', 'archived')
  ) then
    return 'period_closed';
  end if;
  if not exists (
    select 1 from public.attendance_records a
    where a.organization_id = p_organization_id and a.schedule_id = p_schedule_id
      and a.lesson_date = p_lesson_date and a.group_id = entry.group_id
  ) then
    return 'attendance_missing';
  end if;

  update public.staff_checkins
  set completed_at = now(), completed_by = created_by, updated_at = now()
  where id = entry.id;
  return 'completed';
end;
$$;

revoke all on function public.complete_staff_lesson(uuid, uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.complete_staff_lesson(uuid, uuid, uuid, date) to service_role;

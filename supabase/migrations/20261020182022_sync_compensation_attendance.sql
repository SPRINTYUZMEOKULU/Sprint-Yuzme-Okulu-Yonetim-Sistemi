-- Attendance is authoritative for a planned makeup's completion. Never alter
-- package totals or used_lessons here; makeup rights belong to the source period.
create or replace function public.sync_compensation_from_attendance()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.status = 'compensation' then
      update public.student_compensation_lessons c
      set status = 'planned', completed_at = null, completed_by = null, updated_at = now()
      where c.organization_id = old.organization_id
        and c.student_id = old.student_id
        and c.lesson_date = old.lesson_date
        and c.target_group_id = old.group_id
        and (c.target_schedule_id is null or c.target_schedule_id = old.schedule_id)
        and c.status = 'completed'
        and not exists (
          select 1 from public.attendance_records a
          where a.organization_id = c.organization_id and a.student_id = c.student_id
            and a.lesson_date = c.lesson_date and a.group_id = c.target_group_id
            and (c.target_schedule_id is null or a.schedule_id = c.target_schedule_id)
            and a.status = 'compensation'
        );
    end if;
  end if;
  if tg_op <> 'DELETE' then
    if new.status = 'compensation' then
      update public.student_compensation_lessons c
      set status = 'completed', completed_at = coalesce(c.completed_at, new.updated_at, now()),
          completed_by = coalesce(c.completed_by, new.updated_by, new.recorded_by), updated_at = now()
      where c.organization_id = new.organization_id
        and c.student_id = new.student_id
        and c.lesson_date = new.lesson_date
        and c.target_group_id = new.group_id
        and (c.target_schedule_id is null or c.target_schedule_id = new.schedule_id)
        and c.status = 'planned';
    end if;
    return new;
  end if;
  return old;
end;
$$;
revoke all on function public.sync_compensation_from_attendance() from public, anon;
grant execute on function public.sync_compensation_from_attendance() to authenticated, service_role;
create or replace trigger attendance_sync_compensation
  after insert or update or delete on public.attendance_records
  for each row execute function public.sync_compensation_from_attendance();

-- Repair the requested Sunday session only, using actual makeup attendance.
update public.student_compensation_lessons c
set status = 'completed', completed_at = a.updated_at,
    completed_by = coalesce(a.updated_by, a.recorded_by), updated_at = now()
from public.attendance_records a
where c.organization_id = '2aa21b5f-ba88-484e-b450-e50bcc7f2f7d'
  and c.lesson_date = '2026-10-18' and c.status = 'planned'
  and a.organization_id = c.organization_id and a.student_id = c.student_id
  and a.lesson_date = c.lesson_date and a.group_id = c.target_group_id
  and (c.target_schedule_id is null or a.schedule_id = c.target_schedule_id)
  and a.status = 'compensation';

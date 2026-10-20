-- A scheduled makeup is consumed whether the student attends or is absent.
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
    if old.status in ('compensation', 'present', 'absent', 'excused') then
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
            and a.status in ('compensation', 'present', 'absent', 'excused')
        );
    end if;
  end if;
  if tg_op <> 'DELETE' then
    if new.status in ('compensation', 'present', 'absent', 'excused') then
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

-- Reconcile the requested Sunday from all saved attendance, preserving each
-- attendance status (completion here means the right was used, not attendance).
update public.student_compensation_lessons c
set status='completed', completed_at=a.updated_at,
    completed_by=coalesce(a.updated_by,a.recorded_by), updated_at=now()
from public.attendance_records a
where c.organization_id='2aa21b5f-ba88-484e-b450-e50bcc7f2f7d'
  and c.lesson_date='2026-10-18' and c.status='planned'
  and a.organization_id=c.organization_id and a.student_id=c.student_id
  and a.lesson_date=c.lesson_date and a.group_id=c.target_group_id
  and (c.target_schedule_id is null or a.schedule_id=c.target_schedule_id)
  and a.status in ('compensation','present','absent','excused');

-- Reuse the existing on-demand synchronization; no recurring polling/job.
create or replace function public.sync_scheduled_used_lessons(p_organization_id uuid default private.current_user_organization_id())
returns integer language plpgsql security invoker
set search_path=pg_catalog,public,pg_temp
as $function$
declare changed integer := 0;
begin
 with calculated as materialized (
   select e.id, public.scheduled_used_lessons(e.id) as new_used_lessons
   from public.student_enrollments e
   where e.organization_id=p_organization_id and e.status='active'
 )
 update public.student_enrollments e
 set used_lessons=c.new_used_lessons, updated_at=now()
 from calculated c where e.id=c.id and e.used_lessons is distinct from c.new_used_lessons;
 get diagnostics changed=row_count;

 update public.student_compensation_lessons c
 set status='completed',completed_at=now(),updated_at=now()
 where c.organization_id=p_organization_id and c.status='planned'
   and (
     c.lesson_date < (now() at time zone 'Europe/Istanbul')::date
     or (c.lesson_date=(now() at time zone 'Europe/Istanbul')::date
       and exists(select 1 from public.lesson_schedules s
         where s.id=c.target_schedule_id and s.organization_id=c.organization_id
           and s.group_id=c.target_group_id
           and s.end_time <= (now() at time zone 'Europe/Istanbul')::time))
   );
 return changed;
end
$function$;

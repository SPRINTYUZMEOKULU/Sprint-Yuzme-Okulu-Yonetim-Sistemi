-- Repair only uniquely matched makeup records from the 26 November facility cancellation.
with matches as (
  select l.id log_id, c.enrollment_id, c.organization_id, c.lesson_date,
    count(*) over (partition by l.id) as candidates
  from public.student_activity_logs l
  join public.student_compensation_lessons c on c.organization_id=l.organization_id
    and c.student_id=l.student_id and c.target_schedule_id::text=l.new_value->>'target_schedule_id'
    and c.target_group_id::text=l.new_value->>'group_id' and c.lesson_date::text=l.new_value->>'compensation_date'
    and c.status in ('planned','completed')
  join public.student_enrollments e on e.id=c.enrollment_id and e.student_id=c.student_id and e.organization_id=c.organization_id
    and e.group_id=c.target_group_id
  join public.student_attendance_plans p on p.enrollment_id=e.id and p.student_id=e.student_id
    and p.organization_id=e.organization_id and p.is_active and p.compensation_planned_end_date>=c.lesson_date
  where l.activity_type='lesson_cancellation_compensation'
    and l.old_value->>'cancelled_lesson_date'='2026-11-26'
    and l.new_value->>'compensation_mode'='append_end'
    and l.new_value->>'group_name' in (
      'Süleyman Erol Olimpik · Salı-Perşembe 20:00 / Cumartesi 19:00 · Yetişkin',
      'Süleyman Erol Olimpik · Salı-Perşembe-Cumartesi · 19:00 · Çocuk'
    )
), verified as (
  select organization_id,enrollment_id,max(lesson_date) lesson_date
  from matches where candidates=1 group by organization_id,enrollment_id
)
update public.student_enrollments e
set compensation_end_date=greatest(e.planned_end_date,v.lesson_date),updated_at=now()
from verified v
where e.id=v.enrollment_id and e.organization_id=v.organization_id
  and (e.compensation_end_date is null or e.compensation_end_date<v.lesson_date);

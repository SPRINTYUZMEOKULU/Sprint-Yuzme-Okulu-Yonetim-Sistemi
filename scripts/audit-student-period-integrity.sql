-- Read-only relational audit. Legacy historical rows may have a null enrollment_id.
-- Restrict every source to the same organization before running this query.
with current_periods as (
 select e.* from public.student_enrollments e join public.students s on s.id=e.student_id and s.organization_id=e.organization_id
 where e.organization_id='2aa21b5f-ba88-484e-b450-e50bcc7f2f7d' and e.status='active' and s.status='active' and not s.is_deleted
), linked_records as (
 select 'attendance' as source,organization_id,student_id,enrollment_id from public.attendance_records
 union all select 'payments',organization_id,student_id,enrollment_id from public.student_payments
 union all select 'obligations',organization_id,student_id,enrollment_id from public.student_financial_obligations
 union all select 'payment_plans',organization_id,student_id,enrollment_id from public.student_payment_plans
 union all select 'lesson_plans',organization_id,student_id,enrollment_id from public.student_attendance_plans
 union all select 'makeups',organization_id,student_id,enrollment_id from public.student_compensation_lessons
)
select jsonb_build_object(
 'active_periods_checked',(select count(*) from current_periods),
 'missing_current_plan',(select count(*) from current_periods e where not exists(select 1 from public.student_attendance_plans p where p.organization_id=e.organization_id and p.student_id=e.student_id and p.enrollment_id=e.id and p.is_active)),
 'plan_field_mismatches',(select count(*) from current_periods e join public.student_attendance_plans p on p.enrollment_id=e.id and p.organization_id=e.organization_id and p.is_active where p.student_id<>e.student_id or p.group_id is distinct from e.group_id or p.start_date is distinct from e.start_date or p.normal_planned_end_date is distinct from e.planned_end_date or p.package_lesson_count is distinct from e.total_lessons or p.selected_weekdays::int[] is distinct from (select array_agg(distinct case when d=0 then 7 else d end order by case when d=0 then 7 else d end) from unnest(e.lesson_weekdays) d)),
 'missing_membership',(select count(*) from current_periods e where not exists(select 1 from public.student_group_memberships m where m.organization_id=e.organization_id and m.student_id=e.student_id and m.group_id=e.group_id and m.is_active)),
 'wrong_student_or_organization_links',(select count(*) from linked_records r left join public.student_enrollments e on e.id=r.enrollment_id where r.organization_id='2aa21b5f-ba88-484e-b450-e50bcc7f2f7d' and r.enrollment_id is not null and (e.id is null or e.student_id<>r.student_id or e.organization_id<>r.organization_id)),
 'counter_mismatches',(select count(*) from current_periods e where e.used_lessons is distinct from public.scheduled_used_lessons(e.id)),
 'overdue_scheduled_periods',(select count(*) from public.student_enrollments e join public.students s on s.id=e.student_id where e.organization_id='2aa21b5f-ba88-484e-b450-e50bcc7f2f7d' and e.status='scheduled' and s.status='active' and not s.is_deleted and e.start_date<=(now() at time zone 'Europe/Istanbul')::date),
 'inactive_selected_sessions',(select count(*) from current_periods e where exists(select 1 from unnest(e.lesson_weekdays) d where not exists(select 1 from public.lesson_schedules l where l.organization_id=e.organization_id and l.group_id=e.group_id and l.is_active and (case when l.weekday=0 then 7 else l.weekday end)=(case when d=0 then 7 else d end))))
) as integrity_audit;

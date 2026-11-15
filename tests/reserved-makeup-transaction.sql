-- Run against a database with at least one reserved cancellation right.
-- The entire exercise is rolled back, including plans, counters and audit entries.
begin;
do $$
declare source public.student_activity_logs%rowtype; actor uuid; schedule uuid; day date;
 result jsonb; repeated jsonb; before_count int; before_reserved int; after_reserved int;
begin
 select l.* into source from public.student_activity_logs l
 where l.activity_type='lesson_cancellation_compensation' and l.new_value->>'compensation_mode'='reserve'
 and nullif(l.new_value->>'compensation_date','') is null
 and (select count(*) from public.student_enrollments e where e.organization_id=l.organization_id and e.student_id=l.student_id
  and e.group_id=(l.new_value->>'group_id')::uuid and (l.old_value->>'cancelled_lesson_date')::date between e.start_date and e.planned_end_date and e.status in ('active','completed'))=1
 limit 1;
 if source.id is null then raise exception 'Test requires a reserved right with one verified source enrollment.'; end if;
 select id into actor from public.profiles where organization_id=source.organization_id and is_active and role::text='owner' limit 1;
 select s.id, date '2099-01-01'+((s.weekday%7-extract(dow from date '2099-01-01')::int+7)%7) into schedule,day
 from public.lesson_schedules s join public.training_groups g on g.id=s.group_id join public.branches b on b.id=g.branch_id
 where s.organization_id=source.organization_id and s.is_active and g.is_active and b.is_active limit 1;
 if actor is null or schedule is null then raise exception 'Test requires an owner and active schedule.'; end if;
 select count(*) into before_count from public.student_compensation_lessons where student_id=source.student_id;
 select count(*) into before_reserved from public.student_activity_logs where student_id=source.student_id and activity_type='lesson_cancellation_compensation' and new_value->>'compensation_mode'='reserve' and nullif(new_value->>'compensation_date','') is null;
 result:=public.plan_reserved_compensation(actor,source.id,day,schedule);
 assert not (result->>'duplicate')::boolean,'first request must plan';
 assert (select count(*) from public.student_compensation_lessons where student_id=source.student_id)=before_count+1,'one dated plan';
 select count(*) into after_reserved from public.student_activity_logs where student_id=source.student_id and activity_type='lesson_cancellation_compensation' and new_value->>'compensation_mode'='reserve' and nullif(new_value->>'compensation_date','') is null;
 assert after_reserved=before_reserved-1,'reserved unit becomes dated, never double counted';
 assert (select old_value->'original_reservation' from public.student_activity_logs where activity_type='compensation_reserved_planned' and source_id=(result->'current'->>'id')::uuid)=source.new_value,'original metadata retained in audit';
 repeated:=public.plan_reserved_compensation(actor,source.id,day,schedule);
 assert (repeated->>'duplicate')::boolean,'retry must be idempotent';
 assert repeated->'current'->>'id'=result->'current'->>'id','same dated plan on retry';
 assert (select count(*) from public.student_compensation_lessons where student_id=source.student_id)=before_count+1,'retry adds no right';
 begin
  perform public.plan_reserved_compensation(null,source.id,day,schedule);
  raise exception 'missing actor was accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;

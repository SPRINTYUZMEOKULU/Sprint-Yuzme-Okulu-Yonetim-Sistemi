-- Reuse the existing database scheduler; no Vercel plan change is required.
create extension if not exists pg_net;
create table if not exists private.sprint_background_requests (
 request_id bigint primary key,
 requested_at timestamptz not null default now()
);
alter table private.sprint_background_requests enable row level security;
revoke all on private.sprint_background_requests from public,anon,authenticated;
grant select on private.sprint_background_requests to service_role;
grant usage on schema net to service_role;
grant select on net._http_response to service_role;

create or replace function private.enqueue_sprint_background()
returns bigint language plpgsql security invoker set search_path='' as $$
declare token text; request_id bigint;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='sprint_background_cron_secret';
 if token is null or length(token)<32 then raise exception 'SprintOS zamanlayıcı kimliği yapılandırılmamış.'; end if;
 -- Do not put credentials in cron.job, source files, URLs or returned data.
 perform pg_advisory_xact_lock(hashtextextended('sprint-background-notifications',0));
 if exists(select 1 from private.sprint_background_requests where requested_at>now()-interval '1 minute') then return null; end if;
 select net.http_get(url:='https://panel.larayuzmekursu.com/api/cron/attendance-notifications',headers:=jsonb_build_object('Authorization','Bearer '||token),timeout_milliseconds:=65000) into request_id;
 insert into private.sprint_background_requests(request_id) values(request_id);
 delete from private.sprint_background_requests where requested_at<now()-interval '30 days';
 return request_id;
end $$;
revoke all on function private.enqueue_sprint_background() from public,anon,authenticated,service_role;

-- Deploy and check the authenticated endpoint before activating the schedule.
do $$ declare job_id bigint; begin
 select cron.schedule('sprint-background-notifications','*/5 * * * *','select private.enqueue_sprint_background();') into job_id;
 perform cron.alter_job(job_id,active:=false);
end $$;

create or replace function public.sprint_system_integration_health(p_actor uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare org uuid; checks jsonb; scheduler jsonb;
begin
 select organization_id into org from public.profiles where id=p_actor and is_active and role::text in ('owner','admin');
 if org is null then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501'; end if;
 with current_periods as (
  select e.* from public.student_enrollments e join public.students s on s.id=e.student_id and s.organization_id=e.organization_id
  where e.organization_id=org and e.status='active' and s.status='active' and not s.is_deleted
 ), linked as (
  select organization_id,student_id,enrollment_id from public.attendance_records where organization_id=org
  union all select organization_id,student_id,enrollment_id from public.student_payments where organization_id=org
  union all select organization_id,student_id,enrollment_id from public.student_financial_obligations where organization_id=org
  union all select organization_id,student_id,enrollment_id from public.student_payment_plans where organization_id=org
  union all select organization_id,student_id,enrollment_id from public.student_attendance_plans where organization_id=org
  union all select organization_id,student_id,enrollment_id from public.student_compensation_lessons where organization_id=org
 )
 select jsonb_build_object(
  'active_periods',(select count(*) from current_periods),
  'missing_plan',(select count(*) from current_periods e where not exists(select 1 from public.student_attendance_plans p where p.organization_id=org and p.enrollment_id=e.id and p.student_id=e.student_id and p.is_active)),
  'missing_membership',(select count(*) from current_periods e where not exists(select 1 from public.student_group_memberships m where m.organization_id=org and m.student_id=e.student_id and m.group_id=e.group_id and m.is_active)),
  'plan_mismatch',(select count(*) from current_periods e join public.student_attendance_plans p on p.enrollment_id=e.id and p.organization_id=org and p.is_active where p.student_id<>e.student_id or p.group_id is distinct from e.group_id or p.start_date is distinct from e.start_date or p.normal_planned_end_date is distinct from e.planned_end_date or p.package_lesson_count is distinct from e.total_lessons or p.selected_weekdays::int[] is distinct from (select array_agg(distinct case when d=0 then 7 else d end order by case when d=0 then 7 else d end) from unnest(e.lesson_weekdays) d)),
  'period_link_mismatch',(select count(*) from linked r left join public.student_enrollments e on e.id=r.enrollment_id where r.enrollment_id is not null and (e.id is null or e.student_id<>r.student_id or e.organization_id<>org)),
  'counter_mismatch',(select count(*) from current_periods e where e.used_lessons is distinct from public.scheduled_used_lessons(e.id)),
  'overdue_renewal',(select count(*) from public.student_enrollments e join public.students s on s.id=e.student_id and s.organization_id=org where e.organization_id=org and e.status='scheduled' and s.status='active' and not s.is_deleted and e.start_date<=(now() at time zone 'Europe/Istanbul')::date),
  'duplicate_makeups',(select count(*) from(select student_id,lesson_date,target_schedule_id from public.student_compensation_lessons where organization_id=org and status in ('planned','completed') group by student_id,lesson_date,target_schedule_id having count(*)>1)d),
  'legacy_unplanned_makeups',(select count(*) from public.lesson_adjustment_requests r where r.organization_id=org and r.request_type='individual_compensation' and r.status='approved' and not exists(select 1 from public.student_compensation_lessons c where c.organization_id=org and c.source_request_id=r.id)),
  'pending_lesson_approvals',(select count(*) from public.lesson_adjustment_requests where organization_id=org and status='pending'),
  'sent_without_timestamp',(select count(*) from public.message_logs where organization_id=org and status='sent' and sent_at is null),
  'invalid_guardian_links',(select count(*) from public.guardian_students gs join public.students s on s.id=gs.student_id join public.guardians g on g.id=gs.guardian_id where gs.organization_id=org and (s.organization_id<>org or g.organization_id<>org))
 ) into checks;
 select jsonb_build_object('requested_at',q.requested_at,'responded_at',r.created,'http_status',r.status_code,'timed_out',r.timed_out,
  'last_success_at',(select max(q2.requested_at) from private.sprint_background_requests q2 join net._http_response r2 on r2.id=q2.request_id where r2.status_code=200))
 into scheduler from private.sprint_background_requests q left join net._http_response r on r.id=q.request_id order by q.requested_at desc limit 1;
 return jsonb_build_object('checked_at',now(),'checks',checks,'scheduler',coalesce(scheduler,'{}'::jsonb));
end $$;
revoke all on function public.sprint_system_integration_health(uuid) from public,anon,authenticated;
grant execute on function public.sprint_system_integration_health(uuid) to service_role;

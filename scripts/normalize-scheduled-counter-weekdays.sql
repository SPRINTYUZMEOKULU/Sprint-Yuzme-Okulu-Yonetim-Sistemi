CREATE OR REPLACE FUNCTION public.scheduled_used_lessons(p_enrollment_id uuid, p_as_of timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  e public.student_enrollments%rowtype;
  effective_weekdays smallint[];
  d date;
  used_count integer := 0;
  is_paused boolean;
begin
  select * into e from public.student_enrollments where id=p_enrollment_id;
  if not found or e.total_lessons <= 0 then return 0; end if;
  if e.start_confirmation_required and e.actual_started_at is null then
    return coalesce(e.used_lessons,0);
  end if;

  select array_agg(v::smallint order by v)
  into effective_weekdays
  from (
    select distinct (case when day=7 then 0 else day end)::smallint as v
    from public.student_attendance_plans ap
    cross join lateral unnest(ap.selected_weekdays) day
    where ap.organization_id=e.organization_id and ap.student_id=e.student_id
      and ap.enrollment_id=e.id and ap.group_id=e.group_id and ap.is_active=true
      and array_length(ap.selected_weekdays,1) is not null
    order by 1
    limit 7
  ) q;

  if array_length(effective_weekdays,1) is null then
    select array_agg(distinct (case when day=7 then 0 else day end)::smallint)
    into effective_weekdays from unnest(e.lesson_weekdays) day;
  end if;
  if array_length(effective_weekdays,1) is null then return 0; end if;

  d:=e.start_date;
  while d <= least((p_as_of at time zone 'Europe/Istanbul')::date,coalesce(e.planned_end_date,(p_as_of at time zone 'Europe/Istanbul')::date))
    and used_count<e.total_lessons loop
    if extract(dow from d)::smallint=any(effective_weekdays)
      and exists(
        select 1
        from public.lesson_schedules ls
        where ls.organization_id=e.organization_id
          and ls.group_id=e.group_id
          and ls.is_active=true
          and (case when ls.weekday=7 then 0 else ls.weekday end)=extract(dow from d)::smallint
          and (
            d<(p_as_of at time zone 'Europe/Istanbul')::date
            or (d=(p_as_of at time zone 'Europe/Istanbul')::date and ls.end_time<=(p_as_of at time zone 'Europe/Istanbul')::time)
            or exists(
              select 1
              from public.attendance_records ar
              where ar.organization_id=e.organization_id
                and ar.student_id=e.student_id
                and ar.group_id=e.group_id
                and ar.lesson_date=d
                and ar.schedule_id=ls.id
                and ar.status in ('present','absent','excused')
                and (ar.enrollment_id=e.id or ar.enrollment_id is null)
            )
          )
      )
    then
      select exists(
        select 1
        from public.facility_pause_student_snapshots s
        join public.facility_season_pauses p on p.id=s.pause_id
        where s.enrollment_id=e.id and p.organization_id=e.organization_id
          and d>=p.closure_date and (s.resumed_at is null or d<s.resumed_at)
      ) into is_paused;

      if not is_paused and not exists(
        select 1 from public.lesson_consumption_exceptions x
        where x.organization_id=e.organization_id and x.group_id=e.group_id
          and x.lesson_date=d and x.consume_right=false
          and (x.schedule_id is null or exists(
            select 1 from public.lesson_schedules lsx
            where lsx.id=x.schedule_id and (case when lsx.weekday=7 then 0 else lsx.weekday end)=extract(dow from d)::smallint
          ))
      )
      then used_count:=used_count+1; end if;
    end if;
    d:=d+1;
  end loop;
  return least(used_count,e.total_lessons);
end $function$;

-- Idempotent, organization-scoped recalculation with before/after audit records.
with candidates as materialized (
 select e.id,e.organization_id,e.student_id,e.used_lessons old_used,public.scheduled_used_lessons(e.id) new_used
 from public.student_enrollments e where e.organization_id='2aa21b5f-ba88-484e-b450-e50bcc7f2f7d' and e.status='active'
 and e.used_lessons is distinct from public.scheduled_used_lessons(e.id)
 for update
), updated as (
 update public.student_enrollments e set used_lessons=c.new_used,updated_at=now()
 from candidates c where e.id=c.id returning e.id
), logged as (
 insert into public.student_activity_logs (organization_id,student_id,activity_type,title,description,source_type,source_id,old_value,new_value,performed_at)
 select c.organization_id,c.student_id,'scheduled_weekday_counter_repaired','Pazar ders sayacı düzeltildi',
 'Pazar 0/7 gün eşleştirmesi ve kayıt dönemine bağlı plan kapsamı düzeltildi; sayaç merkezi ders takvimine göre yeniden hesaplandı.',
 'student_enrollments',c.id,jsonb_build_object('used_lessons',c.old_used),jsonb_build_object('used_lessons',c.new_used),now()
 from candidates c join updated u on u.id=c.id returning source_id
) select count(*) repaired_counters from logged;

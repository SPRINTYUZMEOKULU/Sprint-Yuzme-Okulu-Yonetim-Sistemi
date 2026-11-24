begin;

alter table public.student_enrollments
  add column freeze_restart_pending boolean not null default false;

-- Keep completed historical freezes as they were before this release.
update public.student_enrollments
set freeze_restart_pending = true
where status = 'active' and freeze_resume_date > (now() at time zone 'Europe/Istanbul')::date;

create function public.set_enrollment_restart_pending()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'active' and old.freeze_restart_pending and new.status = 'completed' then
      raise exception 'Mevcut dönemi tamamlamadan önce dondurulan kaydı başlatın.';
    end if;
  end if;
  if current_user in ('authenticated', 'anon') then
    if (tg_op = 'INSERT' and new.freeze_restart_pending)
       or (tg_op = 'UPDATE' and new.freeze_restart_pending is distinct from old.freeze_restart_pending) then
      raise exception 'Kaydı başlatmak için yönetici yetkisi gerekir.';
    end if;
  elsif tg_op = 'UPDATE' and old.freeze_start_date is null and new.freeze_start_date is not null then
    new.freeze_restart_pending := true;
  end if;
  return new;
end;
$$;

create trigger set_enrollment_restart_pending
before insert or update on public.student_enrollments
for each row execute function public.set_enrollment_restart_pending();

create function public.restart_frozen_enrollment(p_enrollment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  e public.student_enrollments%rowtype;
  student uuid;
  resume_on date := (now() at time zone 'Europe/Istanbul')::date;
  weekdays smallint[];
  excluded_dates date[];
  new_end date;
  end_shift integer;
begin
  select * into actor from public.profiles where id = auth.uid() and is_active;
  if not found or coalesce(actor.role::text, '') not in ('owner', 'admin') then
    raise exception 'Kaydı yeniden başlatmak için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;

  select student_id into student from public.student_enrollments
    where id = p_enrollment_id and organization_id = actor.organization_id;
  perform 1 from public.students where id = student and organization_id = actor.organization_id for update;

  select * into e from public.student_enrollments
    where id = p_enrollment_id and organization_id = actor.organization_id and status = 'active'
    for update;
  if not found or not e.freeze_restart_pending or resume_on < e.freeze_start_date or not exists (
    select 1 from public.students where id = e.student_id and organization_id = e.organization_id
      and status = 'active' and not is_deleted
  ) then
    raise exception 'Başlatılabilecek dondurulmuş kayıt bulunamadı.';
  end if;

  select array_agg(distinct (day % 7)::smallint) into weekdays
    from public.student_attendance_plans ap cross join lateral unnest(ap.selected_weekdays) day
    where ap.organization_id = e.organization_id and ap.enrollment_id = e.id
      and ap.student_id = e.student_id and ap.group_id = e.group_id and ap.is_active;
  if weekdays is null then
    select array_agg(distinct (day % 7)::smallint) into weekdays from unnest(e.lesson_weekdays) day;
  end if;
  if coalesce(cardinality(weekdays), 0) = 0 then
    raise exception 'Kayıt için aktif ders günü bulunamadı.';
  end if;

  -- Resume from the next eligible lesson if today's lesson has already started.
  if resume_on = e.freeze_start_date or exists (
    select 1 from public.lesson_schedules s
    where s.organization_id = e.organization_id and s.group_id = e.group_id and s.is_active
      and s.weekday % 7 = extract(dow from resume_on)
      and extract(dow from resume_on)::smallint = any(weekdays)
      and s.start_time <= (now() at time zone 'Europe/Istanbul')::time
  ) then
    resume_on := resume_on + 1;
  end if;

  select array_agg(distinct lesson_date) into excluded_dates
  from (
    select d::date as lesson_date from generate_series(e.freeze_start_date::timestamp, (resume_on - 1)::timestamp, interval '1 day') d
    union
    select x.lesson_date from public.lesson_consumption_exceptions x
      where x.organization_id = e.organization_id and x.group_id = e.group_id
        and x.lesson_date >= e.start_date and not x.consume_right
  ) dates;
  new_end := public.calculate_package_end_date(e.start_date, weekdays, e.total_lessons, excluded_dates);
  if new_end is null or new_end < resume_on then
    raise exception 'Kalan dersler için yeni paket bitişi hesaplanamadı.';
  end if;
  end_shift := new_end - coalesce(e.normal_end_date, e.planned_end_date);

  update public.student_enrollments set freeze_resume_date = resume_on,
    freeze_restart_pending = false, freeze_callback_pending = false,
    planned_end_date = new_end, normal_end_date = new_end,
    compensation_end_date = case when compensation_end_date is not null then greatest(new_end, compensation_end_date + end_shift) end,
    updated_at = now()
  where id = e.id;

  update public.student_attendance_plans set normal_planned_end_date = new_end,
    compensation_planned_end_date = case when compensation_planned_end_date is not null then greatest(new_end, compensation_planned_end_date + end_shift) end,
    updated_by = actor.id
  where organization_id = e.organization_id and enrollment_id = e.id;

  -- Keep a prepared renewal behind this same registration when the return was delayed.
  update public.student_enrollments
    set start_date = new_end + 1,
      normal_end_date = public.calculate_package_end_date(new_end + 1, lesson_weekdays, total_lessons, '{}'::date[]),
      updated_at = now()
  where organization_id = e.organization_id and student_id = e.student_id
    and status = 'scheduled' and start_date <= new_end;

  update public.approval_requests set new_values = new_values || jsonb_build_object(
    'freeze_resume_date', resume_on, 'planned_end_date', new_end, 'callback_pending', false, 'restarted', true)
  where organization_id = e.organization_id and student_id = e.student_id
    and entity_id = e.id::text and request_type = 'enrollment_freeze' and status = 'approved';

  update public.student_activity_logs l set reminder_completed = true, reminder_completed_at = now(), reminder_completed_by = actor.id
  where l.organization_id = e.organization_id and l.source_type = 'approval_request'
    and l.activity_type = 'student_note_reminder' and not l.reminder_completed and l.source_id in (
      select r.id from public.approval_requests r where r.organization_id = e.organization_id
        and r.student_id = e.student_id and r.entity_id = e.id::text and r.request_type = 'enrollment_freeze'
    );

  insert into public.student_activity_logs(organization_id,student_id,activity_type,title,new_value,source_type,source_id,performed_by,performed_at)
  values (e.organization_id,e.student_id,'approval_applied','Dondurulan kayıt yeniden başlatıldı',
    jsonb_build_object('freeze_resume_date',resume_on,'planned_end_date',new_end),'student_enrollment',e.id,actor.id,now());

  return jsonb_build_object('student_id', e.student_id, 'resume_on', resume_on, 'planned_end_date', new_end);
end;
$$;

revoke all on function public.restart_frozen_enrollment(uuid) from public;
grant execute on function public.restart_frozen_enrollment(uuid) to authenticated;

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
    if (e.freeze_start_date is null or d < e.freeze_start_date or (not e.freeze_restart_pending and d >= e.freeze_resume_date))
      and extract(dow from d)::smallint=any(effective_weekdays)
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

create or replace function public.guard_compensation_during_enrollment_freeze()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from 'planned' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (new.organization_id, new.student_id, new.lesson_date, new.status)
       is not distinct from (old.organization_id, old.student_id, old.lesson_date, old.status) then
      return new;
    end if;
  end if;

  -- The freeze approval locks the same active enrollment before validating planned makeups.
  perform 1
    from public.student_enrollments
    where organization_id = new.organization_id and student_id = new.student_id
      and status = 'active'
    order by id
    for share;

  if exists (
    select 1
    from public.student_enrollments
    where organization_id = new.organization_id and student_id = new.student_id
      and new.lesson_date >= freeze_start_date and (freeze_restart_pending or new.lesson_date < freeze_resume_date)
  ) then
    raise exception 'Bu tarih kayıt dondurma dönemine denk geliyor. Kayıt başlatıldıktan sonra uygun bir seans seçin.';
  end if;

  return new;
end;
$$;

create or replace function private.activate_due_renewals(p_org uuid default null)
returns integer language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare e record; n integer:=0;
begin
  for e in select id,student_id,organization_id from public.student_enrollments where status='scheduled'
    and exists(select 1 from public.students s where s.id=student_enrollments.student_id and s.status='active' and s.is_deleted=false)
    and not exists(select 1 from public.student_enrollments active
      where active.organization_id=student_enrollments.organization_id
        and active.student_id=student_enrollments.student_id
        and active.status='active' and active.freeze_restart_pending)
    and start_date<=(now() at time zone 'Europe/Istanbul')::date and (p_org is null or organization_id=p_org)
    order by start_date,id loop
    perform 1 from public.students where id=e.student_id for update;
    if exists(select 1 from public.student_enrollments where id=e.id and status='scheduled' and start_date<=(now() at time zone 'Europe/Istanbul')::date)
      and not exists(select 1 from public.student_enrollments active where active.organization_id=e.organization_id
        and active.student_id=e.student_id and active.status='active' and active.freeze_restart_pending) then
      perform private.activate_enrollment_period(e.id); n:=n+1;
    end if;
  end loop;
  return n;
end $$;

commit;

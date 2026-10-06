-- Manual start confirmation belongs to the enrollment, not the browser.
alter table public.student_enrollments
  add column if not exists start_confirmation_required boolean not null default false,
  add column if not exists actual_started_at timestamptz;

create or replace function public.require_enrollment_start_confirmation()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' and new.start_date >= (now() at time zone 'Europe/Istanbul')::date then
      new.start_confirmation_required := true;
      new.actual_started_at := null;
    end if;
  elsif new.start_date is distinct from old.start_date
    and new.status = 'active'
    and new.start_date > (now() at time zone 'Europe/Istanbul')::date
    and coalesce(new.used_lessons,0) = 0
    and old.actual_started_at is null then
    new.start_confirmation_required := true;
  end if;
  return new;
end $$;
drop trigger if exists enrollment_manual_start_confirmation on public.student_enrollments;
create trigger enrollment_manual_start_confirmation
before insert or update of start_date on public.student_enrollments
for each row execute function public.require_enrollment_start_confirmation();

-- Existing ongoing and historical registrations retain their existing behavior.
update public.student_enrollments
set start_confirmation_required = true
where status = 'active' and start_date > (now() at time zone 'Europe/Istanbul')::date
  and coalesce(used_lessons,0) = 0 and actual_started_at is null;

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
    select distinct unnest(ap.selected_weekdays)::smallint as v
    from public.student_attendance_plans ap
    where ap.student_id=e.student_id and ap.is_active=true
      and array_length(ap.selected_weekdays,1) is not null
    order by 1
    limit 7
  ) q;

  if array_length(effective_weekdays,1) is null then
    effective_weekdays := e.lesson_weekdays;
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
          and ls.weekday=extract(dow from d)::smallint
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
            where lsx.id=x.schedule_id and lsx.weekday=extract(dow from d)::smallint
          ))
      )
      then used_count:=used_count+1; end if;
    end if;
    d:=d+1;
  end loop;
  return least(used_count,e.total_lessons);
end $function$;


create or replace function public.manage_enrollment_start(
  p_enrollment_id uuid, p_expected_start_date date, p_start_date date, p_confirm boolean
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp as $$
declare
  e public.student_enrollments%rowtype;
  actor public.profiles%rowtype;
  ap public.student_attendance_plans%rowtype;
  today date := (now() at time zone 'Europe/Istanbul')::date;
  new_end date;
  previous_end date;
  compensation_extra integer;
  excluded_dates date[];
  new_weekdays smallint[];
begin
  select * into actor from public.profiles where id = auth.uid() and is_active = true;
  if not found or actor.organization_id is null or actor.role::text not in
    ('owner','admin','branch_manager','registration_staff','accounting') then
    raise exception 'Bu işlem için yetkiniz bulunmuyor.';
  end if;
  select * into e from public.student_enrollments
    where id = p_enrollment_id and organization_id = actor.organization_id for update;
  if not found or e.status <> 'active' or not exists (
    select 1 from public.students s where s.id=e.student_id
      and s.organization_id=actor.organization_id and s.status='active' and s.is_deleted=false
  ) then raise exception 'Aktif kayıt bulunamadı.'; end if;
  if not e.start_confirmation_required or e.actual_started_at is not null then
    if p_confirm and e.actual_started_at is not null then
      return jsonb_build_object('ok',true,'message','Kursiyer zaten başlatılmış.');
    end if;
    raise exception 'Bu kayıt başlangıç onayı beklemiyor.';
  end if;
  if e.start_date is distinct from p_expected_start_date then
    raise exception 'Başlangıç tarihi değişmiş. Sayfayı yenileyip tekrar deneyin.';
  end if;
  if p_start_date is null then raise exception 'Başlangıç tarihi zorunludur.'; end if;
  if p_confirm then
    if e.start_date > today then raise exception 'Başlangıç günü henüz gelmedi.'; end if;
    if p_start_date <> today then raise exception 'Başlatma tarihi bugün olmalıdır.'; end if;
  elsif p_start_date < today then
    raise exception 'Yeni başlangıç tarihi bugün veya ileri bir tarih olmalıdır.';
  end if;
  select * into ap from public.student_attendance_plans
    where enrollment_id=e.id and organization_id=actor.organization_id and is_active=true
    order by created_at desc limit 1 for update;
  previous_end := coalesce(ap.normal_planned_end_date,e.planned_end_date);
  new_end := previous_end;
  if p_start_date is distinct from e.start_date then
    if coalesce(e.used_lessons,0) > 0 then
      raise exception 'Ders kullanımı olan kaydın başlangıcı bu işlemle değiştirilemez.';
    end if;
    new_weekdays := e.lesson_weekdays;
    if array_length(new_weekdays,1) is null and array_length(ap.selected_weekdays,1) is not null then
      select array_agg((v % 7)::smallint) into new_weekdays from unnest(ap.selected_weekdays) v;
    end if;
    if array_length(new_weekdays,1) is null then raise exception 'Önce ders günleri tanımlanmalıdır.'; end if;
    select array_agg(distinct x.lesson_date) into excluded_dates
      from public.lesson_consumption_exceptions x
      where x.organization_id=e.organization_id and x.group_id=e.group_id
        and x.consume_right=false and x.lesson_date>=p_start_date
        and x.schedule_id is null;
    new_end := public.calculate_package_end_date(p_start_date,new_weekdays,e.total_lessons,coalesce(excluded_dates,'{}'::date[]));
    if new_end is null then raise exception 'Bitiş tarihi hesaplanamadı.'; end if;
    compensation_extra := greatest(0,coalesce(ap.compensation_planned_end_date-previous_end,e.compensation_end_date-previous_end,0));
    update public.student_attendance_plans set start_date=p_start_date,
      normal_planned_end_date=new_end,compensation_planned_end_date=new_end+compensation_extra,updated_by=actor.id
      where enrollment_id=e.id and organization_id=actor.organization_id and is_active=true;
    update public.student_enrollments set start_date=p_start_date,planned_end_date=new_end,
      normal_end_date=case when normal_end_date is not null then new_end else null end,
      compensation_end_date=case when compensation_end_date is not null then new_end+compensation_extra else null end
      where id=e.id;
  end if;
  if p_confirm then
    update public.student_enrollments set actual_started_at=now(),updated_at=now() where id=e.id;
  end if;
  insert into public.student_activity_logs(
    organization_id,student_id,activity_type,title,description,old_value,new_value,
    source_type,source_id,performed_by,performed_at
  ) values (
    e.organization_id,e.student_id,
    case when p_confirm then 'enrollment_start_confirmed' else 'enrollment_start_rescheduled' end,
    case when p_confirm then 'Kursiyer başlatıldı' else 'Başlangıç tarihi değiştirildi' end,
    case when p_confirm then 'Başlangıç yönetici onayıyla yapıldı.' else 'Kursiyer başlatılmadan yeni tarih planlandı.' end,
    jsonb_build_object('start_date',e.start_date,'planned_end_date',e.planned_end_date),
    jsonb_build_object('start_date',p_start_date,'planned_end_date',new_end,'confirmed',p_confirm),
    'student_enrollments',e.id,actor.id,now()
  );
  return jsonb_build_object('ok',true,'message',
    case when p_confirm then 'Kursiyer başlatıldı ve Aktif listesine alındı.' else 'Başlangıç tarihi güncellendi. Başlat onayı bekleniyor.' end);
end $$;
revoke all on function public.manage_enrollment_start(uuid,date,date,boolean) from public, anon;
grant execute on function public.manage_enrollment_start(uuid,date,date,boolean) to authenticated;

create or replace function public.guard_pending_enrollment_attendance()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,public,pg_temp as $$
begin
  if new.status in ('present','absent','excused') and exists (
    select 1 from public.student_enrollments e
    where e.organization_id=new.organization_id and e.student_id=new.student_id
      and e.status='active' and e.start_confirmation_required and e.actual_started_at is null
      and (e.id=new.enrollment_id or (new.enrollment_id is null and e.group_id=new.group_id))
  ) then raise exception 'Kursiyer başlangıç onayı bekliyor. Önce Öğrenci Merkezinden Başlat işlemini yapın.'; end if;
  return new;
end $$;
drop trigger if exists attendance_require_started_enrollment on public.attendance_records;
create trigger attendance_require_started_enrollment before insert or update of status,enrollment_id
on public.attendance_records for each row execute function public.guard_pending_enrollment_attendance();

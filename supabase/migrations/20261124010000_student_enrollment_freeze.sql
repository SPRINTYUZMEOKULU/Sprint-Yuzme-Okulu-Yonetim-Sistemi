begin;

alter table public.student_enrollments
  add column freeze_start_date date,
  add column freeze_resume_date date,
  add column freeze_callback_pending boolean not null default false,
  add constraint enrollment_freeze_dates_check check (
    (freeze_start_date is null and freeze_resume_date is null)
    or (freeze_start_date is not null and freeze_resume_date > freeze_start_date and freeze_resume_date is not null)
  );

create unique index one_student_freeze_request
  on public.approval_requests (organization_id, student_id)
  where request_type = 'enrollment_freeze' and status in ('pending', 'approved');

create unique index one_student_approved_freeze
  on public.student_enrollments (organization_id, student_id)
  where freeze_start_date is not null;

create policy enrollment_freeze_insert_via_function_only
  on public.approval_requests as restrictive for insert to authenticated
  with check (request_type <> 'enrollment_freeze');

create policy enrollment_freeze_update_via_function_only
  on public.approval_requests as restrictive for update to authenticated
  using (request_type <> 'enrollment_freeze')
  with check (request_type <> 'enrollment_freeze');

create function public.guard_enrollment_freeze_dates()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.freeze_start_date is not null or new.freeze_resume_date is not null or new.freeze_callback_pending
      then raise exception 'Dondurma tarihleri yönetici onayıyla kaydedilir.'; end if;
    elsif (new.freeze_start_date, new.freeze_resume_date, new.freeze_callback_pending)
      is distinct from (old.freeze_start_date, old.freeze_resume_date, old.freeze_callback_pending)
    then raise exception 'Dondurma tarihleri yönetici onayıyla kaydedilir.'; end if;
  end if;
  return new;
end;
$$;

create trigger guard_enrollment_freeze_dates
before insert or update on public.student_enrollments
for each row execute function public.guard_enrollment_freeze_dates();

create function public.process_enrollment_freeze(
  p_action text, p_id uuid, p_start date default null, p_resume date default null,
  p_note text default null, p_callback boolean default false
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  e public.student_enrollments%rowtype;
  r public.approval_requests%rowtype;
  local_today date := (now() at time zone 'Europe/Istanbul')::date;
  previous_end date;
  new_end date;
  end_shift integer;
  excluded_dates date[];
  weekdays smallint[];
begin
  select * into actor from public.profiles where id = auth.uid() and is_active;
  if not found or actor.organization_id is null or actor.role is null
    or actor.role not in ('owner','admin','branch_manager','registration_staff')
    or (p_action is distinct from 'request' and actor.role not in ('owner','admin'))
  then raise exception 'Bu işlem için yetkiniz bulunmuyor.'; end if;

  if p_action = 'request' then
    select * into e from public.student_enrollments
    where id = p_id and organization_id = actor.organization_id for update;
  elsif p_action in ('approve','reject','confirm_resume') then
    select * into r from public.approval_requests
    where id = p_id and organization_id = actor.organization_id
      and request_type = 'enrollment_freeze'
      and status = case when p_action = 'confirm_resume' then 'approved' else 'pending' end for update;
    if not found then raise exception 'Bekleyen dondurma talebi bulunamadı.'; end if;
    if p_action <> 'reject' then
      select * into e from public.student_enrollments
      where id = r.entity_id::uuid and student_id = r.student_id
        and organization_id = actor.organization_id for update;
      p_start := (r.new_values->>'freeze_start_date')::date;
      p_callback := coalesce((r.new_values->>'callback_pending')::boolean,false);
      if p_action = 'confirm_resume' then
        if not p_callback or e.freeze_resume_date is null or local_today > e.freeze_resume_date
          or p_resume is null or p_resume < local_today or p_resume > e.freeze_resume_date
        then raise exception 'Dönüş tarihi, telefon teyidi bekleyen kaydın onaylı süresi içinde olmalıdır.'; end if;
      else
        p_resume := (r.new_values->>'freeze_resume_date')::date;
      end if;
    end if;
  else raise exception 'Geçersiz işlem.'; end if;

  if p_action <> 'reject' then
    if e.id is null or e.status <> 'active' or not exists (
      select 1 from public.students s where s.id = e.student_id
        and s.organization_id = e.organization_id and s.status = 'active' and not s.is_deleted
    ) then raise exception 'Aktif kayıt bulunamadı.'; end if;

    if p_action = 'request' and p_callback then
      p_resume := (p_start + interval '1 month')::date;
    end if;
    if p_start is null or p_resume is null or not isfinite(p_start) or not isfinite(p_resume)
      or (p_action <> 'confirm_resume' and p_start < local_today)
      or p_resume <= p_start or p_start < e.start_date
      or p_resume > (p_start + interval '1 month')::date
    then raise exception 'Dondurma ileriye dönük planlanır ve en fazla bir takvim ayı sürer.'; end if;

    if p_action <> 'confirm_resume' and exists (select 1 from public.student_enrollments f
      where f.organization_id = e.organization_id and f.student_id = e.student_id and f.freeze_start_date is not null)
    then raise exception 'Kursiyer tek seferlik dondurma hakkını kullanmış.'; end if;

    select array_agg(distinct (case when day = 7 then 0 else day end)::smallint)
      into weekdays
    from public.student_attendance_plans ap
      cross join lateral unnest(ap.selected_weekdays) day
    where ap.organization_id = e.organization_id and ap.student_id = e.student_id
      and ap.enrollment_id = e.id and ap.group_id = e.group_id and ap.is_active;
    if weekdays is null then
      select array_agg(distinct (case when day = 7 then 0 else day end)::smallint)
        into weekdays from unnest(e.lesson_weekdays) day;
    end if;
    previous_end := coalesce(e.normal_end_date, e.planned_end_date);
    if previous_end is null or p_start > previous_end or coalesce(cardinality(weekdays), 0) = 0
      or public.scheduled_used_lessons(e.id, now()) >= e.total_lessons
    then raise exception 'Dondurulabilecek ders hakkı bulunamadı.'; end if;

    if ((p_action <> 'confirm_resume' and p_start = local_today)
        or (p_action = 'confirm_resume' and p_resume = local_today and p_resume < e.freeze_resume_date)) and exists (
      select 1 from public.lesson_schedules ls
      where ls.organization_id = e.organization_id and ls.group_id = e.group_id and ls.is_active
        and (case when ls.weekday = 7 then 0 else ls.weekday end) = extract(dow from local_today)
        and extract(dow from local_today)::smallint = any(weekdays)
        and ls.start_time <= (now() at time zone 'Europe/Istanbul')::time
    ) then raise exception 'Bugünkü seans başladı. İleri bir tarih seçin.'; end if;

    if exists (select 1 from public.attendance_records a
      where a.organization_id = e.organization_id and a.student_id = e.student_id
        and a.lesson_date >= p_start and a.lesson_date < p_resume)
    then raise exception 'Seçilen aralıkta yoklama kaydı var.'; end if;

    if exists (select 1 from public.student_compensation_lessons c
      where c.organization_id = e.organization_id and c.student_id = e.student_id
        and c.status = 'planned' and c.lesson_date >= p_start and c.lesson_date < p_resume)
    then raise exception 'Seçilen aralıkta planlı telafi var. Önce telafi tarihini düzenleyin.'; end if;

    select array_agg(distinct d) into excluded_dates
    from (
      select p_start + n as d from generate_series(0, least(730, p_resume - p_start - 1)) n
      union
      select x.lesson_date from public.lesson_consumption_exceptions x
        where x.organization_id = e.organization_id and x.group_id = e.group_id
          and x.lesson_date >= e.start_date and not x.consume_right
    ) exclusions;

    new_end := public.calculate_package_end_date(e.start_date, weekdays, e.total_lessons, excluded_dates);
    if new_end is null or new_end < p_resume or (p_action <> 'confirm_resume' and new_end <= previous_end)
    then raise exception 'Seçilen tarih aralığında ertelenebilecek ders bulunamadı.'; end if;
  end if;

  if p_action = 'request' then
    insert into public.approval_requests (
      organization_id, student_id, branch_id, group_id, request_type, request_label, module, priority,
      entity_type, entity_id, requested_by, requested_by_name, reason,
      old_values, new_values, status, requested_at
    ) values (
      e.organization_id, e.student_id, e.branch_id, e.group_id, 'enrollment_freeze', 'Kayıt Dondurma',
      'enrollment', 'high', 'student_enrollment', e.id::text, actor.id, actor.full_name, nullif(btrim(left(p_note,1000)), ''),
      jsonb_build_object('planned_end_date', previous_end),
      jsonb_build_object('freeze_start_date', p_start, 'freeze_resume_date', p_resume, 'planned_end_date', new_end, 'callback_pending', p_callback),
      'pending', now()
    ) returning * into r;
  else
    if p_action <> 'reject' then
      end_shift := new_end - previous_end;
      update public.student_enrollments set freeze_start_date = p_start, freeze_resume_date = p_resume,
        freeze_callback_pending = p_callback and p_action = 'approve',
        planned_end_date = new_end, normal_end_date = new_end,
        compensation_end_date = case when compensation_end_date is not null
          then greatest(new_end, compensation_end_date + end_shift) end,
        updated_at = now()
      where id = e.id;
      update public.student_attendance_plans set normal_planned_end_date = new_end,
        compensation_planned_end_date = case when compensation_planned_end_date is not null
          then greatest(new_end, compensation_planned_end_date + end_shift) end,
        updated_by = actor.id
      where organization_id = e.organization_id and enrollment_id = e.id;
      r.new_values := r.new_values || jsonb_build_object('planned_end_date', new_end, 'freeze_resume_date', p_resume);
    end if;

    if p_action = 'confirm_resume' then
      update public.approval_requests set new_values = r.new_values || jsonb_build_object('callback_pending', false)
        where id = r.id returning * into r;
      update public.student_activity_logs set reminder_completed = true, reminder_completed_at = now(),
        reminder_completed_by = actor.id
        where organization_id = r.organization_id and source_type = 'approval_request'
          and source_id = r.id and activity_type = 'student_note_reminder';
      insert into public.student_activity_logs (organization_id, student_id, activity_type, title,
        old_value, new_value, source_type, source_id, performed_by, performed_at)
      values (r.organization_id, r.student_id, 'approval_applied', 'Dönüş tarihi telefonla teyit edildi',
        jsonb_build_object('freeze_resume_date', e.freeze_resume_date), r.new_values, 'approval_request', r.id, actor.id, now());
      return jsonb_build_object('id', r.id, 'student_id', r.student_id, 'status', 'resume_confirmed',
        'requested_by', r.requested_by, 'new_values', r.new_values);
    end if;

    if p_action = 'approve' and p_callback then
      insert into public.student_activity_logs (organization_id, student_id, activity_type, title, description,
        source_type, source_id, performed_by, performed_at, reminder_at, reminder_completed)
      values (r.organization_id, r.student_id, 'student_note_reminder', 'Kursiyerin dönüş tarihini telefonla teyit edin',
        'Kursiyer dosyasındaki Kayıt Dondur / Başlat bölümünden teyit edilen tarihi kaydedin.',
        'approval_request', r.id, actor.id, now(),
        greatest(now(), ((p_resume - 3) + time '10:00') at time zone 'Europe/Istanbul'), false);
    end if;

    update public.approval_requests set
      status = case when p_action = 'approve' then 'approved' else 'rejected' end,
      reviewed_by = actor.id, reviewed_by_name = actor.full_name, reviewed_at = now(),
      review_note = left(p_note,1000), applied_at = case when p_action = 'approve' then now() end,
      new_values = r.new_values
    where id = r.id returning * into r;

    insert into public.approval_audit_logs (
      organization_id, approval_request_id, module, request_type, entity_type, entity_id,
      student_id, branch_id, group_id, decision, requested_by, requested_by_name, requested_at,
      decided_by, decided_by_name, decided_at, reason, review_note, old_values, new_values, snapshot
    ) values (
      r.organization_id, r.id, r.module, r.request_type, r.entity_type, r.entity_id,
      r.student_id, r.branch_id, r.group_id, r.status, r.requested_by, r.requested_by_name, r.requested_at,
      actor.id, actor.full_name, now(), r.reason, r.review_note, r.old_values, r.new_values, to_jsonb(r)
    );

    insert into public.student_activity_logs (
      organization_id, student_id, activity_type, title, old_value, new_value,
      source_type, source_id, performed_by, performed_at, approved_by, approved_at
    ) values (
      r.organization_id, r.student_id, case when p_action = 'approve' then 'approval_applied' else 'approval_rejected' end,
      case when p_action = 'approve' then 'Kayıt dondurma onaylandı' else 'Kayıt dondurma reddedildi' end,
      r.old_values, r.new_values, 'approval_request', r.id, actor.id, now(),
      case when p_action = 'approve' then actor.id end, r.applied_at
    );
  end if;

  return jsonb_build_object('id',r.id,'student_id',r.student_id,'status',r.status,
    'requested_by',r.requested_by,'new_values',r.new_values);
exception when unique_violation then
  raise exception 'Kursiyerin bekleyen dondurma talebi var veya dondurma hakkı kullanılmış.';
end;
$$;
revoke all on function public.process_enrollment_freeze(text,uuid,date,date,text,boolean) from public;
grant execute on function public.process_enrollment_freeze(text,uuid,date,date,text,boolean) to authenticated;

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
    if (e.freeze_start_date is null or d < e.freeze_start_date or d >= e.freeze_resume_date)
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

update public.guardian_documents
set body = replace(body,
  'Bireysel nedenlerle kayıt dondurma, kullanılmayan dersleri ileri tarihe aktarma veya pakete ek ders tanımlama yapılmaz.',
  'Her kursiyer yönetici onayıyla bir kez, en fazla bir takvim ayı kayıt dondurabilir. Onaylı dondurma süresindeki ders hakları korunur. Bireysel devamsızlık nedeniyle ders aktarımı veya pakete ek ders tanımlaması yapılmaz.')
where organization_id = '2aa21b5f-ba88-484e-b450-e50bcc7f2f7d'
  and title = 'Sprint Yüzme Okulu Kurs Kuralları'
  and document_type = 'information' and not requires_consent and is_active
  and body like '%Bireysel nedenlerle kayıt dondurma, kullanılmayan dersleri ileri tarihe aktarma veya pakete ek ders tanımlama yapılmaz.%';

commit;

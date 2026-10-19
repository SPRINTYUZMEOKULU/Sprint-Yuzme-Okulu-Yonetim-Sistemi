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
    if p_start_date > today then raise exception 'Başlatma tarihi gelecekte olamaz.'; end if;
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
    update public.student_enrollments set actual_started_at=case when p_start_date < today then (p_start_date + time '12:00') at time zone 'Europe/Istanbul' else now() end,updated_at=now() where id=e.id;
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

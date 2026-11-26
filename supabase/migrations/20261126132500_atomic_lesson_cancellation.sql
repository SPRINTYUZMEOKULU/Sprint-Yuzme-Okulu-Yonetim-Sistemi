create or replace function public.save_lesson_cancellation(
  p_log jsonb, p_makeup jsonb, p_plan_id uuid, p_enrollment_id uuid,
  p_expected_end date, p_new_end date
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  activity public.student_activity_logs%rowtype;
  makeup public.student_compensation_lessons%rowtype;
  enrollment public.student_enrollments%rowtype;
  makeup_id uuid;
  cancelled_date date;
begin
  activity := jsonb_populate_record(null::public.student_activity_logs, p_log);
  if auth.uid() is distinct from activity.performed_by or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
      and p.organization_id = activity.organization_id
      and (p.role::text in ('owner','admin','branch_manager','registration_staff') or exists (
        select 1 from public.staff s where s.auth_user_id = p.id and s.is_active and s.login_enabled and s.is_super_user
      ))
  ) then
    raise exception 'Ders operasyonu için yetki gerekiyor.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(concat(activity.organization_id,activity.student_id,'compensation_plan'),0));
  select * into enrollment from public.student_enrollments e
    where e.id = p_enrollment_id and e.organization_id = activity.organization_id
      and e.student_id = activity.student_id and e.status = 'active'
      and e.group_id = (activity.new_value->>'group_id')::uuid for update;
  if not found or enrollment.compensation_end_date is distinct from p_expected_end then
    raise exception 'Kayıt dönemi değişti. Güncel kayıtla tekrar deneyin.';
  end if;
  cancelled_date := (activity.old_value->>'cancelled_lesson_date')::date;
  if not exists (
    select 1 from public.lesson_schedules s
    where s.id = activity.source_id and s.organization_id = activity.organization_id and s.is_active
      and s.group_id = enrollment.group_id and (case when s.weekday = 0 then 7 else s.weekday end) = extract(isodow from cancelled_date)
  ) then raise exception 'İptal edilen seans doğrulanamadı.'; end if;
  if exists (
    select 1 from public.student_activity_logs l where l.organization_id = activity.organization_id
      and l.student_id = activity.student_id and l.activity_type = 'lesson_cancellation_compensation'
      and l.source_id = activity.source_id
      and l.old_value->>'cancelled_lesson_date' = activity.old_value->>'cancelled_lesson_date'
  ) then
    raise exception 'Bu dersin iptal / telafi işlemi zaten kayıtlı.';
  end if;

  if p_makeup is not null then
    makeup := jsonb_populate_record(null::public.student_compensation_lessons, p_makeup);
    if makeup.lesson_date is null or makeup.lesson_date <= cancelled_date or not exists (
      select 1 from public.lesson_schedules s join public.training_groups target on target.id = s.group_id
        join public.training_groups source on source.id = enrollment.group_id
      where s.id = makeup.target_schedule_id and s.group_id = makeup.target_group_id and s.is_active and target.is_active
        and s.organization_id = activity.organization_id and target.organization_id = activity.organization_id
        and source.organization_id = activity.organization_id and target.branch_id = source.branch_id
        and (case when s.weekday = 0 then 7 else s.weekday end) = extract(isodow from makeup.lesson_date)
    ) then raise exception 'Telafi tarihi veya aktif hedef seansı doğrulanamadı.'; end if;
    if exists (
      select 1 from public.student_compensation_lessons c where c.organization_id = activity.organization_id
        and c.student_id = activity.student_id and c.lesson_date = makeup.lesson_date
        and c.target_schedule_id = makeup.target_schedule_id and c.status in ('planned','completed')
    ) then
      raise exception 'Bu tarih ve seansta zaten telafi var.';
    end if;
    insert into public.student_compensation_lessons (
      organization_id, student_id, enrollment_id, target_group_id, target_schedule_id, lesson_date, status, note, created_by
    ) values (
      activity.organization_id, activity.student_id, enrollment.id, makeup.target_group_id, makeup.target_schedule_id,
      makeup.lesson_date, 'planned', makeup.note, auth.uid()
    ) returning id into makeup_id;

    if p_plan_id is not null then
      update public.student_attendance_plans set compensation_planned_end_date = greatest(compensation_planned_end_date,p_new_end),
        updated_by = auth.uid(), updated_at = now()
        where id = p_plan_id and organization_id = activity.organization_id and enrollment_id = enrollment.id and is_active;
      if not found then raise exception 'Devam planı güncellenemedi.'; end if;
    end if;
    update public.student_enrollments set compensation_end_date = greatest(compensation_end_date,p_new_end),
      updated_at = now() where id = enrollment.id and organization_id = activity.organization_id;
    if not found then raise exception 'Telafili bitiş tarihi güncellenemedi.'; end if;
  end if;

  insert into public.student_activity_logs (
    organization_id,student_id,activity_type,title,description,old_value,new_value,source_type,source_id,
    performed_by,approved_by,performed_at,approved_at
  ) values (
    activity.organization_id,activity.student_id,'lesson_cancellation_compensation',activity.title,activity.description,
    activity.old_value,activity.new_value || jsonb_build_object('compensation_id',makeup_id),
    'lesson_cancellation_operation',activity.source_id,auth.uid(),auth.uid(),now(),now()
  );
  return makeup_id;
end;
$$;
revoke all on function public.save_lesson_cancellation(jsonb,jsonb,uuid,uuid,date,date) from public, anon;
grant execute on function public.save_lesson_cancellation(jsonb,jsonb,uuid,uuid,date,date) to authenticated;

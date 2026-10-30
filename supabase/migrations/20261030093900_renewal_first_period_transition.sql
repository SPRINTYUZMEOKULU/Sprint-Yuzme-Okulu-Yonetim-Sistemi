-- A returning student without an active enrollment needs the same schedule transition.
create or replace function private.finalize_enrollment_renewal(p_new_id uuid,p_previous_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare actor public.profiles%rowtype; e public.student_enrollments%rowtype; previous public.student_enrollments%rowtype; result_status text;
begin
  select * into actor from public.profiles where id=auth.uid() and is_active=true;
  if not found or actor.role::text not in ('owner','admin','branch_manager','registration_staff') then raise exception 'Yenileme yetkiniz bulunmuyor.'; end if;
  select * into e from public.student_enrollments where id=p_new_id and organization_id=actor.organization_id;
  if not found or e.status<>'renewal_pending' then raise exception 'Hazırlanan yeni dönem bulunamadı.'; end if;
  perform 1 from public.students where id=e.student_id and organization_id=actor.organization_id and is_deleted=false for update;
  if not found then raise exception 'Öğrenci bulunamadı.'; end if;
  select * into previous from public.student_enrollments where student_id=e.student_id and organization_id=e.organization_id and status='active' for update;
  if previous.id is distinct from p_previous_id then raise exception 'Mevcut kayıt değişti. Sayfayı yenileyin.'; end if;
  if exists(select 1 from public.student_enrollments where student_id=e.student_id and organization_id=e.organization_id and status='scheduled') then
    raise exception 'Bu kursiyerin hazırlanmış sonraki dönemi zaten var. Önce o kaydı kontrol edin.';
  end if;
  if previous.id is not null and e.start_date<=previous.planned_end_date then
    raise exception 'Yeni dönem, mevcut dönemin normal bitişinden sonra başlamalıdır.';
  end if;
  if e.start_date>(now() at time zone 'Europe/Istanbul')::date then
    update public.student_enrollments set status='scheduled',start_confirmation_required=false,actual_started_at=null,updated_at=now() where id=e.id;
    result_status:='scheduled';
  else
    perform private.activate_enrollment_period(e.id); result_status:='active';
  end if;
  return jsonb_build_object('ok',true,'status',result_status);
end $$;

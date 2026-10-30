-- Dönem geçişi, paket borcu, yenileme geçmişi ve onay tüketimi tek transaction.
-- Mevcut geçiş fonksiyonu telafi ve önceki dönem koruma kurallarını uygular.
create or replace function private.complete_student_renewal(
  p_new_id uuid, p_previous_id uuid, p_note text, p_approval_id uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
declare
  actor public.profiles%rowtype;
  e public.student_enrollments%rowtype;
  pkg public.course_packages%rowtype;
  approval public.approval_requests%rowtype;
  result jsonb;
begin
  select * into actor from public.profiles where id=auth.uid() and is_active=true;
  if not found or actor.role::text not in ('owner','admin','branch_manager','registration_staff') then
    raise exception 'Yenileme yetkiniz bulunmuyor.';
  end if;
  select * into e from public.student_enrollments where id=p_new_id and organization_id=actor.organization_id;
  if not found or e.status<>'renewal_pending' then raise exception 'Hazırlanan yeni dönem bulunamadı.'; end if;
  -- Serialize every renewal for the same student before taking enrollment/approval locks.
  perform 1 from public.students where id=e.student_id and organization_id=actor.organization_id and is_deleted=false for update;
  if not found then raise exception 'Öğrenci bulunamadı.'; end if;
  select * into pkg from public.course_packages where id=e.package_id and organization_id=actor.organization_id and is_active=true;
  if not found then raise exception 'Aktif paket bulunamadı.'; end if;
  if p_approval_id is not null then
    select * into approval from public.approval_requests where id=p_approval_id and organization_id=actor.organization_id
      and student_id=e.student_id and request_type='registration_custom_lesson_count' for update;
    if not found or approval.status<>'approved' or approval.metadata->>'source' is distinct from 'student_renewal_center'
      or approval.metadata->>'consumed_at' is not null
      or approval.new_values->>'total_lessons' is distinct from e.total_lessons::text
      or approval.new_values->>'package_id' is distinct from e.package_id::text
      or approval.new_values->>'group_id' is distinct from e.group_id::text
      or approval.new_values->>'start_date' is distinct from e.start_date::text
      or approval.new_values->>'payment_due_date' is distinct from e.payment_due_date::text then
      raise exception 'Yenileme onayı geçerli değil veya daha önce kullanılmış.';
    end if;
  elsif e.total_lessons<>pkg.lesson_count and e.total_lessons not in (8,12) then
    raise exception 'Standart dışı ders sayısı yönetici onayı gerektirir.';
  end if;
  result:=private.finalize_enrollment_renewal(p_new_id,p_previous_id);
  if coalesce((result->>'ok')::boolean,false)=false then raise exception 'Dönem geçişi tamamlanamadı.'; end if;
  if pkg.price>0 and not exists(select 1 from public.student_financial_obligations where
    organization_id=e.organization_id and enrollment_id=e.id and obligation_type='installment'
    and title ilike 'Paket ücreti%' and status<>'cancelled') then
    insert into public.student_financial_obligations(organization_id,student_id,enrollment_id,obligation_type,title,description,amount,paid_amount,due_date,status,reminder_days,created_by)
      values(e.organization_id,e.student_id,e.id,'installment','Paket ücreti · '||pkg.name,
        'Kayıt yenileme sırasında otomatik oluşturulan yeni dönem paket borcu.',pkg.price,0,coalesce(e.payment_due_date,e.start_date),'open',3,actor.id);
  end if;
  insert into public.student_renewal_events(organization_id,student_id,previous_enrollment_id,new_enrollment_id,renewal_status,note,created_by)
    values(e.organization_id,e.student_id,p_previous_id,e.id,case when result->>'status'='scheduled' then 'scheduled' else 'completed' end,nullif(left(trim(p_note),1000),''),actor.id);
  insert into public.student_activity_logs(organization_id,student_id,activity_type,title,description,source_type,source_id,new_value,performed_by)
    values(e.organization_id,e.student_id,'registration_renewed','Kayıt yenilendi',
      format('%s derslik yeni dönem %s tarihinde başlayacak. Planlanan bitiş: %s.',e.total_lessons,e.start_date,e.planned_end_date),
      'student_renewal',e.id,jsonb_build_object('enrollment_id',e.id,'package_id',e.package_id,'lesson_count',e.total_lessons,'custom_approval_id',p_approval_id),actor.id);
  if p_approval_id is not null then
    update public.approval_requests set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('consumed_at',now(),'consumed_enrollment_id',e.id)
      where id=p_approval_id and organization_id=actor.organization_id;
  end if;
  return result;
end $$;
create or replace function public.complete_student_renewal(p_new_id uuid,p_previous_id uuid,p_note text,p_approval_id uuid)
returns jsonb language sql security invoker set search_path=pg_catalog,public,pg_temp as $$
  select private.complete_student_renewal(p_new_id,p_previous_id,p_note,p_approval_id)
$$;
revoke all on function private.complete_student_renewal(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.complete_student_renewal(uuid,uuid,text,uuid) from public,anon;
grant execute on function private.complete_student_renewal(uuid,uuid,text,uuid),public.complete_student_renewal(uuid,uuid,text,uuid) to authenticated;

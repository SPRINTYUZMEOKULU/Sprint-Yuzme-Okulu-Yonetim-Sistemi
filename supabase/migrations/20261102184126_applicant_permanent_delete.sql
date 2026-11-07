-- Only the authenticated application server may call this transaction.
create or replace function public.delete_unregistered_applicant(
 p_organization_id uuid, p_actor_id uuid, p_student_id uuid,
 p_expected_updated_at timestamptz, p_confirmation text,
 p_require_rejection boolean default false, p_message_id uuid default null
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare candidate public.students%rowtype;
begin
 if p_confirmation is distinct from 'SİL' then raise exception 'Kalıcı silme onayı gereklidir.'; end if;
 if not exists(select 1 from public.profiles where id=p_actor_id and organization_id=p_organization_id and role in ('owner','admin'))
 and not exists(select 1 from public.staff where auth_user_id=p_actor_id and organization_id=p_organization_id and is_active and login_enabled and is_super_user)
 then raise exception 'Kalıcı silme yetkisi bulunamadı.'; end if;
 select * into candidate from public.students where id=p_student_id and organization_id=p_organization_id for update;
 if not found or candidate.is_deleted or candidate.status not in ('pre_registration','waiting_payment','waiting_approval','registration_declined')
 then raise exception 'Silinebilecek başvuru bulunamadı.'; end if;
 if candidate.updated_at is distinct from p_expected_updated_at then raise exception 'Başvuru değişmiş. Dosyayı yenileyin.'; end if;
 -- The parent lock also serializes FK-backed inserts before this history check.
 if exists(select 1 from public.student_enrollments where student_id=p_student_id)
 or exists(select 1 from public.student_payments where student_id=p_student_id)
 or exists(select 1 from public.attendance_records where student_id=p_student_id)
 or exists(select 1 from public.student_financial_obligations where student_id=p_student_id)
 or exists(select 1 from public.student_payment_plans where student_id=p_student_id)
 or exists(select 1 from public.student_payment_installments where student_id=p_student_id)
 or exists(select 1 from public.invoice_bank_entries where matched_student_id=p_student_id)
 then raise exception 'Ders, ödeme/borç veya banka kaydı bulunan dosya bu işlemle silinemez.'; end if;
 if p_require_rejection and not exists(select 1 from public.message_logs where id=p_message_id and organization_id=p_organization_id
 and student_id=p_student_id and template_key='registration_rejected' and status='sent' and metadata->>'delivery_confirmation'='manual_confirmed')
 then raise exception 'Önce ret mesajının gönderimini onaylayın.'; end if;
 -- Remove non-cascading applicant data in the same transaction as the parent.
 delete from public.registration_consents where organization_id=p_organization_id and student_id=p_student_id;
 delete from public.approval_history where organization_id=p_organization_id and student_id=p_student_id;
 delete from public.approval_requests where organization_id=p_organization_id and (student_id=p_student_id or (entity_type='student' and entity_id=p_student_id::text));
 delete from public.guardian_requests where organization_id=p_organization_id and student_id=p_student_id;
 delete from public.calendar_events where organization_id=p_organization_id and student_id=p_student_id;
 delete from public.students where organization_id=p_organization_id and id=p_student_id;
 return p_student_id;
end; $$;
revoke all on function public.delete_unregistered_applicant(uuid,uuid,uuid,timestamptz,text,boolean,uuid) from public, anon, authenticated;
grant execute on function public.delete_unregistered_applicant(uuid,uuid,uuid,timestamptz,text,boolean,uuid) to service_role;

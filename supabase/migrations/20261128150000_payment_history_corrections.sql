create or replace function public.correct_student_package_payment(
  p_organization uuid, p_actor uuid, p_payment uuid, p_expected jsonb,
  p_cancel boolean, p_amount numeric, p_method text, p_description text,
  p_reason text, p_apply boolean, p_approval uuid, p_review jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  payment public.student_payments%rowtype;
  debt public.student_financial_obligations%rowtype;
  paid numeric;
  changed_at timestamptz := now();
begin
  if not exists (
    select 1 from public.profiles where id = p_actor and organization_id = p_organization
      and is_active and role::text in ('owner','admin','branch_manager','registration_staff','accounting')
  ) then raise exception 'Ödeme işlemi yetkisi gerekiyor.'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'İşlem gerekçesi zorunludur.'; end if;

  select * into payment from public.student_payments
  where id = p_payment and organization_id = p_organization for update;
  if payment.id is null or payment.cancelled_at is not null
    or coalesce(payment.payment_status::text, '') not in ('received','recorded','paid','completed') then
    raise exception 'Geçerli bir tahsilat bulunamadı veya tahsilat daha önce iptal edildi.';
  end if;
  if payment.amount is distinct from (p_expected->>'amount')::numeric
    or payment.payment_method::text is distinct from p_expected->>'payment_method'
    or (p_expected ? 'description' and payment.description is distinct from p_expected->>'description')
    or (p_expected ? 'cash_handover_status' and payment.cash_handover_status::text is distinct from p_expected->>'cash_handover_status') then
    raise exception 'Tahsilat talep sonrasında değişti. Kaydı kontrol edip yeni talep oluşturun.';
  end if;
  if payment.enrollment_id is null or payment.payment_installment_id is not null
    or exists (
      select 1 from public.student_activity_logs l
      where l.organization_id = p_organization and l.student_id = payment.student_id
        and l.activity_type = 'financial_obligation_payment' and l.new_value->>'payment_id' = p_payment::text
    ) then raise exception 'Bu tahsilat ek borç veya taksit akışından incelenmelidir.'; end if;
  if exists (select 1 from public.payment_document_requests where payment_id = p_payment)
    or exists (select 1 from public.esmm_issue_approvals where payment_id = p_payment)
    or exists (select 1 from public.manual_esmm_reconciliation where payment_id = p_payment)
  then raise exception 'Bu tahsilata belge bağlı. İşlemi muhasebe üzerinden inceleyin.'; end if;
  if p_apply and p_approval is not null then
    update public.approval_requests set status = 'approved', reviewed_by = p_actor,
      reviewed_by_name = p_review->>'name', review_note = p_review->>'note',
      reviewed_at = changed_at, applied_at = changed_at
    where id = p_approval and organization_id = p_organization and entity_id = p_payment
      and status = 'pending' and request_type = case when p_cancel then 'payment_cancel' else 'payment_edit' end;
    if not found then raise exception 'Bekleyen ödeme onayı bulunamadı.'; end if;
  end if;
  if not p_apply then return; end if;

  if p_cancel then
    update public.student_payments set payment_status = 'cancelled',
      cancellation_reason = p_reason, cancelled_by = p_actor, cancelled_at = changed_at
      where id = p_payment;
  else
    if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
      raise exception 'Geçerli bir ödeme tutarı giriniz.';
    end if;
    update public.student_payments set amount = p_amount, description = p_description
      where id = p_payment;
    if payment.payment_method::text is distinct from p_method then
      if p_method not in ('cash','card','bank_transfer','eft','other') or p_method is null then
        raise exception 'Ödeme yöntemi geçersiz.';
      end if;
      -- Use the column type for the payment method on both text and enum schemas.
      update public.student_payments p set payment_method = v.payment_method,
        cash_handover_status = case when p_method = 'cash' then 'with_staff' else 'main_cash_confirmed' end,
        cash_handover_requested_at = null,
        cash_handover_approved_by = case when p_method = 'cash' then null else p_actor end,
        cash_handover_approved_at = case when p_method = 'cash' then null else changed_at end
      from jsonb_populate_record(null::public.student_payments, jsonb_build_object('payment_method', p_method)) v
      where p.id = p_payment;
    end if;
  end if;

  select * into debt from public.student_financial_obligations
  where organization_id = p_organization and student_id = payment.student_id
    and enrollment_id = payment.enrollment_id and obligation_type = 'installment'
    and title ilike 'Paket ücreti%' and status in ('open','partially_paid','paid')
  order by created_at desc limit 1 for update;
  if debt.id is not null then
    select least(debt.amount, coalesce(sum(p.amount), 0)) into paid
      from public.student_payments p where p.organization_id = p_organization
      and p.student_id = payment.student_id and p.enrollment_id = payment.enrollment_id
      and p.cancelled_at is null and p.payment_status::text in ('received','recorded','paid','completed')
      and not exists (
        select 1 from public.student_activity_logs l
        where l.organization_id = p_organization and l.student_id = p.student_id
          and l.activity_type = 'financial_obligation_payment' and l.new_value->>'payment_id' = p.id::text
      );
    update public.student_financial_obligations set paid_amount = paid,
      status = case when paid >= debt.amount then 'paid' when paid > 0 then 'partially_paid' else 'open' end,
      paid_by = case when paid > 0 then p_actor else null end,
      paid_at = case when paid >= debt.amount then coalesce(debt.paid_at, changed_at) else null end,
      updated_at = changed_at where id = debt.id;
  end if;

  if p_approval is null then
    insert into public.student_activity_logs
      (organization_id,student_id,activity_type,title,description,source_type,source_id,old_value,new_value,performed_by,performed_at)
    values
      (p_organization,payment.student_id,case when p_cancel then 'payment_cancelled' else 'payment_edited' end,
       case when p_cancel then 'Ödeme iptal edildi' else 'Ödeme düzeltildi' end,
       p_reason,'student_payment',p_payment,p_expected,
       case when p_cancel then jsonb_build_object('payment_status','cancelled')
            else jsonb_build_object('amount',p_amount,'payment_method',p_method,'description',p_description) end,
       p_actor,changed_at);
  end if;
end $$;

revoke all on function public.correct_student_package_payment(uuid,uuid,uuid,jsonb,boolean,numeric,text,text,text,boolean,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.correct_student_package_payment(uuid,uuid,uuid,jsonb,boolean,numeric,text,text,text,boolean,uuid,jsonb) to service_role;

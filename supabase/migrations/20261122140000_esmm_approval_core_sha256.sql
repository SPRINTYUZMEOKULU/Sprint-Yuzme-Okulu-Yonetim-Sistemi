-- Use the built-in SHA-256 with the same text bytes as pgcrypto digest.
create or replace function public.approve_esmm_issue_request(
  p_organization_id uuid, p_request_id uuid, p_actor_id uuid
) returns table(ok boolean, result_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_request public.payment_document_requests%rowtype;
  v_payment public.student_payments%rowtype;
  v_fingerprint text;
begin
  -- This function is callable only from the authenticated manager-only server action
  -- using the service-role key. The actor must also be active in this organization.
  if not exists (
    select 1 from public.profiles
    where id=p_actor_id and organization_id=p_organization_id
      and is_active=true and role in ('owner','admin')
  ) then
    return query select false,'actor_not_authorized'::text; return;
  end if;

  select * into v_request from public.payment_document_requests
    where id=p_request_id and organization_id=p_organization_id for update;
  if not found then
    return query select false,'request_not_found'::text; return;
  end if;

  if v_request.status <> 'payment_received'
    or v_request.document_type <> 'e_smm'
    or v_request.document_status <> 'not_created'
    or v_request.payment_id is null
    or v_request.document_number is not null
    or v_request.provider_document_id is not null
    or v_request.document_pdf_url is not null
    or v_request.document_xml_url is not null
    or v_request.customer_consent_at is null
    or v_request.customer_completed_at is null
    or length(trim(coalesce(v_request.recipient_name,''))) < 2
    or length(trim(coalesce(v_request.tax_identity_number,''))) not in (10,11)
    or length(trim(coalesce(v_request.address,''))) < 5
    or length(trim(coalesce(v_request.city,''))) < 2
    or length(trim(coalesce(v_request.district,''))) < 2
  then
    return query select false,'request_not_ready'::text; return;
  end if;

  select * into v_payment from public.student_payments
    where id=v_request.payment_id and organization_id=p_organization_id for update;
  if not found or v_payment.student_id is distinct from v_request.student_id
    or v_payment.payment_method not in ('bank_transfer','eft')
    or v_payment.payment_status <> 'received'
    or v_payment.cancelled_at is not null
    or v_payment.currency <> 'TRY'
    or v_request.expected_amount is null
    or v_payment.amount <> v_request.expected_amount
    or (v_request.enrollment_id is not null and v_payment.enrollment_id is distinct from v_request.enrollment_id)
  then
    return query select false,'payment_not_ready'::text; return;
  end if;

  if exists (
    select 1 from public.esmm_issue_approvals a
      where a.request_id=v_request.id or a.payment_id=v_payment.id
  ) then
    return query select false,'already_approved'::text; return;
  end if;

  -- Fingerprint lets the future send handler verify that material input fields
  -- have not changed since the manager approval.
  v_fingerprint := encode(pg_catalog.sha256(pg_catalog.convert_to(concat_ws('|',
    v_request.id::text,v_payment.id::text,v_payment.amount::text,
    v_request.recipient_type,v_request.recipient_name,v_request.tax_identity_number,
    v_request.address,v_request.city,v_request.district,
    v_request.document_type,v_request.customer_completed_at::text
  ),pg_catalog.current_setting('server_encoding')::name)),'hex');

  insert into public.esmm_issue_approvals
    (organization_id,request_id,payment_id,approved_by,fingerprint,amount)
  values (p_organization_id,v_request.id,v_payment.id,p_actor_id,v_fingerprint,v_payment.amount);
  return query select true,'approved_not_sent'::text;
exception when unique_violation then
  return query select false,'already_approved'::text;
end;
$$;
revoke all on function public.approve_esmm_issue_request(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.approve_esmm_issue_request(uuid,uuid,uuid) to service_role;

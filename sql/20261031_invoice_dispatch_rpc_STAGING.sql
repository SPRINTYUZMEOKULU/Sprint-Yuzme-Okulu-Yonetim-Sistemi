-- SprintOS e-document approval and one-way send claim, staging only.
-- Apply ONLY after reviewing authenticated operator checks and a staging test.
-- No provider request is made by these functions.
create or replace function public.approve_invoice_dispatch(
  p_org uuid, p_request uuid, p_actor uuid, p_payload_hash text,
  p_external_code text, p_ettn uuid
) returns uuid language plpgsql security invoker set search_path = public as $$
declare d public.payment_document_requests%rowtype;
        p public.student_payments%rowtype;
        v_id uuid; v_snapshot text;
begin
  if current_user <> 'service_role' then raise exception 'service role required'; end if;
  if p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid payload hash'; end if;
  -- The caller must authenticate/authorize the acting manager; independently check stored role.
  if not exists (
    select 1 from public.profiles x where x.id=p_actor
      and x.organization_id=p_org and x.role in ('owner','admin') and x.is_active=true
  ) then raise exception 'authorized manager required'; end if;
  select * into d from public.payment_document_requests where id=p_request and organization_id=p_org for update;
  if not found or d.status <> 'payment_received' or d.document_status <> 'not_created'
    or d.document_type = 'pending_classification' or d.payment_id is null
    or d.customer_consent_at is null or d.customer_completed_at is null
    or nullif(btrim(d.recipient_name),'') is null or nullif(btrim(d.address),'') is null
    or d.provider_document_id is not null or d.document_number is not null
  then raise exception 'document request not eligible'; end if;
  select * into p from public.student_payments where id=d.payment_id and organization_id=p_org for update;
  if not found or p.student_id is distinct from d.student_id
    or (d.enrollment_id is not null and p.enrollment_id is distinct from d.enrollment_id)
    or p.payment_status <> 'received' or p.cancelled_at is not null
    or p.payment_method not in ('bank_transfer','eft') or p.currency <> 'TRY'
    or p.amount <= 0 or (d.expected_amount is not null and p.amount <> d.expected_amount)
  then raise exception 'payment is not eligible'; end if;
  v_snapshot := encode(digest(concat_ws('|',p.id::text,p.organization_id::text,
      p.student_id::text,coalesce(p.enrollment_id::text,''),p.amount::text,
      p.currency,p.payment_method,p.payment_status,coalesce(p.cancelled_at::text,'')), 'sha256'),'hex');
  insert into public.invoice_dispatch_controls
    (organization_id,request_id,payment_id,approved_by,approved_payload_hash,
     payment_snapshot_hash,external_document_code,ettn)
  values(p_org,p_request,p.id,p_actor,p_payload_hash,v_snapshot,p_external_code,p_ettn)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.approve_invoice_dispatch(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.approve_invoice_dispatch(uuid,uuid,uuid,text,text,uuid) to service_role;

create or replace function public.claim_invoice_dispatch(
  p_org uuid, p_control uuid, p_payload_hash text
) returns boolean language plpgsql security invoker set search_path=public as $$
declare c public.invoice_dispatch_controls%rowtype;
        d public.payment_document_requests%rowtype;
        p public.student_payments%rowtype;
        v_snapshot text;
begin
  if current_user <> 'service_role' then raise exception 'service role required'; end if;
  select * into c from public.invoice_dispatch_controls
   where id=p_control and organization_id=p_org for update;
  if not found or c.dispatch_state <> 'approved' or c.approved_payload_hash <> p_payload_hash
    then return false; end if;
  select * into d from public.payment_document_requests where id=c.request_id and organization_id=p_org for update;
  if not found or d.payment_id is distinct from c.payment_id
    or d.status <> 'payment_received' or d.document_status <> 'not_created'
    or d.provider_document_id is not null or d.document_number is not null
    then return false; end if;
  select * into p from public.student_payments where id=c.payment_id and organization_id=p_org for update;
  if not found or p.student_id is distinct from d.student_id
    or (d.enrollment_id is not null and p.enrollment_id is distinct from d.enrollment_id)
    or p.payment_status <> 'received' or p.cancelled_at is not null
    or p.payment_method not in ('bank_transfer','eft') or p.currency <> 'TRY'
    or p.amount <= 0 or (d.expected_amount is not null and p.amount <> d.expected_amount)
    then return false; end if;
  v_snapshot := encode(digest(concat_ws('|',p.id::text,p.organization_id::text,
      p.student_id::text,coalesce(p.enrollment_id::text,''),p.amount::text,
      p.currency,p.payment_method,p.payment_status,coalesce(p.cancelled_at::text,'')), 'sha256'),'hex');
  if v_snapshot <> c.payment_snapshot_hash then return false; end if;
  update public.invoice_dispatch_controls set dispatch_state='dispatching',
    dispatch_started_at=now() where id=p_control;
  return true;
end $$;
revoke all on function public.claim_invoice_dispatch(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_invoice_dispatch(uuid,uuid,text) to service_role;
-- IMPORTANT: dispatching must not be reset automatically. Timeout => uncertain, query provider.
-- The application MUST compare the full approved document input against its hash,
-- and revalidate buyer data, tax classification, and manager approval before calling.

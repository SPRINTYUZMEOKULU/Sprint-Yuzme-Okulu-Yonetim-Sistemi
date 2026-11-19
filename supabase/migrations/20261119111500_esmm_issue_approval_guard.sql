-- SprintOS: persist a one-payment / one-document manager approval, without issuing anything.
-- Provider sending, authorization, and document storage are deliberately NOT enabled here.
create extension if not exists pgcrypto;

create table if not exists public.esmm_issue_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_id uuid not null references public.payment_document_requests(id) on delete restrict,
  payment_id uuid not null references public.student_payments(id) on delete restrict,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  fingerprint text not null,
  amount numeric(12,2) not null check (amount > 0),
  issue_state text not null default 'not_sent' check (issue_state in ('not_sent','sending','uncertain','issued','failed')),
  provider_ettn uuid,
  provider_document_number text,
  created_at timestamptz not null default now(),
  constraint esmm_issue_approvals_one_request unique (request_id),
  constraint esmm_issue_approvals_one_payment unique (payment_id),
  constraint esmm_issue_approvals_one_ettn unique (provider_ettn),
  constraint esmm_issue_approvals_fingerprint_sha256 check (fingerprint ~ '^[a-f0-9]{64}$')
);
create index if not exists esmm_issue_approvals_org_date on public.esmm_issue_approvals (organization_id, approved_at desc);
alter table public.esmm_issue_approvals enable row level security;
revoke all on public.esmm_issue_approvals from public, anon, authenticated;
grant select, insert, update on public.esmm_issue_approvals to service_role;

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
  v_fingerprint := encode(digest(concat_ws('|',
    v_request.id::text,v_payment.id::text,v_payment.amount::text,
    v_request.recipient_type,v_request.recipient_name,v_request.tax_identity_number,
    v_request.address,v_request.city,v_request.district,
    v_request.document_type,v_request.customer_completed_at::text
  ),'sha256'),'hex');

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

comment on table public.esmm_issue_approvals is
'Manager pre-send authorization only. A row does NOT imply that an e-SMM was sent, issued, or accepted by GIB. External send remains disabled pending production authorization.';

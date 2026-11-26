-- Record previously-issued portal e-SMM references WITHOUT issuing, marking GIB accepted,
-- or changing payment_document_requests statuses. A record needs further source verification.
create table if not exists public.manual_esmm_reconciliation (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 request_id uuid not null unique references public.payment_document_requests(id) on delete restrict,
 payment_id uuid not null unique references public.student_payments(id) on delete restrict,
 provider text not null default 'isnet_portal' check(provider='isnet_portal'),
 document_number text not null,
 ettn uuid not null,
 issue_date date not null,
 receipt_total numeric(12,2) not null check(receipt_total > 0),
 recorded_by uuid not null,
 recorded_at timestamptz not null default now(),
 verification_state text not null default 'needs_pdf_xml_and_provider_check' check(verification_state in ('needs_pdf_xml_and_provider_check')),
 constraint manual_esmm_receipt_unique unique(organization_id,document_number),
 constraint manual_esmm_ettn_unique unique(ettn),
 constraint manual_esmm_number_format check(document_number ~ '^[A-Z0-9]{10,32}$')
);
create index if not exists manual_esmm_reconciliation_org_date on public.manual_esmm_reconciliation(organization_id,recorded_at desc);
alter table public.manual_esmm_reconciliation enable row level security;
revoke all on public.manual_esmm_reconciliation from public,anon,authenticated;
grant select,insert on public.manual_esmm_reconciliation to service_role;

create or replace function public.record_manual_esmm_reference(
 p_organization_id uuid,p_request_id uuid,p_actor_id uuid,
 p_number text,p_ettn uuid,p_issue_date date,p_total numeric
) returns table(ok boolean,result_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_req public.payment_document_requests%rowtype;
 v_pay public.student_payments%rowtype;
begin
 if not exists(select 1 from public.profiles where id=p_actor_id and organization_id=p_organization_id and is_active=true and role in('owner','admin')) then
  return query select false,'unauthorized'::text; return;
 end if;
 if p_number is null or p_number !~ '^[A-Z0-9]{10,32}$'
   or p_ettn is null or p_issue_date is null or p_issue_date>current_date
   or p_total is null or p_total<=0 then
  return query select false,'invalid_document'::text; return;
 end if;
 select * into v_req from public.payment_document_requests
  where organization_id=p_organization_id and id=p_request_id for update;
 if not found then return query select false,'not_found'::text; return; end if;
 if v_req.document_type <> 'e_smm' or v_req.status <> 'payment_received'
  or v_req.document_status <> 'not_created' or v_req.payment_id is null
  or v_req.provider_document_id is not null or v_req.document_number is not null
  or v_req.document_pdf_url is not null or v_req.document_xml_url is not null
  or v_req.customer_consent_at is null or v_req.customer_completed_at is null
  or length(trim(coalesce(v_req.recipient_name,'')))<2
  or length(trim(coalesce(v_req.tax_identity_number,''))) not in(10,11)
  or length(trim(coalesce(v_req.address,'')))<5
  or length(trim(coalesce(v_req.city,'')))<2 or length(trim(coalesce(v_req.district,'')))<2
  then return query select false,'request_not_ready'::text; return;
 end if;
 select * into v_pay from public.student_payments
  where organization_id=p_organization_id and id=v_req.payment_id for update;
 if not found or v_pay.student_id is distinct from v_req.student_id
  or (v_req.enrollment_id is not null and v_pay.enrollment_id is distinct from v_req.enrollment_id)
  or v_pay.payment_status <> 'received' or v_pay.cancelled_at is not null
  or v_pay.payment_method not in('bank_transfer','eft') or v_pay.currency <> 'TRY'
  or v_req.expected_amount is null or v_req.expected_amount<>v_pay.amount
  or v_pay.amount<>p_total
  then return query select false,'payment_mismatch'::text; return;
 end if;
 if exists(select 1 from public.esmm_issue_approvals where request_id=v_req.id or payment_id=v_pay.id)
  or exists(select 1 from public.esmm_provider_ledger l join public.esmm_issue_approvals a on a.id=l.approval_id where a.request_id=v_req.id or a.payment_id=v_pay.id)
  or exists(select 1 from public.manual_esmm_reconciliation where request_id=v_req.id or payment_id=v_pay.id or ettn=p_ettn or (organization_id=p_organization_id and document_number=p_number))
  then return query select false,'potential_duplicate'::text; return;
 end if;
 insert into public.manual_esmm_reconciliation
 (organization_id,request_id,payment_id,document_number,ettn,issue_date,receipt_total,recorded_by)
 values(p_organization_id,v_req.id,v_pay.id,p_number,p_ettn,p_issue_date,p_total,p_actor_id);
 return query select true,'reference_recorded_unverified'::text;
exception when unique_violation then
 return query select false,'potential_duplicate'::text;
end $$;
revoke all on function public.record_manual_esmm_reference(uuid,uuid,uuid,text,uuid,date,numeric) from public,anon,authenticated;
grant execute on function public.record_manual_esmm_reference(uuid,uuid,uuid,text,uuid,date,numeric) to service_role;
comment on table public.manual_esmm_reconciliation is 'Unverified reference to an already-issued provider portal e-SMM. Does not issue, send, verify, or mark a document as delivered. Requires independent provider PDF/XML reconciliation.';

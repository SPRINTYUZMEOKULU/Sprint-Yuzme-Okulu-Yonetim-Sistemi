-- Staging only: importing a bank statement never creates a payment or invoice.
create table public.invoice_bank_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  account_iban text not null check (account_iban = 'TR140001500158007357481506'),
  row_key text not null check (row_key ~ '^[a-f0-9]{64}$'),
  content_key text not null check (content_key ~ '^[a-f0-9]{64}$'),
  source_file text not null,
  source_file_hash text not null check (source_file_hash ~ '^[a-f0-9]{64}$'),
  source_sheet text not null,
  source_row integer not null check (source_row > 0),
  occurred_at timestamptz not null,
  sender_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'TRY' check (currency = 'TRY'),
  description text not null default '',
  transaction_reference text,
  status text not null default 'review' check (status in ('review','linked','excluded')),
  document_request_id uuid unique references public.payment_document_requests(id),
  matched_student_id uuid references public.students(id),
  imported_by uuid not null references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  unique (organization_id, row_key)
);
alter table public.invoice_bank_entries enable row level security;
revoke all on public.invoice_bank_entries from public, anon, authenticated;
grant select,insert,update on public.invoice_bank_entries to service_role;
create index invoice_bank_entries_content on public.invoice_bank_entries(organization_id,content_key);
create index invoice_bank_entries_review on public.invoice_bank_entries(organization_id,created_at desc);

create view public.invoice_bank_review with (security_invoker=true) as
select entry.*, count(*) filter (where status <> 'excluded') over (partition by organization_id,content_key) as similar_count
from public.invoice_bank_entries entry;
revoke all on public.invoice_bank_review from public, anon, authenticated;
grant select on public.invoice_bank_review to service_role;

create function public.link_invoice_bank_entry(p_organization uuid, p_entry uuid, p_student uuid, p_actor uuid, p_duplicate_note text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare bank_row public.invoice_bank_entries; request_id uuid;
begin
  -- Only server-side service_role can execute; still validate the audit actor.
  if not exists (select 1 from public.profiles p where p.id=p_actor and p.organization_id=p_organization and p.is_active=true and
    (p.role::text in ('owner','admin') or exists(select 1 from public.staff s where s.auth_user_id=p.id and s.is_active=true and s.login_enabled=true and s.is_super_user=true))) then
    raise exception 'Not authorized';
  end if;
  select * into bank_row from public.invoice_bank_entries where id=p_entry and organization_id=p_organization for update;
  if not found then raise exception 'Bank entry not found'; end if;
  if bank_row.status='excluded' then raise exception 'Excluded bank entry'; end if;
  if bank_row.document_request_id is not null then
    if bank_row.matched_student_id<>p_student then raise exception 'Already matched to another student'; end if;
    return bank_row.document_request_id;
  end if;
  if not exists(select 1 from public.students where id=p_student and organization_id=p_organization) then raise exception 'Student not found'; end if;
  -- Similar non-reference records must be resolved before starting a document.
  if exists(select 1 from public.invoice_bank_entries where organization_id=p_organization and content_key=bank_row.content_key and id<>p_entry and status<>'excluded') and length(trim(coalesce(p_duplicate_note,'')))<10 then
    raise exception 'Resolve similar bank entries first';
  end if;
  insert into public.payment_document_requests (organization_id,student_id,payment_method,expected_amount,status,document_provider,document_type,created_by)
    values(p_organization,p_student,'bank_transfer',bank_row.amount,'waiting_customer','nettefatura','pending_classification',p_actor) returning id into request_id;
  update public.invoice_bank_entries set document_request_id=request_id, matched_student_id=p_student, status='linked', reviewed_by=p_actor, reviewed_at=now(), review_note=nullif(trim(p_duplicate_note),'') where id=p_entry;
  return request_id;
end;
$$;
revoke all on function public.link_invoice_bank_entry(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.link_invoice_bank_entry(uuid,uuid,uuid,uuid,text) to service_role;

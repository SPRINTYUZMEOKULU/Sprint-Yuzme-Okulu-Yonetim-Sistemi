-- e-SMM provider delivery ledger, deliberately NOT an issuance endpoint.
-- Personal data stays in payment_document_requests. Do not store XML/PDF blobs in these tables.
create table if not exists public.esmm_provider_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  approval_id uuid not null unique references public.esmm_issue_approvals(id) on delete restrict,
  provider text not null default 'isnet' check (provider='isnet'),
  external_document_code text not null,
  ettn uuid not null,
  state text not null default 'reserved' check (state in ('reserved','sending','uncertain','provider_confirmed','gib_accepted','failed')),
  document_number text,
  provider_report_status text,
  pdf_storage_path text,
  pdf_sha256 text,
  xml_storage_path text,
  xml_sha256 text,
  reserved_at timestamptz not null default now(),
  last_checked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint esmm_ledger_org_code_unique unique (organization_id,external_document_code),
  constraint esmm_ledger_ettn_unique unique (ettn),
  constraint esmm_ledger_external_code_valid check (external_document_code ~ '^SPRINT-[A-Z0-9-]{10,120}$'),
  constraint esmm_ledger_archive_hashes check (
    (pdf_storage_path is null and pdf_sha256 is null or pdf_storage_path is not null and pdf_sha256 ~ '^[a-f0-9]{64}$')
    and (xml_storage_path is null and xml_sha256 is null or xml_storage_path is not null and xml_sha256 ~ '^[a-f0-9]{64}$')
  ),
  constraint esmm_ledger_no_external_url check (
    (pdf_storage_path is null or (pdf_storage_path !~ '^([a-zA-Z]+:|/|\\\\)' and pdf_storage_path not like '%..%'))
    and (xml_storage_path is null or (xml_storage_path !~ '^([a-zA-Z]+:|/|\\\\)' and xml_storage_path not like '%..%'))
  ),
  constraint esmm_ledger_confirmed_identity check (
    state not in ('provider_confirmed','gib_accepted') or document_number is not null
  ),
  constraint esmm_ledger_gib_archive check (
    state <> 'gib_accepted' or (xml_storage_path is not null and pdf_storage_path is not null and provider_report_status = 'GibRaporuKabulEtti')
  )
);
create unique index if not exists esmm_ledger_document_no_unique
  on public.esmm_provider_ledger(organization_id,document_number)
  where document_number is not null;
create index if not exists esmm_ledger_org_state on public.esmm_provider_ledger(organization_id,state,updated_at desc);
alter table public.esmm_provider_ledger enable row level security;
revoke all on public.esmm_provider_ledger from public,anon,authenticated;
grant select,insert,update on public.esmm_provider_ledger to service_role;

create table if not exists public.esmm_provider_events (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.esmm_provider_ledger(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  kind text not null check (kind in ('reserved','send_started','send_uncertain','provider_found','provider_rejected','archive_verified','gib_accepted','note')),
  event_time timestamptz not null default now(),
  actor_id uuid,
  provider_status text,
  details jsonb not null default '{}'::jsonb,
  constraint esmm_provider_events_details_size check (octet_length(details::text) <= 4000)
);
create index if not exists esmm_provider_events_history on public.esmm_provider_events(ledger_id,event_time desc);
alter table public.esmm_provider_events enable row level security;
revoke all on public.esmm_provider_events from public,anon,authenticated;
grant select,insert on public.esmm_provider_events to service_role;

-- Bind event and ledger to the same organization and prohibit identity swaps.
create or replace function public.esmm_ledger_validate()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.esmm_issue_approvals where id=new.approval_id;
  if v_org is distinct from new.organization_id then raise exception 'Approval organization mismatch'; end if;
  if tg_op='UPDATE' then
    if old.organization_id is distinct from new.organization_id
      or old.approval_id is distinct from new.approval_id
      or old.ettn is distinct from new.ettn
      or old.external_document_code is distinct from new.external_document_code
      or old.provider is distinct from new.provider
      or old.document_number is not null and old.document_number is distinct from new.document_number
      or old.pdf_storage_path is not null and old.pdf_storage_path is distinct from new.pdf_storage_path
      or old.pdf_sha256 is not null and old.pdf_sha256 is distinct from new.pdf_sha256
      or old.xml_storage_path is not null and old.xml_storage_path is distinct from new.xml_storage_path
      or old.xml_sha256 is not null and old.xml_sha256 is distinct from new.xml_sha256
      or old.state='gib_accepted' and new.state<>'gib_accepted'
    then raise exception 'Immutable e-SMM identity/archive or accepted state cannot change'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_esmm_ledger_validate on public.esmm_provider_ledger;
create trigger trg_esmm_ledger_validate before insert or update on public.esmm_provider_ledger
  for each row execute function public.esmm_ledger_validate();

create or replace function public.esmm_provider_event_validate()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_org uuid;
begin
  if tg_op <> 'INSERT' then raise exception 'Provider events are append only'; end if;
  select organization_id into v_org from public.esmm_provider_ledger where id=new.ledger_id;
  if v_org is distinct from new.organization_id then raise exception 'Ledger organization mismatch'; end if;
  return new;
end $$;
drop trigger if exists trg_esmm_provider_events_validate on public.esmm_provider_events;
create trigger trg_esmm_provider_events_validate before insert or update or delete on public.esmm_provider_events
  for each row execute function public.esmm_provider_event_validate();

comment on table public.esmm_provider_ledger is
'Future-only İşNet e-SMM dispatch identity and archive metadata. No sender is enabled; do not insert until production authorization and fresh fingerprint/tax approval.';
comment on table public.esmm_provider_events is
'Append-only provider check history. No recipient identities, credentials or full SOAP messages in event details.';

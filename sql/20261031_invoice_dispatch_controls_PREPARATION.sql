-- SprintOS: invoice approval/dispatch guard PREPARATION ONLY
-- This migration must be reviewed and tested on staging before applying.
-- No provider dispatch, payment write, or backfill is performed.
create table if not exists public.invoice_dispatch_controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  request_id uuid not null references public.payment_document_requests(id),
  payment_id uuid not null references public.student_payments(id),
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  approved_payload_hash text not null check (approved_payload_hash ~ '^[0-9a-f]{64}$'),
  payment_snapshot_hash text not null check (payment_snapshot_hash ~ '^[0-9a-f]{64}$'),
  external_document_code text not null check (length(external_document_code) between 8 and 120),
  ettn uuid not null,
  dispatch_state text not null default 'approved' check
    (dispatch_state in ('approved','dispatching','uncertain','provider_accepted','verified','rejected')),
  dispatch_started_at timestamptz,
  verified_at timestamptz,
  provider_document_number text,
  created_at timestamptz not null default now(),
  constraint invoice_dispatch_one_request unique (request_id),
  constraint invoice_dispatch_one_external_code unique (external_document_code),
  constraint invoice_dispatch_one_ettn unique (ettn)
);
create index if not exists invoice_dispatch_org_status_idx on public.invoice_dispatch_controls(organization_id,dispatch_state);
alter table public.invoice_dispatch_controls enable row level security;
revoke all on public.invoice_dispatch_controls from anon, authenticated;
comment on table public.invoice_dispatch_controls is
 'Server-only preparation for approved invoice payload and single-dispatch identity. No provider send is activated.';
-- IMPORTANT: Service-side approval must compare the current payment and approved payload
-- within one transaction and recheck both under locks before any future dispatch.
-- On timeout mark UNCERTAIN; resolve by the SAME external_document_code/ETTN.
-- NEVER retry SendESMM automatically.

-- SprintOS: IBAN/Havale/EFT odemelerinde belge bilgilerinin odeme yapan kisi tarafindan girilmesi
create extension if not exists pgcrypto;

create table if not exists public.payment_document_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid references public.student_enrollments(id) on delete set null,
  payment_id uuid references public.student_payments(id) on delete set null,
  public_token uuid not null default gen_random_uuid() unique,
  payment_method text not null check (payment_method in ('bank_transfer','eft')),
  expected_amount numeric(12,2),
  status text not null default 'waiting_customer' check (status in ('waiting_customer','customer_completed','waiting_payment','payment_received','document_pending','document_created','document_sent','error','cancelled')),
  recipient_type text check (recipient_type in ('individual','company')),
  recipient_name text,
  tax_identity_number text,
  tax_office text,
  address text,
  email text,
  phone text,
  customer_consent_at timestamptz,
  customer_completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  document_provider text,
  document_type text not null default 'e_smm',
  provider_document_id text,
  document_number text,
  document_status text not null default 'not_created',
  document_pdf_url text,
  document_xml_url text,
  document_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_document_requests_student on public.payment_document_requests(organization_id, student_id, created_at desc);
create index if not exists idx_payment_document_requests_status on public.payment_document_requests(organization_id, status, created_at desc);
create unique index if not exists idx_payment_document_requests_payment on public.payment_document_requests(payment_id) where payment_id is not null;

alter table public.payment_document_requests enable row level security;

comment on table public.payment_document_requests is 'IBAN/Havale/EFT odeme talebi, musteri tarafindan girilen belge alicisi bilgileri ve e-belge durumunu tek kayitta tutar.';
comment on column public.payment_document_requests.public_token is 'Personele kimlik/vergi bilgisi girdirmeden musteriye gonderilecek tahmin edilemez baglanti anahtari.';
comment on column public.payment_document_requests.document_status is 'Entegrator baglanana kadar not_created/document_pending durumunda tutulabilir.';

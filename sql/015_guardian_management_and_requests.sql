-- SprintOS v3.6 — Veli Yönetimi ve Talep/Görüş Merkezi
begin;

alter table public.guardian_students
  add column if not exists is_payment_contact boolean not null default false,
  add column if not exists receives_messages boolean not null default true,
  add column if not exists portal_access boolean not null default true,
  add column if not exists is_emergency_contact boolean not null default false;

create table if not exists public.guardian_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  request_number text not null,
  category text not null default 'other',
  subject text not null,
  description text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'new' check (status in ('new','reviewing','approval_pending','answered','resolved','rejected','archived')),
  assigned_to uuid references public.profiles(id) on delete set null,
  internal_note text,
  guardian_response text,
  responded_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, request_number)
);

create index if not exists guardian_requests_guardian_idx on public.guardian_requests(guardian_id, created_at desc);
create index if not exists guardian_requests_management_idx on public.guardian_requests(organization_id, status, priority, created_at desc);

alter table public.guardian_requests enable row level security;

drop policy if exists "guardians manage own requests" on public.guardian_requests;
create policy "guardians manage own requests" on public.guardian_requests
for select to authenticated using (guardian_id = auth.uid());

drop policy if exists "guardians create own requests" on public.guardian_requests;
create policy "guardians create own requests" on public.guardian_requests
for insert to authenticated with check (
  guardian_id = auth.uid()
  and exists (
    select 1 from public.guardian_students gs
    where gs.guardian_id = auth.uid()
      and (guardian_requests.student_id is null or gs.student_id = guardian_requests.student_id)
  )
);

drop policy if exists "staff manage guardian requests" on public.guardian_requests;
create policy "staff manage guardian requests" on public.guardian_requests
for all to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting','coach')
)
with check (organization_id = public.current_organization_id());

commit;

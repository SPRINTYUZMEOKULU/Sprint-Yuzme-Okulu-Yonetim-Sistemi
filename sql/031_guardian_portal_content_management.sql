-- SprintOS — Veli portalı içerik yönetimi
begin;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'all',
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.announcements add column if not exists updated_at timestamptz not null default now();

update public.announcements a set organization_id=p.organization_id
from public.profiles p
where a.organization_id is null and a.created_by=p.id and p.organization_id is not null;

update public.announcements a set organization_id=o.id
from (select id from public.organizations order by created_at limit 1) o
where a.organization_id is null;

alter table public.announcements alter column organization_id set not null;

create table if not exists public.guardian_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  summary text,
  body text,
  document_type text not null default 'policy',
  version integer not null default 1,
  file_url text,
  requires_consent boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guardian_documents add column if not exists created_by uuid references public.profiles(id) on delete set null;

create table if not exists public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  document_id uuid not null references public.guardian_documents(id) on delete cascade,
  document_version integer not null,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  unique (guardian_id, student_id, document_id, document_version)
);

create index if not exists announcements_org_publish_idx on public.announcements(organization_id,is_published,published_at desc);
create index if not exists guardian_documents_org_active_idx on public.guardian_documents(organization_id,is_active,sort_order);

alter table public.announcements enable row level security;
alter table public.guardian_documents enable row level security;
alter table public.guardian_consents enable row level security;

drop policy if exists "authenticated read published announcements" on public.announcements;
create policy "authenticated read published announcements" on public.announcements for select to authenticated
using (is_published=true and organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid()));

drop policy if exists "management manages announcements" on public.announcements;
create policy "management manages announcements" on public.announcements for all to authenticated
using (organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid()) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','admin','branch_manager')))
with check (organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid()) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','admin','branch_manager')));

drop policy if exists "guardians read active documents" on public.guardian_documents;
create policy "guardians read active documents" on public.guardian_documents for select to authenticated
using (is_active=true and organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid()));

drop policy if exists "management manages guardian documents" on public.guardian_documents;
create policy "management manages guardian documents" on public.guardian_documents for all to authenticated
using (organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid()) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','admin')))
with check (organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid()) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','admin')));

drop policy if exists "guardians read own consents" on public.guardian_consents;
create policy "guardians read own consents" on public.guardian_consents for select to authenticated
using (guardian_id=auth.uid() and organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid()));

drop policy if exists "guardians create own consents" on public.guardian_consents;
create policy "guardians create own consents" on public.guardian_consents for insert to authenticated
with check (guardian_id=auth.uid() and organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid()));

commit;

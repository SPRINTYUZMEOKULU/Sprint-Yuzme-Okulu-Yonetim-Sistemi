-- SprintOS v4.4 — Şube yönetimi ve hazır Sprint şubeleri
-- Mevcut verileri silmez; eksik alanları ekler ve dört şubeyi güvenli biçimde oluşturur.

begin;

create extension if not exists pgcrypto;

alter table public.branches
  add column if not exists address text,
  add column if not exists location_url text,
  add column if not exists contact_phone text,
  add column if not exists whatsapp_phone text,
  add column if not exists pool_name text,
  add column if not exists working_hours text,
  add column if not exists public_registration boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists branches_org_name_unique
  on public.branches(organization_id, lower(name));

insert into public.branches (
  organization_id, name, pool_name, contact_phone, whatsapp_phone,
  public_registration, sort_order, is_active
)
select
  o.id, x.name, x.pool_name, '+90 (551) 896 83 19', '+905518968319',
  true, x.sort_order, true
from public.organizations o
cross join (values
  ('Konyaaltı Öğretmenevi', 'Konyaaltı Öğretmenevi Yüzme Havuzu', 10),
  ('Meltem Hasan Subaşı', 'Meltem Hasan Subaşı Yüzme Havuzu', 20),
  ('Süleyman Erol Olimpik', 'Süleyman Erol Olimpik Yüzme Havuzu', 30),
  ('Lara Life City', 'Life City Otel Yüzme Havuzu', 40)
) as x(name, pool_name, sort_order)
where lower(o.name) = lower('Sprint Yüzme Okulu')
on conflict (organization_id, lower(name)) do update
set pool_name = excluded.pool_name,
    contact_phone = coalesce(public.branches.contact_phone, excluded.contact_phone),
    whatsapp_phone = coalesce(public.branches.whatsapp_phone, excluded.whatsapp_phone),
    public_registration = true,
    is_active = true,
    sort_order = excluded.sort_order,
    updated_at = now();

alter table public.branches enable row level security;

drop policy if exists branches_management_all on public.branches;
create policy branches_management_all
on public.branches
for all
to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager')
);

drop policy if exists branches_staff_select on public.branches;
create policy branches_staff_select
on public.branches
for select
to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('registration_staff','accounting','coach','guardian')
);

commit;

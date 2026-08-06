-- SprintOS v4.2 — Kayıt tamamlama, kontrol listesi ve mesaj merkezi
-- Mevcut verileri silmez. Eksik alanları ve tabloları idempotent biçimde oluşturur.

begin;

create extension if not exists pgcrypto;

alter table public.branches
  add column if not exists location_url text,
  add column if not exists contact_phone text,
  add column if not exists material_list text,
  add column if not exists registration_note text;

alter table public.students
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists guardian_email text,
  add column if not exists status text not null default 'pre_registration';

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_key text not null,
  title text not null,
  channel text not null default 'whatsapp',
  body text not null,
  is_active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_key)
);

create table if not exists public.registration_completion_checklists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid references public.student_enrollments(id) on delete set null,
  payment_received boolean not null default false,
  group_selected boolean not null default false,
  attendance_days_selected boolean not null default false,
  health_declaration_received boolean not null default false,
  rules_accepted boolean not null default false,
  message_prepared boolean not null default false,
  message_sent boolean not null default false,
  location_sent boolean not null default false,
  swim_cap_delivered boolean not null default false,
  receipt_created boolean not null default false,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id)
);

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  guardian_id uuid references public.profiles(id) on delete set null,
  template_key text,
  channel text not null default 'whatsapp',
  recipient text,
  subject text,
  message_body text not null,
  status text not null default 'prepared' check (status in ('prepared','opened','sent','failed','cancelled')),
  prepared_by uuid references public.profiles(id) on delete set null,
  sent_by uuid references public.profiles(id) on delete set null,
  prepared_at timestamptz not null default now(),
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists message_logs_student_date_idx
  on public.message_logs(student_id, prepared_at desc);

create index if not exists completion_checklists_org_idx
  on public.registration_completion_checklists(organization_id, completed_at desc);

insert into public.message_templates (
  organization_id, template_key, title, channel, body, is_active, version
)
select
  o.id,
  'registration_completed',
  'Kayıt Tamamlandı',
  'whatsapp',
  'Sayın {{veli_adi}},\n\n{{ogrenci_adi}} adına Sprint Yüzme Okulu kayıt işleminiz başarıyla tamamlanmıştır. Aramıza hoş geldiniz.\n\n*Kurs Bilgileri*\nŞube: {{sube}}\nKurs: {{kurs_turu}}\nGrup: {{grup}}\nKatılım Günleri: {{gunler}}\nDers Saati: {{saat}}\nPaket: {{paket}}\nBaşlangıç Tarihi: {{baslangic}}\nPlanlanan Bitiş Tarihi: {{bitis}}\nEğitmen: {{egitmen}}\n\n*Kursa gelirken getirilmesi gereken malzemeler*\n{{malzemeler}}\n\n*Şube Konumu*\n{{konum}}\n\nSorularınız için {{telefon}} numaralı Sprint Bilgilendirme Hattı üzerinden bize ulaşabilirsiniz.\n\nSağlıklı ve başarılı bir eğitim dönemi dileriz.\n*Sprint Yüzme Okulu*',
  true,
  1
from public.organizations o
where lower(o.name) = lower('Sprint Yüzme Okulu')
on conflict (organization_id, template_key) do nothing;

alter table public.message_templates enable row level security;
alter table public.registration_completion_checklists enable row level security;
alter table public.message_logs enable row level security;

drop policy if exists message_templates_staff_all on public.message_templates;
create policy message_templates_staff_all
on public.message_templates
for all
to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff')
);

drop policy if exists completion_checklists_staff_all on public.registration_completion_checklists;
create policy completion_checklists_staff_all
on public.registration_completion_checklists
for all
to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting')
);

drop policy if exists message_logs_staff_all on public.message_logs;
create policy message_logs_staff_all
on public.message_logs
for all
to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting')
);

drop policy if exists message_logs_guardian_select on public.message_logs;
create policy message_logs_guardian_select
on public.message_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.guardian_students gs
    where gs.guardian_id = auth.uid()
      and gs.student_id = message_logs.student_id
  )
);

commit;

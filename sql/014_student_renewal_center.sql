-- SprintOS — Kayıt Yenileme Merkezi altyapı düzeltmesi
-- Güvenli/idempotent: mevcut verileri silmez.

begin;

alter table public.student_enrollments
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists payment_due_date date,
  add column if not exists weekly_frequency smallint;

update public.student_enrollments e
set branch_id = g.branch_id
from public.training_groups g
where e.group_id = g.id
  and e.branch_id is null;

update public.student_enrollments
set payment_due_date = start_date
where payment_due_date is null;

create table if not exists public.student_renewal_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  previous_enrollment_id uuid references public.student_enrollments(id) on delete set null,
  new_enrollment_id uuid references public.student_enrollments(id) on delete set null,
  renewal_status text not null default 'completed',
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists student_renewal_events_student_date_idx
  on public.student_renewal_events(student_id, created_at desc);

alter table public.student_renewal_events enable row level security;

drop policy if exists student_renewal_events_management_all on public.student_renewal_events;
create policy student_renewal_events_management_all
on public.student_renewal_events
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

insert into public.message_templates (
  organization_id,
  template_key,
  title,
  channel,
  body,
  is_active,
  version
)
select
  o.id,
  'registration_renewed',
  'Kayıt Yenileme Bilgilendirmesi',
  'whatsapp',
  'Merhaba {{veli_adi}},\n\n{{ogrenci_adi}} öğrencimizin Sprint Yüzme Okulu kaydı başarıyla yenilenmiştir.\n\n*Yeni Dönem Bilgileri*\nŞube: {{sube}}\nGrup: {{grup}}\nPaket: {{paket}}\nBaşlangıç: {{baslangic}}\nPlanlanan Bitiş: {{bitis}}\nÖdeme Vadesi: {{odeme_vadesi}}\n\nYeni döneminizin sağlıklı ve başarılı geçmesini dileriz.\n*Sprint Yüzme Okulu*',
  true,
  1
from public.organizations o
where lower(o.name) = lower('Sprint Yüzme Okulu')
on conflict (organization_id, template_key)
do update set
  title = excluded.title,
  channel = excluded.channel,
  body = excluded.body,
  is_active = true,
  version = public.message_templates.version + 1,
  updated_at = now();

commit;

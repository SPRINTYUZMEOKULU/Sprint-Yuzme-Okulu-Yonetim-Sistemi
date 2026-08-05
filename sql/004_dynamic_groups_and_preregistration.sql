-- SprintOS v3.4 — Dinamik grup, paket ve ön kayıt seçenekleri
begin;

alter table public.training_groups
  add column if not exists course_type text not null default 'Çocuk Yüzme Kursu',
  add column if not exists public_registration boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists description text;

alter table public.students
  add column if not exists preferred_group_id uuid references public.training_groups(id) on delete set null,
  add column if not exists preferred_package_id uuid references public.course_packages(id) on delete set null;

alter table public.pre_registrations
  add column if not exists preferred_group_id uuid references public.training_groups(id) on delete set null,
  add column if not exists preferred_package_id uuid references public.course_packages(id) on delete set null;

create unique index if not exists lesson_schedules_group_weekday_time_unique
  on public.lesson_schedules(group_id, weekday, start_time, end_time)
  where is_active = true;

create index if not exists training_groups_public_idx
  on public.training_groups(organization_id, public_registration, is_active, sort_order);

commit;

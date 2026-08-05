-- SprintOS v3.7 — Çekirdek öğrenci kaydı, katılım günleri, telafi ve ek ders
-- Bu migration mevcut verileri silmez. Eksik tabloları/kolonları idempotent biçimde oluşturur.

begin;

create extension if not exists pgcrypto;

-- 1) Seviyeler
create table if not exists public.swimming_levels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- 2) Gruplar
create table if not exists public.training_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  level_id uuid references public.swimming_levels(id) on delete set null,
  name text not null,
  course_type text not null default 'Çocuk Yüzme Kursu',
  capacity integer not null default 6 check (capacity > 0),
  lane text,
  primary_coach_id uuid references public.profiles(id) on delete set null,
  public_registration boolean not null default true,
  sort_order integer not null default 0,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, name)
);

alter table public.training_groups
  add column if not exists course_type text not null default 'Çocuk Yüzme Kursu',
  add column if not exists capacity integer not null default 6,
  add column if not exists primary_coach_id uuid references public.profiles(id) on delete set null,
  add column if not exists public_registration boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists description text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

-- 3) Grup haftalık programı
create table if not exists public.lesson_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  group_id uuid not null references public.training_groups(id) on delete cascade,
  coach_id uuid references public.profiles(id) on delete set null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lesson_schedules_group_weekday_time_unique
  on public.lesson_schedules(group_id, weekday, start_time, end_time)
  where is_active = true;

-- 4) Paketler
create table if not exists public.course_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  lesson_count integer not null check (lesson_count > 0),
  price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- 5) Öğrenci grup üyeliği
create table if not exists public.student_group_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  group_id uuid not null references public.training_groups(id) on delete cascade,
  level_id uuid references public.swimming_levels(id) on delete set null,
  started_at date not null default current_date,
  ended_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists one_active_group_per_student
  on public.student_group_memberships(student_id)
  where is_active = true;

-- 6) Öğrenci paketi/kaydı: öğrencinin seçtiği günler burada tutulur.
create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  package_id uuid references public.course_packages(id) on delete restrict,
  group_id uuid references public.training_groups(id) on delete set null,
  start_date date not null default current_date,
  planned_end_date date,
  lesson_weekdays smallint[] not null default '{}',
  weekly_frequency smallint,
  total_lessons integer not null default 1,
  used_lessons integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (used_lessons >= 0),
  check (total_lessons > 0),
  check (weekly_frequency is null or weekly_frequency between 1 and 7)
);

alter table public.student_enrollments
  add column if not exists group_id uuid references public.training_groups(id) on delete set null,
  add column if not exists package_id uuid references public.course_packages(id) on delete restrict,
  add column if not exists start_date date not null default current_date,
  add column if not exists planned_end_date date,
  add column if not exists lesson_weekdays smallint[] not null default '{}',
  add column if not exists weekly_frequency smallint,
  add column if not exists total_lessons integer not null default 1,
  add column if not exists used_lessons integer not null default 0,
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

create index if not exists student_enrollments_student_status_idx
  on public.student_enrollments(student_id, status);
create index if not exists student_enrollments_group_status_idx
  on public.student_enrollments(group_id, status);

-- 7) Bitiş tarihi motoru: yalnızca öğrencinin seçtiği günleri sayar.
create or replace function public.calculate_package_end_date(
  p_start date,
  p_weekdays smallint[],
  p_lesson_count integer,
  p_excluded date[] default '{}'
)
returns date
language plpgsql
stable
as $$
declare
  d date := p_start;
  found_count integer := 0;
begin
  if p_lesson_count is null or p_lesson_count < 1 or array_length(p_weekdays, 1) is null then
    return null;
  end if;

  while found_count < p_lesson_count loop
    if extract(dow from d)::smallint = any(p_weekdays)
       and not (d = any(coalesce(p_excluded, '{}'::date[]))) then
      found_count := found_count + 1;
    end if;

    if found_count < p_lesson_count then
      d := d + 1;
    end if;

    if d > p_start + 730 then
      raise exception 'Ders planı iki yıl içinde tamamlanamadı';
    end if;
  end loop;

  return d;
end;
$$;

create or replace function public.set_enrollment_planned_end()
returns trigger
language plpgsql
as $$
begin
  new.weekly_frequency := coalesce(array_length(new.lesson_weekdays, 1), 0);
  new.planned_end_date := public.calculate_package_end_date(
    new.start_date,
    new.lesson_weekdays,
    new.total_lessons,
    '{}'
  );
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists student_enrollment_end_date on public.student_enrollments;
create trigger student_enrollment_end_date
before insert or update of start_date, lesson_weekdays, total_lessons
on public.student_enrollments
for each row execute function public.set_enrollment_planned_end();

-- 8) Telafi / bonus / ek ders
create table if not exists public.student_lesson_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid references public.student_enrollments(id) on delete cascade,
  adjustment_type text not null check (
    adjustment_type in ('makeup','bonus','gift','pool_makeup','management_extra','trial','private_extra','other')
  ),
  status text not null default 'planned' check (
    status in ('planned','completed','missed','cancelled')
  ),
  original_lesson_date date,
  lesson_date date not null,
  branch_id uuid references public.branches(id) on delete set null,
  group_id uuid references public.training_groups(id) on delete set null,
  coach_id uuid references public.profiles(id) on delete set null,
  start_time time,
  end_time time,
  reason text,
  note text,
  counts_as_package_lesson boolean not null default false,
  increases_total_lessons boolean not null default false,
  extends_end_date boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_adjustments_student_date_idx
  on public.student_lesson_adjustments(student_id, lesson_date desc);
create index if not exists lesson_adjustments_status_idx
  on public.student_lesson_adjustments(organization_id, status, lesson_date);

create or replace function public.apply_lesson_adjustment_to_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.enrollment_id is not null and new.increases_total_lessons and tg_op = 'INSERT' then
    update public.student_enrollments
       set total_lessons = total_lessons + 1,
           updated_at = now()
     where id = new.enrollment_id;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_lesson_adjustment_trigger on public.student_lesson_adjustments;
create trigger apply_lesson_adjustment_trigger
after insert on public.student_lesson_adjustments
for each row execute function public.apply_lesson_adjustment_to_enrollment();

-- 9) Güvenlik politikaları
alter table public.swimming_levels enable row level security;
alter table public.training_groups enable row level security;
alter table public.lesson_schedules enable row level security;
alter table public.course_packages enable row level security;
alter table public.student_group_memberships enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.student_lesson_adjustments enable row level security;

-- Yönetim rolleri
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'swimming_levels',
    'training_groups',
    'lesson_schedules',
    'course_packages',
    'student_group_memberships',
    'student_enrollments',
    'student_lesson_adjustments'
  ]
  LOOP
    EXECUTE format('drop policy if exists %I on public.%I', t || '_management_all', t);
    EXECUTE format(
      'create policy %I on public.%I for all to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in (''owner'',''admin'',''branch_manager'',''registration_staff'')) with check (organization_id = public.current_user_organization_id() and public.current_user_role() in (''owner'',''admin'',''branch_manager'',''registration_staff''))',
      t || '_management_all',
      t
    );
  END LOOP;
END;
$$;

-- Eğitmen kendi ek/telafi derslerini görür.
drop policy if exists lesson_adjustments_coach_select on public.student_lesson_adjustments;
create policy lesson_adjustments_coach_select
on public.student_lesson_adjustments
for select to authenticated
using (
  organization_id = public.current_user_organization_id()
  and coach_id = auth.uid()
);

-- Veli yalnızca bağlı öğrencisine ait telafi/ek dersleri görür.
drop policy if exists lesson_adjustments_guardian_select on public.student_lesson_adjustments;
create policy lesson_adjustments_guardian_select
on public.student_lesson_adjustments
for select to authenticated
using (
  public.current_user_role() = 'guardian'
  and exists (
    select 1
    from public.guardian_students gs
    where gs.guardian_id = auth.uid()
      and gs.student_id = student_lesson_adjustments.student_id
  )
);

-- Veli bağlı öğrencisinin aktif kayıt/paket bilgisini görür.
drop policy if exists enrollments_guardian_select on public.student_enrollments;
create policy enrollments_guardian_select
on public.student_enrollments
for select to authenticated
using (
  public.current_user_role() = 'guardian'
  and exists (
    select 1
    from public.guardian_students gs
    where gs.guardian_id = auth.uid()
      and gs.student_id = student_enrollments.student_id
  )
);

-- Başlangıç seviyeleri ve temel paketler (yoksa eklenir)
insert into public.swimming_levels (organization_id, name, sort_order)
select o.id, x.name, x.ord
from public.organizations o
cross join (values
  ('Suya Uyum', 1),
  ('Başlangıç', 2),
  ('Temel Seviye', 3),
  ('Orta Seviye', 4),
  ('İleri Seviye', 5),
  ('Takım Alt Yapı', 6),
  ('Performans', 7),
  ('Master', 8)
) as x(name, ord)
where o.name = 'Sprint Yüzme Okulu'
on conflict do nothing;

insert into public.course_packages (organization_id, name, lesson_count, price)
select o.id, x.name, x.lesson_count, x.price
from public.organizations o
cross join (values
  ('Çocuk 8 Ders', 8, 4000::numeric),
  ('Çocuk 12 Ders', 12, 6000::numeric),
  ('Yetişkin 8 Ders', 8, 4500::numeric),
  ('Yetişkin 12 Ders', 12, 6000::numeric)
) as x(name, lesson_count, price)
where o.name = 'Sprint Yüzme Okulu'
on conflict do nothing;

commit;

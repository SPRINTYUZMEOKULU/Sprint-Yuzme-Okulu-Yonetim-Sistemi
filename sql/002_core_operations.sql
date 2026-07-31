-- SprintOS Bulut2026 v2.3 — Modüler eğitim, paket ve kasa altyapısı
begin;

create extension if not exists pgcrypto;

do $$ begin create type public.payment_method as enum ('cash','card','transfer','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('recorded','cancelled','refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cash_status as enum ('with_staff','handoff_pending','main_cash_confirmed','difference','not_applicable'); exception when duplicate_object then null; end $$;
do $$ begin create type public.handoff_status as enum ('draft','pending','approved','rejected','difference'); exception when duplicate_object then null; end $$;
do $$ begin create type public.lesson_session_status as enum ('planned','completed','cancelled','postponed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.checkin_status as enum ('on_time','late','missing','corrected'); exception when duplicate_object then null; end $$;

create table if not exists public.swimming_levels (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, description text, sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,name)
);

create table if not exists public.training_groups (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade, level_id uuid references public.swimming_levels(id) on delete set null,
  name text not null, capacity integer not null default 6 check(capacity>0), lane text, primary_coach_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(branch_id,name)
);

create table if not exists public.student_group_memberships (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, group_id uuid not null references public.training_groups(id) on delete cascade,
  level_id uuid references public.swimming_levels(id) on delete set null, started_at date not null default current_date, ended_at date,
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create unique index if not exists one_active_group_per_student on public.student_group_memberships(student_id) where is_active=true;

create table if not exists public.lesson_schedules (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade, group_id uuid not null references public.training_groups(id) on delete cascade,
  coach_id uuid references public.profiles(id) on delete set null, weekday smallint not null check(weekday between 0 and 6),
  start_time time not null, end_time time not null, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.lesson_sessions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id uuid references public.lesson_schedules(id) on delete set null, group_id uuid not null references public.training_groups(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade, coach_id uuid references public.profiles(id) on delete set null,
  starts_at timestamptz not null, ends_at timestamptz not null, status public.lesson_session_status not null default 'planned', cancellation_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.coach_checkins (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.lesson_sessions(id) on delete cascade, coach_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(), status public.checkin_status not null default 'on_time', note text,
  adjustment_requested boolean not null default false, approved_by uuid references public.profiles(id) on delete set null, approved_at timestamptz,
  unique(session_id,coach_id)
);

create table if not exists public.course_packages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, lesson_count integer not null check(lesson_count>0), price numeric(12,2) not null default 0,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,name)
);

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, package_id uuid not null references public.course_packages(id) on delete restrict,
  group_id uuid references public.training_groups(id) on delete set null, start_date date not null, planned_end_date date,
  lesson_weekdays smallint[] not null default '{}', total_lessons integer not null, used_lessons integer not null default 0,
  status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null, student_id uuid references public.students(id) on delete set null,
  enrollment_id uuid references public.student_enrollments(id) on delete set null, amount numeric(12,2) not null check(amount>=0),
  payment_method public.payment_method not null, payment_status public.payment_status not null default 'recorded',
  cash_status public.cash_status not null default 'not_applicable', received_by uuid references public.profiles(id) on delete set null,
  received_at timestamptz not null default now(), note text, receipt_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.cash_handoffs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null, staff_id uuid not null references public.profiles(id) on delete restrict,
  handoff_date date not null default current_date, expected_amount numeric(12,2) not null default 0, declared_amount numeric(12,2) not null default 0,
  status public.handoff_status not null default 'draft', submitted_at timestamptz, reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz, review_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.cash_handoff_items (
  id uuid primary key default gen_random_uuid(), handoff_id uuid not null references public.cash_handoffs(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete restrict, amount numeric(12,2) not null, unique(handoff_id,payment_id)
);

create or replace function public.calculate_package_end_date(p_start date, p_weekdays smallint[], p_lesson_count integer, p_excluded date[] default '{}')
returns date language plpgsql stable as $$
declare d date := p_start; found_count integer := 0;
begin
  if p_lesson_count is null or p_lesson_count < 1 or array_length(p_weekdays,1) is null then return null; end if;
  while found_count < p_lesson_count loop
    if extract(dow from d)::smallint = any(p_weekdays) and not (d = any(coalesce(p_excluded,'{}'::date[]))) then found_count := found_count + 1; end if;
    if found_count < p_lesson_count then d := d + 1; end if;
    if d > p_start + 730 then raise exception 'Ders planı iki yıl içinde tamamlanamadı'; end if;
  end loop;
  return d;
end $$;

create or replace function public.set_enrollment_planned_end() returns trigger language plpgsql as $$
begin new.planned_end_date := public.calculate_package_end_date(new.start_date,new.lesson_weekdays,new.total_lessons,'{}'); new.updated_at:=now(); return new; end $$;
drop trigger if exists student_enrollment_end_date on public.student_enrollments;
create trigger student_enrollment_end_date before insert or update of start_date,lesson_weekdays,total_lessons on public.student_enrollments for each row execute function public.set_enrollment_planned_end();

create index if not exists payments_received_at_idx on public.payments(received_at desc);
create index if not exists payments_cash_status_idx on public.payments(cash_status);
create index if not exists handoffs_status_date_idx on public.cash_handoffs(status,handoff_date desc);
create index if not exists memberships_group_idx on public.student_group_memberships(group_id,is_active);

alter table public.swimming_levels enable row level security;
alter table public.training_groups enable row level security;
alter table public.student_group_memberships enable row level security;
alter table public.lesson_schedules enable row level security;
alter table public.lesson_sessions enable row level security;
alter table public.coach_checkins enable row level security;
alter table public.course_packages enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.payments enable row level security;
alter table public.cash_handoffs enable row level security;
alter table public.cash_handoff_items enable row level security;

-- Yetkilendirme: finans ve öğrenci verileri herkese açılmaz.
do $$ declare t text; begin
  foreach t in array array['swimming_levels','training_groups','student_group_memberships','lesson_schedules','lesson_sessions','course_packages','student_enrollments','payments','cash_handoffs'] loop
    execute format('drop policy if exists %I on public.%I', t||'_management_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (organization_id=public.current_organization_id() and public.current_user_role() in (''owner'',''admin'',''branch_manager'')) with check (organization_id=public.current_organization_id())', t||'_management_all', t);
  end loop;
end $$;

-- Kayıt ve muhasebe personeli öğrenci paketlerini ve ödemeleri yönetebilir.
drop policy if exists enrollments_staff_all on public.student_enrollments;
create policy enrollments_staff_all on public.student_enrollments for all to authenticated
using (organization_id=public.current_organization_id() and public.current_user_role() in ('registration_staff','accounting'))
with check (organization_id=public.current_organization_id());

drop policy if exists payments_staff_all on public.payments;
create policy payments_staff_all on public.payments for all to authenticated
using (organization_id=public.current_organization_id() and public.current_user_role() in ('registration_staff','accounting'))
with check (organization_id=public.current_organization_id());

-- Eğitmen yalnızca kendisine ait dersleri ve giriş kayıtlarını görür.
drop policy if exists coach_sessions_select on public.lesson_sessions;
create policy coach_sessions_select on public.lesson_sessions for select to authenticated
using (organization_id=public.current_organization_id() and coach_id=auth.uid());

drop policy if exists coach_checkins_own on public.coach_checkins;
create policy coach_checkins_own on public.coach_checkins for all to authenticated
using (organization_id=public.current_organization_id() and coach_id=auth.uid())
with check (organization_id=public.current_organization_id() and coach_id=auth.uid());

-- Kasa teslim kalemleri yönetici tarafından teslimat üzerinden görülür.
drop policy if exists handoff_items_management on public.cash_handoff_items;
create policy handoff_items_management on public.cash_handoff_items for all to authenticated
using (exists(select 1 from public.cash_handoffs h where h.id=handoff_id and h.organization_id=public.current_organization_id() and public.current_user_role() in ('owner','admin','branch_manager')))
with check (exists(select 1 from public.cash_handoffs h where h.id=handoff_id and h.organization_id=public.current_organization_id() and public.current_user_role() in ('owner','admin','branch_manager')));

insert into public.swimming_levels(organization_id,name,sort_order)
select id,x.name,x.ord from public.organizations cross join (values ('Suya Uyum',1),('Başlangıç',2),('Temel Seviye',3),('Orta Seviye',4),('İleri Seviye',5),('Takım Alt Yapı',6),('Performans',7),('Master',8)) x(name,ord)
where organizations.name='Sprint Yüzme Okulu' on conflict do nothing;

commit;

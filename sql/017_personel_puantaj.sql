-- SprintOS — Personel & Puantaj
-- Konumlu ders girişi, ücret modeli ve aylık hakediş altyapısı.

alter table public.branches add column if not exists latitude double precision;
alter table public.branches add column if not exists longitude double precision;
alter table public.branches add column if not exists checkin_radius_m integer not null default 250;

alter table public.staff add column if not exists pay_type text not null default 'per_lesson';
alter table public.staff add column if not exists per_lesson_rate numeric(12,2) not null default 0;
alter table public.staff add column if not exists hourly_rate numeric(12,2) not null default 0;
alter table public.staff add column if not exists monthly_salary numeric(12,2) not null default 0;
alter table public.staff add column if not exists payroll_active boolean not null default true;

create table if not exists public.staff_checkins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  staff_id uuid not null references public.staff(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  schedule_id uuid not null references public.lesson_schedules(id) on delete restrict,
  group_id uuid references public.training_groups(id) on delete set null,
  lesson_date date not null,
  planned_start time not null,
  planned_end time not null,
  checked_in_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  distance_m double precision,
  location_verified boolean not null default false,
  attendance_status text not null default 'on_time',
  approval_status text not null default 'pending',
  source text not null default 'mobile',
  manager_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_id, schedule_id, lesson_date)
);

create index if not exists staff_checkins_org_date_idx
  on public.staff_checkins(organization_id, lesson_date);
create index if not exists staff_checkins_staff_date_idx
  on public.staff_checkins(staff_id, lesson_date);

create table if not exists public.staff_payroll_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  staff_id uuid not null references public.staff(id) on delete cascade,
  period_month date not null,
  pay_type text not null,
  approved_lesson_count integer not null default 0,
  approved_minutes integer not null default 0,
  base_amount numeric(12,2) not null default 0,
  adjustment_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'open',
  closed_by uuid,
  closed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_id, period_month)
);

create index if not exists staff_payroll_periods_org_month_idx
  on public.staff_payroll_periods(organization_id, period_month);

alter table public.staff_checkins enable row level security;
alter table public.staff_payroll_periods enable row level security;

-- Bu iki tablo istemciden doğrudan yazılmaz. İşlemler, oturumu doğrulayan
-- /api/personel-puantaj sunucu endpoint'i üzerinden yürütülür.
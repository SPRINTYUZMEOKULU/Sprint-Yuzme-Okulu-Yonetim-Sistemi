-- SprintOS v3.7 — Öğrenciye Özel Ödeme Planı ve Taksit Sistemi
begin;

create table if not exists public.student_payment_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  installment_count integer not null check (installment_count between 1 and 24),
  status text not null default 'active' check (status in ('draft','active','completed','cancelled')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id)
);

create table if not exists public.student_payment_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.student_payment_plans(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'pending' check (status in ('pending','partial','paid','overdue','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, sequence_no)
);

alter table public.student_payments
  add column if not exists payment_installment_id uuid references public.student_payment_installments(id) on delete set null;

create index if not exists payment_plans_student_idx on public.student_payment_plans(organization_id, student_id, status);
create index if not exists payment_installments_due_idx on public.student_payment_installments(organization_id, due_date, status);

alter table public.student_payment_plans enable row level security;
alter table public.student_payment_installments enable row level security;

drop policy if exists payment_plans_staff_all on public.student_payment_plans;
create policy payment_plans_staff_all on public.student_payment_plans for all to authenticated
using (organization_id = public.current_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting'))
with check (organization_id = public.current_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting'));

drop policy if exists payment_installments_staff_all on public.student_payment_installments;
create policy payment_installments_staff_all on public.student_payment_installments for all to authenticated
using (organization_id = public.current_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting'))
with check (organization_id = public.current_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting'));

drop policy if exists payment_plans_guardian_select on public.student_payment_plans;
create policy payment_plans_guardian_select on public.student_payment_plans for select to authenticated
using (public.current_user_role() = 'guardian' and exists (select 1 from public.guardian_students gs where gs.guardian_id = auth.uid() and gs.student_id = student_payment_plans.student_id));

drop policy if exists payment_installments_guardian_select on public.student_payment_installments;
create policy payment_installments_guardian_select on public.student_payment_installments for select to authenticated
using (public.current_user_role() = 'guardian' and exists (select 1 from public.guardian_students gs where gs.guardian_id = auth.uid() and gs.student_id = student_payment_installments.student_id));

commit;

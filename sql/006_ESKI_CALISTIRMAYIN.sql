-- SprintOS v3.6 — Öğrenci katılım günleri, telafi ve ek ders yönetimi
begin;

create table if not exists public.student_lesson_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid references public.student_enrollments(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('makeup','bonus','gift','pool_makeup','management_extra','trial','private_extra','other')),
  status text not null default 'planned' check (status in ('planned','completed','missed','cancelled')),
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

alter table public.student_lesson_adjustments enable row level security;

drop policy if exists lesson_adjustments_management_all on public.student_lesson_adjustments;
create policy lesson_adjustments_management_all
on public.student_lesson_adjustments for all to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff')
)
with check (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff')
);

-- Eğitmen yalnızca kendisine atanan ek/telafi derslerini görebilir.
drop policy if exists lesson_adjustments_coach_select on public.student_lesson_adjustments;
create policy lesson_adjustments_coach_select
on public.student_lesson_adjustments for select to authenticated
using (
  organization_id = public.current_organization_id()
  and coach_id = auth.uid()
);

-- Veli yalnızca kendi çocuğuna ait planlanmış/tamamlanmış dersleri görebilir.
drop policy if exists lesson_adjustments_guardian_select on public.student_lesson_adjustments;
create policy lesson_adjustments_guardian_select
on public.student_lesson_adjustments for select to authenticated
using (
  public.current_user_role() = 'guardian'
  and exists (
    select 1 from public.guardian_students gs
    where gs.guardian_id = auth.uid()
      and gs.student_id = student_lesson_adjustments.student_id
  )
);

create or replace function public.apply_lesson_adjustment_to_enrollment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.enrollment_id is not null and new.increases_total_lessons and tg_op = 'INSERT' then
    update public.student_enrollments
       set total_lessons = total_lessons + 1,
           updated_at = now()
     where id = new.enrollment_id;
  end if;
  return new;
end $$;

drop trigger if exists apply_lesson_adjustment_trigger on public.student_lesson_adjustments;
create trigger apply_lesson_adjustment_trigger
after insert on public.student_lesson_adjustments
for each row execute function public.apply_lesson_adjustment_to_enrollment();

commit;

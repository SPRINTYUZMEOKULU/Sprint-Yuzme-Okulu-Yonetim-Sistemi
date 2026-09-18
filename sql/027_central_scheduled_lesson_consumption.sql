-- SprintOS — Merkezi planlı ders tüketim motoru
-- Normal hak, yoklamadan bağımsız olarak planlı ders günü geçtikçe tüketilir.
-- İptal/kapalı seanslar tüketimden hariç tutulabilir. Tarih alanlarını değiştirmez.
begin;

create table if not exists public.lesson_consumption_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.training_groups(id) on delete cascade,
  schedule_id uuid references public.lesson_schedules(id) on delete set null,
  lesson_date date not null,
  consume_right boolean not null default false,
  reason text not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lesson_consumption_exceptions_unique
  on public.lesson_consumption_exceptions
  (organization_id, group_id, coalesce(schedule_id,'00000000-0000-0000-0000-000000000000'::uuid), lesson_date);

create index if not exists lesson_consumption_exceptions_lookup
  on public.lesson_consumption_exceptions(organization_id, group_id, lesson_date);

alter table public.lesson_consumption_exceptions enable row level security;
drop policy if exists lesson_consumption_exceptions_staff_all on public.lesson_consumption_exceptions;
create policy lesson_consumption_exceptions_staff_all
on public.lesson_consumption_exceptions for all to authenticated
using (
  organization_id=public.current_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff')
)
with check (
  organization_id=public.current_organization_id()
  and public.current_user_role() in ('owner','admin','branch_manager','registration_staff')
);

create or replace function public.scheduled_used_lessons(
  p_enrollment_id uuid,
  p_as_of timestamptz default now()
)
returns integer
language plpgsql
stable
as $$
declare
  e public.student_enrollments%rowtype;
  d date;
  used_count integer := 0;
  is_paused boolean;
begin
  select * into e from public.student_enrollments where id=p_enrollment_id;
  if not found or e.total_lessons <= 0 or array_length(e.lesson_weekdays,1) is null then
    return 0;
  end if;

  d := e.start_date;
  while d <= (p_as_of at time zone 'Europe/Istanbul')::date
    and used_count < e.total_lessons loop

    if extract(dow from d)::smallint = any(e.lesson_weekdays) then
      -- Tesis kapanışında kapanış tarihinden START tarihine kadar normal hak tüketilmez.
      select exists(
        select 1
        from public.facility_pause_student_snapshots s
        join public.facility_season_pauses p on p.id=s.pause_id
        where s.enrollment_id=e.id
          and p.organization_id=e.organization_id
          and d >= p.closure_date
          and (s.resumed_at is null or d < s.resumed_at)
      ) into is_paused;

      if not is_paused
        and not exists(
          select 1 from public.lesson_consumption_exceptions x
          where x.organization_id=e.organization_id
            and x.group_id=e.group_id
            and x.lesson_date=d
            and x.consume_right=false
        )
      then
        used_count := used_count + 1;
      end if;
    end if;

    d := d + 1;
  end loop;

  return least(used_count,e.total_lessons);
end $$;

create or replace function public.sync_scheduled_used_lessons(
  p_organization_id uuid default public.current_organization_id()
)
returns integer
language plpgsql
security invoker
as $$
declare
  changed integer := 0;
begin
  update public.student_enrollments e
  set used_lessons=public.scheduled_used_lessons(e.id),
      updated_at=now()
  where e.organization_id=p_organization_id
    and e.status='active'
    and e.used_lessons is distinct from public.scheduled_used_lessons(e.id);

  get diagnostics changed = row_count;
  return changed;
end $$;

commit;

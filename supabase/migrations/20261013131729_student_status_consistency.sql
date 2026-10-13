begin;

-- status is the source used by registration, attendance and portal access.
-- Align only the duplicate flag; preserve dates, histories and student status.
create or replace function public.align_student_active_flag()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.status in ('active', 'passive') and not coalesce(new.is_deleted, false) then
    new.is_active := (new.status = 'active');
  end if;
  return new;
end;
$$;

revoke all on function public.align_student_active_flag() from public, anon, authenticated;

create trigger students_align_active_flag
before insert or update on public.students
for each row execute function public.align_student_active_flag();

update public.students
set is_active = (status = 'active')
where status in ('active', 'passive')
  and not coalesce(is_deleted, false)
  and is_active is distinct from (status = 'active');

alter table public.students
add constraint students_active_flag_matches_status
check (coalesce(is_deleted, false) or status not in ('active', 'passive')
  or is_active is not distinct from (status = 'active'));

commit;

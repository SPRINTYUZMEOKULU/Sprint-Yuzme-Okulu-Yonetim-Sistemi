create function public.guard_compensation_during_enrollment_freeze()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from 'planned' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (new.organization_id, new.student_id, new.lesson_date, new.status)
       is not distinct from (old.organization_id, old.student_id, old.lesson_date, old.status) then
      return new;
    end if;
  end if;

  -- The freeze approval locks the same active enrollment before validating planned makeups.
  perform 1
    from public.student_enrollments
    where organization_id = new.organization_id and student_id = new.student_id
      and status = 'active'
    order by id
    for share;

  if exists (
    select 1
    from public.student_enrollments
    where organization_id = new.organization_id and student_id = new.student_id
      and new.lesson_date >= freeze_start_date and new.lesson_date < freeze_resume_date
  ) then
    raise exception 'Bu tarih kayıt dondurma dönemine denk geliyor. Dönüş tarihinde veya sonrasında bir seans seçin.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_compensation_during_enrollment_freeze() from public;

create trigger guard_compensation_during_enrollment_freeze
before insert or update of organization_id, student_id, lesson_date, status
on public.student_compensation_lessons
for each row execute function public.guard_compensation_during_enrollment_freeze();

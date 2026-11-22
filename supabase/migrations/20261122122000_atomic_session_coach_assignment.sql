create or replace function public.set_session_coach(
  p_schedule_id uuid,
  p_coach_id uuid,
  p_assignment_role text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  session_row public.lesson_schedules%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid() and is_active;
  if actor.id is null or actor.role::text not in ('owner', 'admin', 'branch_manager') then
    raise exception 'Eğitmen ataması için yetkiniz yok.' using errcode = '42501';
  end if;

  if p_assignment_role is null or p_assignment_role not in ('coach', 'backup') then
    raise exception 'Eğitmen rolü geçersiz.';
  end if;

  select * into session_row
  from public.lesson_schedules
  where id = p_schedule_id and organization_id = actor.organization_id and is_active
  for update;

  if not found then
    raise exception 'Seans bulunamadı.';
  end if;

  perform 1 from public.profiles
  where id = p_coach_id and organization_id = actor.organization_id
    and is_active and role::text in ('coach', 'admin', 'branch_manager');

  if not found then
    raise exception 'Seçilen eğitmen bulunamadı veya aktif değil.';
  end if;

  if p_assignment_role = 'backup' and (
    session_row.coach_id = p_coach_id or exists (
      select 1 from public.lesson_staff_assignments
      where organization_id = actor.organization_id and schedule_id = p_schedule_id
        and coach_id = p_coach_id and assignment_role = 'coach' and is_active
    )
  ) then
    raise exception 'Ana eğitmen aynı seansa yedek olarak atanamaz.';
  end if;

  update public.lesson_staff_assignments
  set is_active = false, updated_at = now()
  where organization_id = actor.organization_id and schedule_id = p_schedule_id
    and assignment_role = p_assignment_role and coach_id <> p_coach_id and is_active;

  insert into public.lesson_staff_assignments (
    organization_id, branch_id, schedule_id, group_id, coach_id, assignment_role, is_active, updated_at
  ) values (
    actor.organization_id, session_row.branch_id, p_schedule_id, session_row.group_id,
    p_coach_id, p_assignment_role, true, now()
  )
  on conflict (schedule_id, coach_id) do update
  set branch_id = excluded.branch_id, group_id = excluded.group_id,
    assignment_role = excluded.assignment_role, is_active = true, updated_at = excluded.updated_at;

  if p_assignment_role = 'coach' then
    update public.lesson_schedules set coach_id = p_coach_id
    where id = p_schedule_id and organization_id = actor.organization_id;
    if not found then
      raise exception 'Ana eğitmen seansa işlenemedi.';
    end if;
  end if;
end;
$$;

revoke execute on function public.set_session_coach(uuid, uuid, text) from public, anon;
grant execute on function public.set_session_coach(uuid, uuid, text) to authenticated;

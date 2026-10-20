-- Run after the migration, inside BEGIN/ROLLBACK. No fixture IDs or permanent records.
do $$
declare e record; original_id uuid; before_count integer; after_count integer; changed integer;
  next_id uuid; actor_id uuid; result jsonb; rejected boolean:=false;
begin
  select count(*) into before_count from public.student_compensation_lessons where status='planned';
  select se.* into e from public.student_enrollments se where status='scheduled' order by start_date limit 1;
  if e.id is null then raise exception 'Expected a scheduled renewal fixture'; end if;
  select id into original_id from public.student_enrollments where student_id=e.student_id and status='active';
  if original_id is null then raise exception 'Early renewal closed the current period'; end if;
  changed:=private.activate_due_renewals(e.organization_id);
  if changed<>0 then raise exception 'A future period activated early'; end if;

  if has_function_privilege('anon','public.sync_due_renewals()','EXECUTE') or has_function_privilege('authenticated','private.activate_due_renewals(uuid)','EXECUTE') then raise exception 'Internal activation privileges exposed'; end if;
  update public.student_enrollments set start_date=(now() at time zone 'Europe/Istanbul')::date where id=e.id;
  update public.students set status='passive' where id=e.student_id;
  if private.activate_due_renewals(e.organization_id)<>0 then raise exception 'Passive student was reactivated'; end if;
  update public.students set status='active' where id=e.student_id;
  changed:=private.activate_due_renewals(e.organization_id);
  if changed<>1 then raise exception 'Expected exactly one transition, got %',changed; end if;
  if not exists(select 1 from public.student_enrollments where id=e.id and status='active' and not start_confirmation_required and actual_started_at is not null and used_lessons=0) then
    raise exception 'Continuing period was not activated without consuming lessons'; end if;
  if not exists(select 1 from public.student_enrollments where id=original_id and status='completed') then raise exception 'Old period was not archived'; end if;
  if not exists(select 1 from public.student_attendance_plans where enrollment_id=e.id and is_active=true and start_date=(now() at time zone 'Europe/Istanbul')::date) then raise exception 'New plan was not integrated'; end if;
  if exists(select 1 from public.student_attendance_plans where student_id=e.student_id and is_active and enrollment_id<>e.id) then raise exception 'Stale active plan remained'; end if;
  if private.activate_due_renewals(e.organization_id)<>0 then raise exception 'Transition is not idempotent'; end if;
  select count(*) into after_count from public.student_compensation_lessons where status='planned';
  if before_count<>after_count then raise exception 'Compensation rights changed'; end if;

  -- Finalize another future period under the real management authorization model.
  select id into actor_id from public.profiles where organization_id=e.organization_id and is_active and role::text='owner' limit 1;
  perform set_config('request.jwt.claim.sub',actor_id::text,true);
  insert into public.student_enrollments(organization_id,student_id,package_id,group_id,branch_id,start_date,lesson_weekdays,weekly_frequency,total_lessons,used_lessons,status)
    select organization_id,student_id,package_id,group_id,branch_id,(now() at time zone 'Europe/Istanbul')::date+60,lesson_weekdays,weekly_frequency,total_lessons,0,'renewal_pending' from public.student_enrollments where id=e.id returning id into next_id;
  result:=public.finalize_enrollment_renewal(next_id,e.id);
  if result->>'status'<>'scheduled' then raise exception 'Early renewal was not scheduled'; end if;
  if not exists(select 1 from public.student_enrollments where id=e.id and status='active') then raise exception 'Early renewal replaced the current period'; end if;
  begin
    perform private.activate_enrollment_period(next_id);
  exception when others then rejected:=true;
  end;
  if not rejected then raise exception 'Future activation guard failed'; end if;
end $$;

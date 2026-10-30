-- All fixtures and transitions are rolled back; no real student is renewed.
begin;
do $$
declare actor public.profiles%rowtype; pkg public.course_packages%rowtype; grp public.training_groups%rowtype;
  sid uuid:=gen_random_uuid(); old_id uuid:=gen_random_uuid(); new_id uuid:=gen_random_uuid(); res jsonb; today date:=(now() at time zone 'Europe/Istanbul')::date;
begin
  select * into actor from public.profiles where is_active=true and role::text='owner' limit 1;
  if actor.id is null then raise exception 'Owner fixture unavailable'; end if;
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  select * into pkg from public.course_packages where organization_id=actor.organization_id and is_active=true and price>0 limit 1;
  select * into grp from public.training_groups where organization_id=actor.organization_id limit 1;
  if pkg.id is null or grp.id is null then raise exception 'Package/group fixture unavailable'; end if;
  insert into public.students(id,organization_id,first_name,last_name,status,is_active,branch_id)
    values(sid,actor.organization_id,'Renewal integration','ROLLBACK ONLY','active',true,grp.branch_id);
  insert into public.student_enrollments(id,organization_id,student_id,package_id,group_id,branch_id,start_date,planned_end_date,lesson_weekdays,weekly_frequency,total_lessons,used_lessons,status)
    values(old_id,actor.organization_id,sid,pkg.id,grp.id,grp.branch_id,today-60,today-1,array[2,4]::smallint[],2,pkg.lesson_count,pkg.lesson_count,'active');
  insert into public.student_enrollments(id,organization_id,student_id,package_id,group_id,branch_id,start_date,planned_end_date,payment_due_date,lesson_weekdays,weekly_frequency,total_lessons,status)
    values(new_id,actor.organization_id,sid,pkg.id,grp.id,grp.branch_id,today+2,today+32,today,array[2,4]::smallint[],2,pkg.lesson_count,'renewal_pending');
  res:=public.complete_student_renewal(new_id,old_id,'Integration test',null);
  if res->>'status'<>'scheduled' then raise exception 'Future period was not scheduled'; end if;
  if (select status from public.student_enrollments where id=old_id)<>'active' then raise exception 'Current period was overwritten'; end if;
  if (select count(*) from public.student_financial_obligations where enrollment_id=new_id and amount=pkg.price)<>1 then raise exception 'Missing/duplicate package debt'; end if;
  if (select count(*) from public.student_renewal_events where new_enrollment_id=new_id)<>1 then raise exception 'Missing/duplicate renewal event'; end if;
  if (select count(*) from public.student_activity_logs where source_id=new_id and activity_type='registration_renewed')<>1 then raise exception 'Missing/duplicate renewal history'; end if;
  begin
    perform public.complete_student_renewal(new_id,old_id,'Duplicate',null);
    raise exception 'Duplicate renewal unexpectedly succeeded';
  exception when others then
    if SQLERRM='Duplicate renewal unexpectedly succeeded' then raise; end if;
  end;
  -- A conflicting next period must leave the attempted period pending, with no debt/history.
  declare conflict_id uuid:=gen_random_uuid(); begin
    insert into public.student_enrollments(id,organization_id,student_id,package_id,group_id,branch_id,start_date,planned_end_date,payment_due_date,lesson_weekdays,weekly_frequency,total_lessons,status)
      values(conflict_id,actor.organization_id,sid,pkg.id,grp.id,grp.branch_id,today+3,today+33,today,array[2,4]::smallint[],2,pkg.lesson_count,'renewal_pending');
    begin
      perform public.complete_student_renewal(conflict_id,old_id,'Conflict',null);
      raise exception 'Conflicting renewal unexpectedly succeeded';
    exception when others then
      if SQLERRM='Conflicting renewal unexpectedly succeeded' then raise; end if;
    end;
    if exists(select 1 from public.student_financial_obligations where enrollment_id=conflict_id) or exists(select 1 from public.student_renewal_events where new_enrollment_id=conflict_id) then raise exception 'Failed transition left financial/history records'; end if;
  end;
  -- Switch only the fixture to an immediate renewal to validate attendance-plan activation.
  update public.student_enrollments set status='cancelled' where id=new_id;
  declare immediate_id uuid:=gen_random_uuid(); begin
    insert into public.student_enrollments(id,organization_id,student_id,package_id,group_id,branch_id,start_date,planned_end_date,payment_due_date,lesson_weekdays,weekly_frequency,total_lessons,status)
      values(immediate_id,actor.organization_id,sid,pkg.id,grp.id,grp.branch_id,today,today+30,today,array[2,4]::smallint[],2,pkg.lesson_count,'renewal_pending');
    res:=public.complete_student_renewal(immediate_id,old_id,'Immediate',null);
    if res->>'status'<>'active' or (select status from public.student_enrollments where id=old_id)<>'completed' then raise exception 'Immediate period transition failed'; end if;
    if not exists(select 1 from public.student_attendance_plans where enrollment_id=immediate_id and is_active=true) then raise exception 'Attendance plan not activated'; end if;
  end;
  -- Returning passive student with no active enrollment must get an active plan.
  update public.student_enrollments set status='completed' where student_id=sid and status='active';
  update public.students set status='passive',is_active=false where id=sid;
  declare returning_id uuid:=gen_random_uuid(); begin
    insert into public.student_enrollments(id,organization_id,student_id,package_id,group_id,branch_id,start_date,planned_end_date,payment_due_date,lesson_weekdays,weekly_frequency,total_lessons,status)
      values(returning_id,actor.organization_id,sid,pkg.id,grp.id,grp.branch_id,today,today+30,today,array[2,4]::smallint[],2,pkg.lesson_count,'renewal_pending');
    res:=public.complete_student_renewal(returning_id,null,'Returning student',null);
    if res->>'status'<>'active' or not exists(select 1 from public.students where id=sid and status='active' and is_active=true) then raise exception 'Returning student not activated'; end if;
    if not exists(select 1 from public.student_attendance_plans where enrollment_id=returning_id and is_active=true) then raise exception 'Returning student missing attendance plan'; end if;
  end;
  -- A nonstandard renewal must require and consume its matching approval once.
  old_id:=(select id from public.student_enrollments where student_id=sid and status='active' limit 1);
  update public.student_enrollments set planned_end_date=today-1 where id=old_id;
  declare custom_id uuid:=gen_random_uuid(); approval_id uuid:=gen_random_uuid(); custom_count integer:=case when pkg.lesson_count=9 then 11 else 9 end; begin
    insert into public.student_enrollments(id,organization_id,student_id,package_id,group_id,branch_id,start_date,planned_end_date,payment_due_date,lesson_weekdays,weekly_frequency,total_lessons,status)
      values(custom_id,actor.organization_id,sid,pkg.id,grp.id,grp.branch_id,today,today+30,today,array[2,4]::smallint[],2,custom_count,'renewal_pending');
    begin
      perform public.complete_student_renewal(custom_id,old_id,'Missing approval',null);
      raise exception 'Nonstandard renewal without approval succeeded';
    exception when others then
      if SQLERRM='Nonstandard renewal without approval succeeded' then raise; end if;
    end;
    insert into public.approval_requests(id,organization_id,student_id,request_type,request_label,module,status,reason,requested_by,new_values,metadata)
      values(approval_id,actor.organization_id,sid,'registration_custom_lesson_count','Renewal integration test','enrollment','approved','Rollback integration fixture',actor.id,
        jsonb_build_object('total_lessons',custom_count,'package_id',pkg.id,'group_id',grp.id,'start_date',today,'payment_due_date',today),
        jsonb_build_object('source','student_renewal_center'));
    res:=public.complete_student_renewal(custom_id,old_id,'Approved custom renewal',approval_id);
    if res->>'status'<>'active' or not exists(select 1 from public.approval_requests where id=approval_id and metadata->>'consumed_at' is not null and metadata->>'consumed_enrollment_id'=custom_id::text) then raise exception 'Approval not consumed with renewal'; end if;
  end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.complete_student_renewal(new_id,old_id,'Unauthorized',null);
    raise exception 'Unauthenticated renewal unexpectedly succeeded';
  exception when others then
    if SQLERRM='Unauthenticated renewal unexpectedly succeeded' then raise; end if;
  end;
end $$;
select 'scheduled, immediate, debt, history, attendance, conflict, duplicate, returning student, approval and authentication checks passed' as result;
rollback;

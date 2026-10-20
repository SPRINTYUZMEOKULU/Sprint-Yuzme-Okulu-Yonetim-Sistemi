alter table public.student_renewal_events drop constraint student_renewal_events_renewal_status_check;
alter table public.student_renewal_events add constraint student_renewal_events_renewal_status_check check (renewal_status in ('draft','completed','cancelled','scheduled'));
-- A future renewal is payable now, and becomes the current period on its start date.
create unique index if not exists student_one_scheduled_renewal
  on public.student_enrollments(organization_id,student_id) where status='scheduled';
create index if not exists student_due_renewals
  on public.student_enrollments(start_date,organization_id) where status='scheduled';

-- Creating a future package must not overwrite the current student's plan/package.
create or replace function public.sync_enrollment_package_dependents()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if new.status <> 'active' then return new; end if;
  update public.students set preferred_package_id=new.package_id,updated_at=now()
    where id=new.student_id and organization_id=new.organization_id
      and preferred_package_id is distinct from new.package_id;
  update public.student_attendance_plans set package_lesson_count=new.total_lessons,updated_at=now()
    where enrollment_id=new.id and organization_id=new.organization_id
      and package_lesson_count is distinct from new.total_lessons;
  return new;
end $$;

create or replace function private.activate_enrollment_period(p_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare e public.student_enrollments%rowtype; ap_id uuid; iso_days smallint[];
begin
  select * into e from public.student_enrollments where id=p_id for update;
  if not found or e.status not in ('scheduled','renewal_pending') or e.start_date>(now() at time zone 'Europe/Istanbul')::date then
    raise exception 'Yeni dönemin başlangıç tarihi henüz gelmedi.';
  end if;
  update public.student_enrollments set status='completed',updated_at=now()
    where organization_id=e.organization_id and student_id=e.student_id and status='active' and id<>e.id;
  update public.student_enrollments set status='active',start_confirmation_required=false,
    actual_started_at=(e.start_date+time '00:00') at time zone 'Europe/Istanbul',updated_at=now() where id=e.id;
  select array_agg((case when d=0 then 7 else d end)::smallint order by case when d=0 then 7 else d end)
    into iso_days from unnest(e.lesson_weekdays) d;
  update public.student_attendance_plans set is_active=false,updated_at=now()
    where organization_id=e.organization_id and student_id=e.student_id and is_active=true and enrollment_id is distinct from e.id;
  select id into ap_id from public.student_attendance_plans where enrollment_id=e.id and organization_id=e.organization_id order by created_at desc limit 1;
  if ap_id is null then
    insert into public.student_attendance_plans(organization_id,student_id,enrollment_id,group_id,selected_weekdays,
      weekly_frequency,package_lesson_count,start_date,normal_planned_end_date,compensation_planned_end_date,is_active)
    values(e.organization_id,e.student_id,e.id,e.group_id,iso_days,e.weekly_frequency,e.total_lessons,e.start_date,
      e.planned_end_date,e.planned_end_date,true);
  else
    update public.student_attendance_plans set is_active=true,group_id=e.group_id,selected_weekdays=iso_days,
      weekly_frequency=e.weekly_frequency,package_lesson_count=e.total_lessons,start_date=e.start_date,
      normal_planned_end_date=e.planned_end_date,updated_at=now() where id=ap_id;
  end if;
  update public.student_group_memberships set is_active=false,ended_at=e.start_date-1
    where organization_id=e.organization_id and student_id=e.student_id and is_active=true and group_id is distinct from e.group_id;
  if e.group_id is not null and not exists(select 1 from public.student_group_memberships where student_id=e.student_id and is_active=true and group_id=e.group_id) then
    insert into public.student_group_memberships(organization_id,student_id,group_id,started_at,is_active)
      values(e.organization_id,e.student_id,e.group_id,e.start_date,true);
  end if;
  update public.students set preferred_package_id=e.package_id,preferred_group_id=e.group_id,
    branch_id=coalesce(e.branch_id,branch_id),status='active',is_active=true,updated_at=now()
    where id=e.student_id and organization_id=e.organization_id;
  update public.student_renewal_events set renewal_status='completed' where new_enrollment_id=e.id and renewal_status='scheduled';
  insert into public.student_activity_logs(organization_id,student_id,activity_type,title,description,source_type,source_id,new_value,performed_at)
    values(e.organization_id,e.student_id,'renewal_period_activated','Yeni kayıt dönemi başladı',
      'Önceden hazırlanan dönem başlangıç tarihinde otomatik olarak kurs özetine ve programa alındı.',
      'student_enrollments',e.id,jsonb_build_object('start_date',e.start_date,'planned_end_date',e.planned_end_date),now());
end $$;

create or replace function private.activate_due_renewals(p_org uuid default null)
returns integer language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare e record; n integer:=0;
begin
  for e in select id,student_id from public.student_enrollments where status='scheduled'
    and exists(select 1 from public.students s where s.id=student_enrollments.student_id and s.status='active' and s.is_deleted=false)
    and start_date<=(now() at time zone 'Europe/Istanbul')::date and (p_org is null or organization_id=p_org)
    order by start_date,id loop
    perform 1 from public.students where id=e.student_id for update;
    if exists(select 1 from public.student_enrollments where id=e.id and status='scheduled') then
      perform private.activate_enrollment_period(e.id); n:=n+1;
    end if;
  end loop;
  return n;
end $$;

create or replace function private.sync_my_due_renewals()
returns integer language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare org uuid;
begin
  select organization_id into org from public.profiles where id=auth.uid() and is_active=true and role::text<>'pending';
  if auth.uid() is null or org is null then raise exception 'Yetkili oturum bulunamadı.'; end if;
  return private.activate_due_renewals(org);
end $$;
create or replace function public.sync_due_renewals()
returns integer language sql security invoker set search_path=pg_catalog,public,pg_temp as $$ select private.sync_my_due_renewals() $$;

create or replace function private.finalize_enrollment_renewal(p_new_id uuid,p_previous_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare actor public.profiles%rowtype; e public.student_enrollments%rowtype; previous public.student_enrollments%rowtype; result_status text;
begin
  select * into actor from public.profiles where id=auth.uid() and is_active=true;
  if not found or actor.role::text not in ('owner','admin','branch_manager','registration_staff') then raise exception 'Yenileme yetkiniz bulunmuyor.'; end if;
  select * into e from public.student_enrollments where id=p_new_id and organization_id=actor.organization_id;
  if not found or e.status<>'renewal_pending' then raise exception 'Hazırlanan yeni dönem bulunamadı.'; end if;
  perform 1 from public.students where id=e.student_id and organization_id=actor.organization_id and is_deleted=false for update;
  if not found then raise exception 'Öğrenci bulunamadı.'; end if;
  select * into previous from public.student_enrollments where student_id=e.student_id and organization_id=e.organization_id and status='active' for update;
  if previous.id is distinct from p_previous_id then raise exception 'Mevcut kayıt değişti. Sayfayı yenileyin.'; end if;
  if exists(select 1 from public.student_enrollments where student_id=e.student_id and organization_id=e.organization_id and status='scheduled') then
    raise exception 'Bu kursiyerin hazırlanmış sonraki dönemi zaten var. Önce o kaydı kontrol edin.';
  end if;
  if previous.id is not null and e.start_date<=previous.planned_end_date then
    raise exception 'Yeni dönem, mevcut dönemin normal bitişinden sonra başlamalıdır.';
  end if;
  if previous.id is not null and e.start_date>(now() at time zone 'Europe/Istanbul')::date then
    update public.student_enrollments set status='scheduled',start_confirmation_required=false,actual_started_at=null,updated_at=now() where id=e.id;
    result_status:='scheduled';
  elsif previous.id is not null then
    perform private.activate_enrollment_period(e.id); result_status:='active';
  else
    update public.student_enrollments set status='active',updated_at=now() where id=e.id;
    result_status:='active';
  end if;
  return jsonb_build_object('ok',true,'status',result_status);
end $$;
create or replace function public.finalize_enrollment_renewal(p_new_id uuid,p_previous_id uuid)
returns jsonb language sql security invoker set search_path=pg_catalog,public,pg_temp as $$ select private.finalize_enrollment_renewal(p_new_id,p_previous_id) $$;

revoke all on function private.activate_enrollment_period(uuid),private.activate_due_renewals(uuid),private.sync_my_due_renewals(),private.finalize_enrollment_renewal(uuid,uuid) from public,anon,authenticated;
revoke all on function public.sync_due_renewals(),public.finalize_enrollment_renewal(uuid,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.sync_my_due_renewals(),private.finalize_enrollment_renewal(uuid,uuid),public.sync_due_renewals(),public.finalize_enrollment_renewal(uuid,uuid) to authenticated;

-- Repair existing future renewals without deleting history, payments or compensation.
do $$
declare e record; prior_id uuid;
begin
  for e in select se.* from public.student_enrollments se where se.status='active'
    and se.start_date>(now() at time zone 'Europe/Istanbul')::date
    and exists(select 1 from public.student_renewal_events r where r.new_enrollment_id=se.id)
    and exists(select 1 from public.students s where s.id=se.student_id and s.status='active' and s.is_deleted=false) loop
    with recursive chain as (
      select prev.*,1 as depth from public.student_renewal_events r join public.student_enrollments prev on prev.id=r.previous_enrollment_id where r.new_enrollment_id=e.id
      union all
      select prev.*,c.depth+1 from chain c join public.student_renewal_events r on r.new_enrollment_id=c.id
        join public.student_enrollments prev on prev.id=r.previous_enrollment_id where c.depth<20 and c.used_lessons=0 and c.actual_started_at is null
    ) select id into prior_id from chain where start_date<e.start_date order by depth desc limit 1;
    if prior_id is not null then
      update public.student_enrollments set status='scheduled',start_confirmation_required=false,actual_started_at=null,updated_at=now() where id=e.id;
      update public.student_renewal_events set renewal_status='scheduled' where new_enrollment_id=e.id;
      update public.student_enrollments set status='active',updated_at=now() where id=prior_id;
      update public.students s set preferred_package_id=old.package_id,preferred_group_id=old.group_id,branch_id=coalesce(old.branch_id,s.branch_id)
        from public.student_enrollments old where old.id=prior_id and s.id=e.student_id;
    end if;
  end loop;
end $$;

create extension if not exists pg_cron with schema pg_catalog;
-- 21:00 UTC is midnight in Antalya. No client polling is introduced.
select cron.schedule('sprint-activate-renewals-daily','0 21 * * *','select private.activate_due_renewals();');

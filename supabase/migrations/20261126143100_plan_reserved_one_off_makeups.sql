-- Convert an existing reserved cancellation right into a dated plan atomically.
-- No new ledger credit, no changes to package, payment or attendance history.
create or replace function public.plan_reserved_compensation(p_actor uuid,p_log uuid,p_date date,p_schedule uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 actor public.profiles%rowtype; source public.student_activity_logs%rowtype;
 e public.student_enrollments%rowtype; sched public.lesson_schedules%rowtype;
 makeup public.student_compensation_lessons%rowtype; candidates int;
 today date:=(now() at time zone 'Europe/Istanbul')::date; original jsonb; previous jsonb;
begin
 select * into actor from public.profiles where id=p_actor and is_active;
 if actor.id is null or actor.role::text not in ('owner','admin','branch_manager') then
  raise exception 'Telafi planlama yetkisi gerekiyor.' using errcode='42501';
 end if;
 -- A client cannot supply an actor: this function is callable only by the server role.
 select * into source from public.student_activity_logs where id=p_log and organization_id=actor.organization_id
  and activity_type='lesson_cancellation_compensation' and new_value->>'compensation_mode'='reserve' for update;
 if source.id is null then raise exception 'Saklı telafi hakkı bulunamadı.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(concat(actor.organization_id,source.student_id,'compensation_plan'),0));
 if nullif(source.new_value->>'compensation_date','') is not null then
  select * into makeup from public.student_compensation_lessons where id=(source.new_value->>'compensation_id')::uuid and organization_id=actor.organization_id;
  if makeup.id is null then raise exception 'Önceki plan doğrulanamadı; yönetici kontrolü gerekiyor.'; end if;
  return jsonb_build_object('duplicate',true,'student_id',source.student_id,'previous',jsonb_build_object('reserved',true,'id',makeup.id,'student_id',source.student_id,'lesson_date',source.old_value->>'cancelled_lesson_date','target_schedule_id',source.source_id,'target_group_id',source.new_value->>'group_id'),'current',to_jsonb(makeup));
 end if;
 if p_date is null or p_date<today then raise exception 'Bugün veya ileri bir tarih seçin.'; end if;
 if not exists(select 1 from public.students where id=source.student_id and organization_id=actor.organization_id and not is_deleted) then raise exception 'Kursiyer bulunamadı.'; end if;
 select s.* into sched from public.lesson_schedules s join public.training_groups g on g.id=s.group_id and g.organization_id=s.organization_id
  join public.branches b on b.id=g.branch_id and b.organization_id=g.organization_id
  where s.id=p_schedule and s.organization_id=actor.organization_id and (s.is_active or (s.makeup_date=p_date and s.group_id=(source.new_value->>'group_id')::uuid)) and g.is_active and b.is_active;
 if sched.id is null or (case when sched.weekday=0 then 7 else sched.weekday end)<>extract(isodow from p_date)::int then raise exception 'Aktif seans seçilen günle eşleşmiyor.'; end if;
 if p_date=today and sched.start_time<=(now() at time zone 'Europe/Istanbul')::time then raise exception 'Başlamış bir seansa telafi planlanamaz.'; end if;
 -- Bind to the original period; never consume the student's renewed package.
 select count(*) into candidates from public.student_enrollments n where n.organization_id=actor.organization_id and n.student_id=source.student_id
  and n.group_id=(source.new_value->>'group_id')::uuid and (source.old_value->>'cancelled_lesson_date')::date between n.start_date and n.planned_end_date and n.status in ('active','completed');
 if candidates<>1 then raise exception 'Kaynak kayıt dönemi tekil olarak doğrulanamadı; kursiyer dosyasını kontrol edin.'; end if;
 select * into e from public.student_enrollments n where n.organization_id=actor.organization_id and n.student_id=source.student_id
  and n.group_id=(source.new_value->>'group_id')::uuid and (source.old_value->>'cancelled_lesson_date')::date between n.start_date and n.planned_end_date and n.status in ('active','completed') for update;
 if exists(select 1 from public.student_compensation_lessons c where c.organization_id=actor.organization_id and c.student_id=source.student_id and c.lesson_date=p_date and c.target_schedule_id=p_schedule and c.status in ('planned','completed')) then raise exception 'Bu seansta zaten telafi kaydı var.'; end if;
 if exists(select 1 from public.attendance_records a where a.organization_id=actor.organization_id and a.student_id=source.student_id and a.lesson_date=p_date and a.schedule_id=p_schedule) then raise exception 'Bu seansta yoklama kaydı var.'; end if;
 if exists(select 1 from public.student_activity_logs l where l.organization_id=actor.organization_id and l.activity_type='lesson_cancellation_compensation' and l.source_id=p_schedule and l.old_value->>'cancelled_lesson_date'=p_date::text) then raise exception 'Bu seans için ders iptali kayıtlı; başka bir seans seçin.'; end if;
 if exists(select 1 from public.student_enrollments n where n.organization_id=actor.organization_id and n.student_id=source.student_id and n.group_id=sched.group_id and n.status in ('active','scheduled') and p_date between n.start_date and n.planned_end_date and (coalesce(cardinality(n.lesson_weekdays),0)=0 or sched.weekday=any(n.lesson_weekdays) or (sched.weekday in (0,7) and (0=any(n.lesson_weekdays) or 7=any(n.lesson_weekdays))))) then raise exception 'Bu seansta normal ders hakkı bulunuyor; ayrı bir telafi seansı seçin.'; end if;
 insert into public.student_compensation_lessons(organization_id,student_id,enrollment_id,target_group_id,target_schedule_id,lesson_date,status,note,created_by)
 values(actor.organization_id,source.student_id,e.id,sched.group_id,p_schedule,p_date,'planned','Saklı telafi hakkı planlandı. Kaynak ders: '||(source.old_value->>'cancelled_lesson_date'),p_actor) returning * into makeup;
 original:=source.new_value;
 previous:=jsonb_build_object('reserved',true,'id',makeup.id,'student_id',source.student_id,'lesson_date',source.old_value->>'cancelled_lesson_date','target_schedule_id',source.source_id,'target_group_id',source.new_value->>'group_id');
 -- The same reserved unit becomes planned: the rights calculator must not count it twice.
 update public.student_activity_logs set new_value=original||jsonb_build_object('compensation_date',p_date,'target_schedule_id',p_schedule,'compensation_id',makeup.id,'planned_by',p_actor,'planned_at',now()) where id=source.id;
 insert into public.student_activity_logs(organization_id,student_id,activity_type,title,description,old_value,new_value,source_type,source_id,performed_by)
 values(actor.organization_id,source.student_id,'compensation_reserved_planned','Saklı telafi hakkı planlandı',to_char(p_date,'DD.MM.YYYY')||' tarihine planlandı.',previous||jsonb_build_object('reservation_id',source.id,'original_reservation',original),to_jsonb(makeup),'student_compensation_lessons',makeup.id,p_actor);
 update public.student_attendance_plans ap set compensation_planned_end_date=greatest(ap.normal_planned_end_date,p_date,ap.compensation_planned_end_date),updated_by=p_actor,updated_at=now()
  where ap.organization_id=actor.organization_id and ap.enrollment_id=e.id;
 update public.student_enrollments set compensation_end_date=greatest(planned_end_date,compensation_end_date,p_date),updated_at=now() where id=e.id;
 -- Old unsent 'date pending' messages must not remain in the send queue.
 update public.message_logs set status='cancelled' where organization_id=actor.organization_id and student_id=source.student_id and template_key='lesson_cancellation_compensation' and status='prepared'
  and metadata->>'source_schedule_id'=source.source_id::text and metadata->>'cancelled_date'=source.old_value->>'cancelled_lesson_date';
 return jsonb_build_object('duplicate',false,'student_id',source.student_id,'previous',previous,'current',to_jsonb(makeup));
end $$;
revoke all on function public.plan_reserved_compensation(uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.plan_reserved_compensation(uuid,uuid,date,uuid) to service_role;

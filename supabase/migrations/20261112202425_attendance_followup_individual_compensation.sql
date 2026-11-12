-- New operations only. No historical attendance, lesson rights or requests are rewritten.
create or replace function public.create_attendance_student_followup(
 p_actor uuid,p_student uuid,p_schedule uuid,p_date date,p_kind text,p_note text default ''
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 actor public.profiles%rowtype; sched public.lesson_schedules%rowtype; student public.students%rowtype;
 note_id uuid; alert_id uuid; previous record; label text; content text; coach_ids uuid[]; broad boolean;
begin
 select * into actor from public.profiles where id=p_actor and is_active;
 if actor.id is null or actor.role::text not in ('owner','admin','branch_manager','registration_staff','accounting','coach') then raise exception 'Yetkisiz işlem.' using errcode='42501'; end if;
 select * into sched from public.lesson_schedules where id=p_schedule and organization_id=actor.organization_id;
 select * into student from public.students where id=p_student and organization_id=actor.organization_id and not is_deleted;
 if sched.id is null or student.id is null or p_date is null or extract(isodow from p_date)::int <> (case when sched.weekday=0 then 7 else sched.weekday end) then raise exception 'Öğrenci veya seans bulunamadı.'; end if;
 if not (exists(select 1 from public.student_enrollments e where e.organization_id=actor.organization_id and e.student_id=p_student and e.group_id=sched.group_id)
   or exists(select 1 from public.student_compensation_lessons c where c.organization_id=actor.organization_id and c.student_id=p_student and c.target_schedule_id=p_schedule and c.lesson_date=p_date)) then raise exception 'Öğrenci bu seansla ilişkili değil.'; end if;
 if actor.role::text='coach' then
  select array[p_actor]||coalesce(array_agg(id),'{}'::uuid[]) into coach_ids from public.staff where organization_id=actor.organization_id and auth_user_id=p_actor and is_active;
  broad := sched.coach_id=any(coach_ids) or exists(select 1 from public.training_groups g where g.id=sched.group_id and g.organization_id=actor.organization_id and g.primary_coach_id=any(coach_ids))
    or exists(select 1 from public.lesson_staff_assignments a where a.organization_id=actor.organization_id and a.is_active and a.coach_id=any(coach_ids) and (a.schedule_id=p_schedule or (a.schedule_id is null and a.group_id=sched.group_id)));
  if not coalesce(broad,false) and not exists(select 1 from public.lesson_student_assignments a where a.organization_id=actor.organization_id and a.student_id=p_student and a.is_active and a.coach_id=any(coach_ids) and (a.schedule_id=p_schedule or (a.schedule_id is null and a.group_id=sched.group_id))) then raise exception 'Bu seans size atanmış değil.' using errcode='42501'; end if;
  if exists(select 1 from public.lesson_student_assignments a where a.organization_id=actor.organization_id and a.student_id=p_student and a.is_active and a.coach_id is not null and not(a.coach_id=any(coach_ids)) and (a.schedule_id=p_schedule or (a.schedule_id is null and a.group_id=sched.group_id)))
   and not exists(select 1 from public.lesson_student_assignments a where a.organization_id=actor.organization_id and a.student_id=p_student and a.is_active and (a.coach_id is null or a.coach_id=any(coach_ids)) and (a.schedule_id=p_schedule or (a.schedule_id is null and a.group_id=sched.group_id))) then raise exception 'Bu öğrenci başka eğitmene atanmış.' using errcode='42501'; end if;
 end if;
 label := case p_kind when 'call' then 'Veli aranacak' when 'absence' then 'Devamsızlık takibi' when 'information' then 'Bilgi alınacak' when 'other' then 'Diğer' end;
 if label is null or length(coalesce(p_note,''))>2000 then raise exception 'Takip bilgisi geçersiz.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(concat(actor.organization_id,p_student,p_schedule,p_date,p_kind),0));
 select t.metadata->>'note_id' as note_id,t.metadata->>'alert_id' as alert_id into previous from public.student_timeline_events t
  where t.organization_id=actor.organization_id and t.student_id=p_student and t.title='Yoklama takibi oluşturuldu'
  and t.metadata->>'schedule_id'=p_schedule::text and t.metadata->>'lesson_date'=p_date::text and t.metadata->>'kind'=p_kind limit 1;
 if found then return jsonb_build_object('ok',true,'duplicate',true,'note_id',previous.note_id,'alert_id',previous.alert_id); end if;
 content := label||E'\n'||to_char(p_date,'DD.MM.YYYY')||' · '||to_char(sched.start_time,'HH24:MI')||case when btrim(coalesce(p_note,''))<>'' then E'\n'||btrim(p_note) else '' end;
 insert into public.student_notes(organization_id,student_id,author_id,note_type,body,is_guardian_visible)
 values(actor.organization_id,p_student,p_actor,'management',content,false) returning id into note_id;
 insert into public.student_activity_logs(organization_id,student_id,activity_type,title,description,source_type,source_id,performed_by,reminder_at,reminder_completed)
 values(actor.organization_id,p_student,'student_note_reminder','Yoklama takibi · '||label,content,'student_note',note_id,p_actor,now(),false);
 insert into public.alerts(organization_id,branch_id,alert_type,title,description,priority,status,assigned_to,source_table,source_id,action_label,action_url,due_at)
 values(actor.organization_id,sched.branch_id,'attendance_reminder',concat_ws(' ',student.first_name,student.last_name)||' · '||label,content,'normal','open',p_actor,'student_notes',note_id,'Takibi Aç','/ogrenciler/'||p_student||'?noteId='||note_id||'#notlar',now()) returning id into alert_id;
 insert into public.student_timeline_events(organization_id,student_id,event_type,title,description,created_by,metadata)
 values(actor.organization_id,p_student,'note_added','Yoklama takibi oluşturuldu',content,p_actor,jsonb_build_object('note_id',note_id,'alert_id',alert_id,'schedule_id',p_schedule,'lesson_date',p_date,'kind',p_kind));
 return jsonb_build_object('ok',true,'duplicate',false,'note_id',note_id,'alert_id',alert_id,'body',content);
end $$;

create or replace function public.complete_attendance_student_followup(p_actor uuid,p_note uuid,p_reply text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.profiles%rowtype; n public.student_notes%rowtype; a public.alerts%rowtype; done_by uuid; done_at timestamptz;
begin
 select * into actor from public.profiles where id=p_actor and is_active;
 if actor.id is null or actor.role::text not in ('owner','admin','branch_manager','registration_staff','accounting','coach') then raise exception 'Yetkisiz işlem.' using errcode='42501'; end if;
 select * into a from public.alerts where organization_id=actor.organization_id and source_table='student_notes' and source_id=p_note and alert_type='attendance_reminder' for update;
 if a.id is null then raise exception 'Takip bulunamadı.'; end if;
 if actor.role::text='coach' and a.assigned_to is distinct from p_actor then raise exception 'Bu takip size ait değil.' using errcode='42501'; end if;
 select * into n from public.student_notes where id=p_note and organization_id=actor.organization_id;
 if n.id is null then raise exception 'Takip notu bulunamadı.'; end if;
 if a.status::text='completed' then return jsonb_build_object('ok',true,'duplicate',true,'completed_by',a.completed_by,'completed_at',a.completed_at); end if;
 if length(btrim(coalesce(p_reply,''))) not between 1 and 3000 then raise exception 'Tamamlama açıklaması zorunludur.'; end if;
 done_at:=now(); done_by:=p_actor;
 insert into public.student_timeline_events(organization_id,student_id,event_type,title,description,created_by,created_at)
 values(actor.organization_id,n.student_id,'note_updated','Öğrenci notu tamamlandı','SPRINT_NOTE_COMPLETED:'||p_note||E'\n'||btrim(p_reply),p_actor,done_at);
 update public.student_activity_logs set reminder_completed=true,reminder_completed_by=p_actor,reminder_completed_at=done_at where organization_id=actor.organization_id and student_id=n.student_id and source_type='student_note' and source_id=p_note and activity_type='student_note_reminder';
 update public.alerts set status='completed',completed_at=done_at,completed_by=p_actor,updated_at=done_at where id=a.id;
 update public.system_notifications set is_read=true,read_at=done_at where organization_id=actor.organization_id and student_id=n.student_id and (entity_id::text=p_note::text or (source_type='student_note' and source_id::text=p_note::text));
 return jsonb_build_object('ok',true,'completed_by',done_by,'completed_at',done_at);
end $$;

create or replace function public.request_individual_compensation(p_actor uuid,p_student uuid,p_count int,p_reason text,p_description text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.profiles%rowtype; s public.students%rowtype; r public.lesson_adjustment_requests%rowtype;
begin
 select * into actor from public.profiles where id=p_actor and is_active;
 if actor.id is null or actor.role::text not in ('owner','admin','branch_manager','registration_staff','accounting','coach') then raise exception 'Yetkisiz işlem.' using errcode='42501'; end if;
 select * into s from public.students where id=p_student and organization_id=actor.organization_id and not is_deleted;
 if s.id is null then raise exception 'Öğrenci bulunamadı.'; end if;
 if p_count is null or p_count not between 1 and 20 or length(btrim(coalesce(p_reason,''))) not between 1 and 250 then raise exception 'Telafi sayısı veya gerekçe geçersiz.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(concat(actor.organization_id,p_student,'individual_compensation'),0));
 select * into r from public.lesson_adjustment_requests where organization_id=actor.organization_id and student_id=p_student and request_type='individual_compensation' and status='pending' order by requested_at desc limit 1;
 if found then return jsonb_build_object('ok',true,'duplicate',true,'request',to_jsonb(r)); end if;
 insert into public.lesson_adjustment_requests(organization_id,request_type,student_id,branch_id,lesson_count,reason,description,status,requested_by)
 values(actor.organization_id,'individual_compensation',p_student,s.branch_id,p_count,btrim(p_reason),nullif(btrim(p_description),''),'pending',p_actor) returning * into r;
 insert into public.student_activity_logs(organization_id,student_id,activity_type,title,description,source_type,source_id,performed_by)
 values(actor.organization_id,p_student,'compensation_requested','Bireysel telafi onay bekliyor',p_count||' ders · '||p_reason,'lesson_adjustment',r.id,p_actor);
 return jsonb_build_object('ok',true,'duplicate',false,'request',to_jsonb(r));
end $$;

create or replace function public.decide_individual_compensation(p_actor uuid,p_request uuid,p_action text,p_review text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 actor public.profiles%rowtype; r public.lesson_adjustment_requests%rowtype; e public.student_enrollments%rowtype;
 sched public.lesson_schedules%rowtype; day date; last_day date; today date:=(now() at time zone 'Europe/Istanbul')::date;
 dates jsonb:='[]'::jsonb; added int:=0; attempts int:=0; decision text; recipient text; message_body text;
begin
 select * into actor from public.profiles where id=p_actor and is_active;
 if actor.id is null or actor.role::text not in ('owner','admin') then raise exception 'Yönetici yetkisi gerekiyor.' using errcode='42501'; end if;
 select * into r from public.lesson_adjustment_requests where id=p_request and organization_id=actor.organization_id and request_type='individual_compensation' for update;
 if r.id is null then raise exception 'Telafi talebi bulunamadı.'; end if;
 decision:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' end;
 if decision is null then raise exception 'Geçersiz işlem.'; end if;
 if r.status=decision then return jsonb_build_object('ok',true,'duplicate',true,'student_id',r.student_id,'lesson_count',r.lesson_count,'requested_by',r.requested_by); end if;
 if r.status<>'pending' then raise exception 'Bu talep daha önce işlenmiş.' using errcode='40001'; end if;
 if decision='approved' then
  if r.lesson_count is null or r.lesson_count not between 1 and 20 then raise exception 'Geçersiz telafi sayısı.'; end if;
  if not exists(select 1 from public.students where id=r.student_id and organization_id=actor.organization_id and not is_deleted) then raise exception 'Öğrenci bulunamadı.'; end if;
  -- Serialize all requests for this student; different approvals cannot pick the same dates.
  perform pg_advisory_xact_lock(hashtextextended(concat(actor.organization_id,r.student_id,'compensation_plan'),0));
  select * into e from public.student_enrollments where organization_id=actor.organization_id and student_id=r.student_id and start_date<=today and status in ('active','completed') order by start_date desc,created_at desc limit 1 for update;
  if e.id is null or e.group_id is null or e.planned_end_date is null then raise exception 'Telafi planı için geçerli kayıt dönemi ve grup bulunamadı.'; end if;
  if exists(select 1 from public.student_lesson_ledger where organization_id=actor.organization_id and source_id=r.id and source_type='individual_compensation') or exists(select 1 from public.student_compensation_lessons where organization_id=actor.organization_id and source_request_id=r.id) then raise exception 'Bu talebe ait önceki ders kaydı var; yönetici kontrolü gerekiyor.' using errcode='40001'; end if;
  select greatest(e.planned_end_date,today-1,coalesce(max(lesson_date),e.planned_end_date)) into day from public.student_compensation_lessons where organization_id=actor.organization_id and student_id=r.student_id and status<>'cancelled';
  while added<r.lesson_count loop
   day:=day+1;attempts:=attempts+1;
   if attempts>1500 then raise exception 'Kayıt günlerine uygun aktif seans bulunamadı.'; end if;
   select * into sched from public.lesson_schedules s where s.organization_id=actor.organization_id and s.group_id=e.group_id and s.is_active
     and exists(select 1 from public.training_groups g join public.branches b on b.id=g.branch_id where g.id=s.group_id and g.organization_id=actor.organization_id and g.is_active and b.is_active)
     and not exists(select 1 from public.student_activity_logs l where l.organization_id=actor.organization_id and l.student_id=r.student_id and l.activity_type='lesson_cancellation_compensation' and l.source_id=s.id and l.old_value->>'cancelled_lesson_date'=day::text)
     and (case when s.weekday=0 then 7 else s.weekday end)=extract(isodow from day)::int
     and (coalesce(cardinality(e.lesson_weekdays),0)=0 or s.weekday=any(e.lesson_weekdays) or (s.weekday in (0,7) and (0=any(e.lesson_weekdays) or 7=any(e.lesson_weekdays))))
     order by s.start_time,s.id limit 1;
   if sched.id is not null and not exists(select 1 from public.student_compensation_lessons c where c.organization_id=actor.organization_id and c.student_id=r.student_id and c.lesson_date=day and c.status<>'cancelled') then
    -- A renewal's regular lesson must not also be assigned as a makeup.
    if exists(select 1 from public.student_enrollments n where n.organization_id=actor.organization_id and n.student_id=r.student_id and n.id<>e.id and n.status in ('active','scheduled') and day between n.start_date and n.planned_end_date and (coalesce(cardinality(n.lesson_weekdays),0)=0 or extract(isodow from day)::int=any(n.lesson_weekdays) or (extract(isodow from day)=7 and 0=any(n.lesson_weekdays)))) then continue; end if;
    insert into public.student_compensation_lessons(organization_id,student_id,enrollment_id,source_request_id,target_group_id,target_schedule_id,lesson_date,status,note,created_by)
    values(actor.organization_id,r.student_id,e.id,r.id,e.group_id,sched.id,day,'planned',r.reason,p_actor);
    dates:=dates||jsonb_build_array(jsonb_build_object('date',day,'schedule_id',sched.id));added:=added+1;last_day:=day;
   end if;
  end loop;
  insert into public.student_lesson_ledger(organization_id,student_id,enrollment_id,group_id,lesson_type,direction,lesson_count,reason,description,source_type,source_id,requires_approval,approval_status,requested_by,requested_at,approved_by,approved_at)
  values(actor.organization_id,r.student_id,e.id,e.group_id,'compensation','credit',r.lesson_count,r.reason,r.description,'individual_compensation',r.id,true,'approved',r.requested_by,r.requested_at,p_actor,now());
  message_body:=r.lesson_count||' adet telafi dersiniz yönetici onayıyla planlanmıştır.'||E'\n'||(select string_agg(to_char((x->>'date')::date,'DD.MM.YYYY'),' · ') from jsonb_array_elements(dates) x)||E'\n\nSprint Yüzme Okulu';
  select regexp_replace(coalesce(nullif(btrim(guardian_phone),''),phone,''),'[^0-9]','','g') into recipient from public.students where id=r.student_id and organization_id=actor.organization_id;
  if length(recipient)=11 and left(recipient,1)='0' then recipient:='9'||recipient; elsif length(recipient)=10 then recipient:='90'||recipient; end if;
  insert into public.message_logs(organization_id,student_id,template_key,channel,recipient,subject,message_body,status,prepared_by,prepared_at,metadata)
  values(actor.organization_id,r.student_id,'individual_compensation_approved','whatsapp',nullif(recipient,''),'Bireysel telafi planınız',message_body,'prepared',p_actor,now(),jsonb_build_object('request_id',r.id,'plans',dates,'delivery_confirmation','prepared'));
  insert into public.student_contact_logs(organization_id,student_id,contact_type,channel,status,message_text,prepared_at)
  values(actor.organization_id,r.student_id,'compensation','whatsapp','prepared',message_body,now());
 end if;
 update public.lesson_adjustment_requests set status=decision,approved_by=p_actor,approved_at=now() where id=r.id;
 insert into public.approval_history(organization_id,student_id,source_type,source_id,action_type,decision,reason,decision_note,requested_by,requested_at,decided_by,decided_at,snapshot)
 values(actor.organization_id,r.student_id,'lesson_adjustment',r.id,'individual_compensation',decision,r.reason,p_review,r.requested_by,r.requested_at,p_actor,now(),to_jsonb(r)||jsonb_build_object('plans',dates));
 insert into public.student_activity_logs(organization_id,student_id,activity_type,title,description,new_value,source_type,source_id,performed_by,approved_by,approved_at)
 values(actor.organization_id,r.student_id,case when decision='approved' then 'compensation_added' else 'compensation_rejected' end,case when decision='approved' then r.lesson_count||' telafi dersi planlandı' else 'Telafi talebi reddedildi' end,coalesce(p_review,r.reason),jsonb_build_object('plans',dates,'enrollment_id',e.id),'lesson_adjustment',r.id,p_actor,p_actor,now());
 return jsonb_build_object('ok',true,'duplicate',false,'student_id',r.student_id,'lesson_count',r.lesson_count,'requested_by',r.requested_by,'plans',dates,'enrollment_id',e.id,'end_date',last_day);
end $$;

revoke all on function public.create_attendance_student_followup(uuid,uuid,uuid,date,text,text) from public,anon,authenticated;
revoke all on function public.complete_attendance_student_followup(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.request_individual_compensation(uuid,uuid,int,text,text) from public,anon,authenticated;
revoke all on function public.decide_individual_compensation(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_attendance_student_followup(uuid,uuid,uuid,date,text,text),public.complete_attendance_student_followup(uuid,uuid,text),public.request_individual_compensation(uuid,uuid,int,text,text),public.decide_individual_compensation(uuid,uuid,text,text) to service_role;

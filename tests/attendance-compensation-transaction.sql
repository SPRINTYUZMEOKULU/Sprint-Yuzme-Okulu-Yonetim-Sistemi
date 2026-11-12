-- Run inside BEGIN/ROLLBACK, after loading the migration. Never commit this fixture.
do $$
declare
 actor uuid; student uuid; schedule uuid; school uuid; ndate date; created jsonb; duplicate jsonb; decision jsonb; request_id uuid; note_id uuid;
 enrollment_before jsonb; enrollment_after jsonb; attendance_before bigint; payments_before bigint; before_count bigint; after_count bigint; rejected boolean:=false;
begin
 assert not has_function_privilege('anon','public.decide_individual_compensation(uuid,uuid,text,text)','execute'), 'Anon RPC çağırabiliyor.';
 assert not has_function_privilege('authenticated','public.create_attendance_student_followup(uuid,uuid,uuid,date,text,text)','execute'), 'İstemci aktör kimliği taklit edebiliyor.';
 assert has_function_privilege('service_role','public.decide_individual_compensation(uuid,uuid,text,text)','execute'), 'Sunucu RPC erişimi eksik.';
 select p.id,p.organization_id into actor,school from public.profiles p where p.role::text='owner' and p.is_active limit 1;
 select e.student_id,s.id into student,schedule from public.student_enrollments e join public.lesson_schedules s on s.group_id=e.group_id and s.organization_id=e.organization_id and s.is_active
 join public.students st on st.id=e.student_id and not st.is_deleted
 join public.training_groups g on g.id=e.group_id and g.is_active
 join public.branches b on b.id=g.branch_id and b.is_active
 where e.organization_id=school and e.status='active' and e.start_date<=(now() at time zone 'Europe/Istanbul')::date and e.planned_end_date is not null
 and (coalesce(cardinality(e.lesson_weekdays),0)=0 or s.weekday=any(e.lesson_weekdays))
 and not exists(select 1 from public.lesson_adjustment_requests r where r.student_id=e.student_id and r.status='pending' and r.request_type='individual_compensation') limit 1;
 assert student is not null and actor is not null, 'Test için uygun kayıt yok.';
 begin perform public.request_individual_compensation(gen_random_uuid(),student,1,'Yetkisiz test','');raise exception 'Yetkisiz aktör kabul edildi.';exception when insufficient_privilege then null;end;
 begin perform public.request_individual_compensation(actor,gen_random_uuid(),1,'Kurum dışı test','');raise exception 'Kurum dışı öğrenci kabul edildi.';exception when others then assert sqlerrm='Öğrenci bulunamadı.','Öğrenci kurum kontrolü çalışmadı.';end;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') into enrollment_before from public.student_enrollments e where student_id=student;
 select count(*) into attendance_before from public.attendance_records where student_id=student;
 select count(*) into payments_before from public.student_payments where student_id=student;
 select ((now() at time zone 'Europe/Istanbul')::date - (extract(isodow from (now() at time zone 'Europe/Istanbul')::date)::int) + case when weekday=0 then 7 else weekday end) into ndate from public.lesson_schedules where id=schedule;
 created:=public.create_attendance_student_followup(actor,student,schedule,ndate,'call','SPRINT_ROLLBACK_TEST');
 note_id:=(created->>'note_id')::uuid;
 duplicate:=public.create_attendance_student_followup(actor,student,schedule,ndate,'call','SPRINT_ROLLBACK_TEST');
 assert duplicate->>'note_id'=created->>'note_id' and (duplicate->>'duplicate')::boolean,'Takip mükerrer kaydedildi.';
 assert exists(select 1 from public.student_notes where id=note_id and not is_guardian_visible),'Özel takip notu eksik.';
 assert exists(select 1 from public.alerts where source_id=note_id and status='open'),'Yönetici görev kaydı eksik.';
 perform public.complete_attendance_student_followup(actor,note_id,'Veli arandı; bilgi verildi.');
 perform public.complete_attendance_student_followup(actor,note_id,'Tekrar tamamlama');
 select count(*) into after_count from public.student_timeline_events where student_id=student and description like 'SPRINT_NOTE_COMPLETED:'||note_id||E'\n%';
 assert after_count=1,'Takip tamamlama iki kere işlendi.';
 assert exists(select 1 from public.alerts where source_id=note_id and status='completed' and completed_by=actor),'Takip tamamlayan kişi eksik.';
 created:=public.request_individual_compensation(actor,student,2,'SPRINT_ROLLBACK_TEST','Test, kalıcı kayıt bırakmaz');
 request_id:=(created->'request'->>'id')::uuid;
 duplicate:=public.request_individual_compensation(actor,student,2,'SPRINT_ROLLBACK_TEST','Test');
 assert duplicate->'request'->>'id'=request_id::text and (duplicate->>'duplicate')::boolean,'Tekrar talep oluşturuldu.';
 assert not exists(select 1 from public.student_compensation_lessons where source_request_id=request_id),'Onay öncesi ders oluşturuldu.';
 decision:=public.decide_individual_compensation(actor,request_id,'approve','Rollback testi');
 assert jsonb_array_length(decision->'plans')=2,'İki tarihli telafi oluşturulmadı.';
 select count(*) into before_count from public.student_compensation_lessons where source_request_id=request_id;
 assert before_count=2,'Planlanan ders sayısı yanlış.';
 perform public.decide_individual_compensation(actor,request_id,'approve','Tekrar onay');
 select count(*) into after_count from public.student_compensation_lessons where source_request_id=request_id;
 assert before_count=after_count,'Tekrar onay iki kere ders ekledi.';
 assert (select count(*) from public.student_lesson_ledger where source_id=request_id and source_type='individual_compensation')=1,'Ders hareketi mükerrer.';
 assert (select count(*) from public.approval_history h where h.source_id=request_id and h.decision='approved')=1,'Onay geçmişi mükerrer.';
 begin perform public.decide_individual_compensation(actor,request_id,'reject','Çelişen karar');exception when serialization_failure then rejected:=true;end;
 assert rejected,'Onaylı talep reddedilebildi.';
 created:=public.request_individual_compensation(actor,student,1,'SPRINT_ROLLBACK_REJECT','');
 request_id:=(created->'request'->>'id')::uuid;
 perform public.decide_individual_compensation(actor,request_id,'reject','Uygun görülmedi.');
 assert not exists(select 1 from public.student_compensation_lessons where source_request_id=request_id),'Reddedilen talebe ders eklendi.';
 select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') into enrollment_after from public.student_enrollments e where student_id=student;
 assert enrollment_before=enrollment_after,'Mevcut kayıt dönemi değişti.';
 assert (select count(*) from public.attendance_records where student_id=student)=attendance_before,'Yoklama değişti.';
 assert (select count(*) from public.student_payments where student_id=student)=payments_before,'Ödeme değişti.';
 raise notice 'PASS: takip, tekrar kayıt, tamamlama, telafi onay/red, plan ve veri bütünlüğü';
end $$;

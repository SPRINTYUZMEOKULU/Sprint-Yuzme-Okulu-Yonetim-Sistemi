create or replace function public.prepare_saved_makeup_messages(p_source uuid,p_date date)
returns integer language plpgsql security invoker set search_path='' as $$
declare
 actor public.profiles%rowtype;
 prepared integer;
begin
 select * into actor from public.profiles where id=auth.uid() and is_active;
 if actor.id is null or actor.role::text not in ('owner','admin','branch_manager','registration_staff') then
  raise exception 'Telafi mesajı hazırlama yetkiniz yok.' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(concat(actor.organization_id,p_source,p_date,'makeup_message'),0));
 with current_plans as (
   select distinct on (c.id) c.id,c.student_id,c.lesson_date,c.target_schedule_id,c.target_group_id,
     concat_ws(' ',s.first_name,s.last_name) student_name,
     coalesce(nullif(regexp_replace(case when lower(g.course_type) similar to '%(yetişkin|yetiskin|adult|master)%' then s.phone else s.guardian_phone end,'[^0-9]','','g'),''),
              nullif(regexp_replace(case when lower(g.course_type) similar to '%(yetişkin|yetiskin|adult|master)%' then s.guardian_phone else s.phone end,'[^0-9]','','g'),'')) phone,
     t.start_time,t.end_time,g.name group_name,b.name branch_name,a.new_value->>'compensation_mode' mode
   from public.student_activity_logs a
   join public.student_compensation_lessons c on c.id::text=a.new_value->>'compensation_id'
     and c.student_id=a.student_id and c.organization_id=a.organization_id and c.status='planned'
   join public.students s on s.id=c.student_id and s.organization_id=c.organization_id and not s.is_deleted and s.status='active'
   join public.lesson_schedules t on t.id=c.target_schedule_id and t.organization_id=c.organization_id and t.group_id=c.target_group_id
     and (t.is_active or t.makeup_date=c.lesson_date)
   join public.training_groups g on g.id=c.target_group_id and g.organization_id=c.organization_id and g.is_active
   join public.branches b on b.id=g.branch_id and b.organization_id=c.organization_id and b.is_active
   where a.organization_id=actor.organization_id and a.activity_type='lesson_cancellation_compensation'
     and a.source_id=p_source and a.old_value->>'cancelled_lesson_date'=p_date::text
     and c.lesson_date+t.start_time>(now() at time zone 'Europe/Istanbul')
     and not exists(select 1 from public.message_logs m where m.organization_id=c.organization_id and m.student_id=c.student_id
       and m.template_key='lesson_cancellation_compensation' and m.channel='whatsapp'
       and m.status in ('prepared','sent','delivered','read')
       and m.metadata->>'source_schedule_id'=p_source::text and m.metadata->>'cancelled_date'=p_date::text
       and m.metadata->>'compensation_date'=c.lesson_date::text
       and coalesce(m.metadata->>'target_schedule_id',a.new_value->>'target_schedule_id')=c.target_schedule_id::text)
   order by c.id,a.performed_at desc
 ), normalized as (
   select *,case when phone ~ '^0[0-9]{10}$' then '90'||substr(phone,2)
     when phone ~ '^[0-9]{10}$' then '90'||phone when phone ~ '^90[0-9]{10}$' then phone end recipient
   from current_plans
 )
 insert into public.message_logs(organization_id,student_id,template_key,channel,recipient,subject,message_body,status,prepared_by,metadata)
 select actor.organization_id,student_id,'lesson_cancellation_compensation','whatsapp',recipient,'Planlanan telafi dersi',
   format(E'*SPRİNT YÜZME OKULU | TELAFİ DERSİ*\n\n%s için %s tarihinde iptal edilen yüzme dersinin telafisi planlanmıştır.\n\n*Tarih:* %s\n*Saat:* %s–%s\n*Havuz:* %s\n*Grup:* %s\n\n*Sprint Yüzme Okulu Yönetimi*',
     student_name,to_char(p_date,'DD.MM.YYYY'),to_char(lesson_date,'DD.MM.YYYY'),to_char(start_time,'HH24:MI'),to_char(end_time,'HH24:MI'),branch_name,group_name),
   'prepared',actor.id,jsonb_build_object('compensation_id',id,'compensation_mode',mode,'compensation_date',lesson_date,'target_schedule_id',target_schedule_id,
     'target_group_id',target_group_id,'source_schedule_id',p_source,'cancelled_date',p_date,'planned_start_time',start_time,'planned_end_time',end_time)
 from normalized;
 get diagnostics prepared=row_count;
 return prepared;
end $$;
revoke all on function public.prepare_saved_makeup_messages(uuid,date) from public,anon;
grant execute on function public.prepare_saved_makeup_messages(uuid,date) to authenticated;

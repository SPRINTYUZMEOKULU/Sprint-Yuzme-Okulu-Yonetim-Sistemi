create or replace function public.prepare_conflicted_cancellation_notices(
  p_source uuid, p_date date, p_students uuid[]
) returns integer
language plpgsql security invoker set search_path='' as $$
declare
  actor public.profiles%rowtype;
  prepared integer;
begin
  select * into actor from public.profiles where id=auth.uid() and is_active;
  if actor.id is null or actor.role::text not in ('owner','admin','branch_manager','registration_staff') then
    raise exception 'Ders iptali mesajı hazırlama yetkiniz yok.' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(concat(actor.organization_id,p_source,p_date,'makeup_conflict_notice'),0));
  with candidates as (
    select distinct on (student.id) student.id,concat_ws(' ',student.first_name,student.last_name) as name,
      schedule.start_time,group_row.name as group_name, branch.name as branch_name,
      lower(coalesce(group_row.course_type,'')) ~ 'yetişkin|yetiskin|adult|master' as adult,
      regexp_replace(coalesce(student.phone,''),'[^0-9]','','g') as student_phone,
      regexp_replace(coalesce(student.guardian_phone,''),'[^0-9]','','g') as guardian_phone
    from public.student_activity_logs log
    join public.students student on student.id=log.student_id and student.organization_id=log.organization_id
      and not student.is_deleted and student.status='active'
    join public.lesson_schedules schedule on schedule.id=log.source_id and schedule.organization_id=log.organization_id
    join public.training_groups group_row on group_row.id=schedule.group_id and group_row.organization_id=log.organization_id
    join public.branches branch on branch.id=group_row.branch_id and branch.organization_id=log.organization_id
    where log.organization_id=actor.organization_id and log.source_id=p_source and log.old_value->>'cancelled_lesson_date'=p_date::text
      and (p_students is null or student.id=any(p_students))
      and log.activity_type='lesson_cancellation_skipped'
      and log.description='Bu tarih ve seansta zaten telafi var. Ayrı bir seans seçin.'
      and not exists(
        select 1 from public.student_activity_logs completed where completed.organization_id=log.organization_id
          and completed.student_id=student.id and completed.source_id=p_source
          and completed.old_value->>'cancelled_lesson_date'=p_date::text
          and completed.activity_type='lesson_cancellation_compensation'
      )
      and not exists(
        select 1 from public.message_logs message where message.organization_id=log.organization_id and message.student_id=student.id
          and message.template_key='lesson_cancellation_compensation' and message.channel='whatsapp'
          and message.metadata->>'source_schedule_id'=p_source::text and message.metadata->>'cancelled_date'=p_date::text
          and message.status in ('prepared','sent','delivered','read')
      )
    order by student.id,log.performed_at desc
  ), recipients as (
    select *,coalesce(nullif(case when adult then student_phone else guardian_phone end,''),
      nullif(case when adult then guardian_phone else student_phone end,'')) as raw_phone
    from candidates
  )
  insert into public.message_logs(
    organization_id,student_id,template_key,channel,recipient,subject,message_body,status,prepared_by,metadata
  )
  select actor.organization_id,id,'lesson_cancellation_compensation','whatsapp',
    case when raw_phone ~ '^0[0-9]{10}$' then '90'||substr(raw_phone,2)
      when raw_phone ~ '^[0-9]{10}$' then '90'||raw_phone when raw_phone ~ '^90[0-9]{10}$' then raw_phone end,
    'Ders iptali bilgilendirmesi',
    format(E'*SPRİNT YÜZME OKULU | DERS İPTALİ*\n\nDeğerli %s,\n\n%s için %s saat %s’te planlanan yüzme dersi (%s) iptal edilmiştir.\n\nBu iptale ilişkin telafi tarihi ve saati kesinleştiğinde ayrıca bilgi verilecektir.\n\n*Sprint Yüzme Okulu Yönetimi*',
      case when adult then 'Kursiyerimiz' else 'Velimiz' end,name,
      case when p_date=(now() at time zone 'Europe/Istanbul')::date then 'bugün ('||to_char(p_date,'DD.MM.YYYY')||')'
        else to_char(p_date,'DD.MM.YYYY')||' tarihinde' end,
      to_char(start_time,'HH24:MI'),branch_name),
    'prepared',actor.id,jsonb_build_object('notice_type','makeup_conflict_cancellation','source_schedule_id',p_source,
      'cancelled_date',p_date,'source_start_time',start_time)
  from recipients;
  get diagnostics prepared=row_count;
  return prepared;
end $$;
revoke all on function public.prepare_conflicted_cancellation_notices(uuid,date,uuid[]) from public,anon;
grant execute on function public.prepare_conflicted_cancellation_notices(uuid,date,uuid[]) to authenticated;

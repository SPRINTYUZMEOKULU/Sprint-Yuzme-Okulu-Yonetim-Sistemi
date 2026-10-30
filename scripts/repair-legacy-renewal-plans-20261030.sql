-- Scoped, idempotent repair of 13 verified legacy renewals.
-- Enrollment dates/counters, financial records and compensation lessons are not mutated.
with candidates as materialized (
 select e.*,
   (select jsonb_agg(to_jsonb(p)) from public.student_attendance_plans p
      where p.organization_id=e.organization_id and p.student_id=e.student_id and p.is_active) as previous_plans,
   greatest(e.planned_end_date,
      (select max(p.compensation_planned_end_date) from public.student_attendance_plans p
        where p.organization_id=e.organization_id and p.student_id=e.student_id and p.is_active),
      (select max(c.lesson_date) from public.student_compensation_lessons c
        where c.organization_id=e.organization_id and c.student_id=e.student_id and c.status='planned')) as protected_end
 from public.student_enrollments e
 join public.students s on s.id=e.student_id and s.organization_id=e.organization_id
 where e.organization_id='2aa21b5f-ba88-484e-b450-e50bcc7f2f7d'
   and e.id in (
    'c13b5b49-2823-45a4-8b8e-9c522ef1fe48','b902a1ff-6595-4592-be32-9e6177b41947',
    '78962514-0afb-4ed0-8aea-9cdbcaa08adf','08001c19-1865-4bbe-bba3-42564f040e54',
    'f1180d16-5c75-4ad7-98a0-09f790f576f5','306167f2-80a0-4159-b661-ae741b3ccb3b',
    '61cdfdc4-64b9-4fd5-98d1-134b2a4ed65c','5cf3ab74-c56d-45fd-abbe-ae011fbcee25',
    '96921304-27b6-43e5-8fab-bcfdc043ad2d','7ca039db-bfc0-4355-9904-4db0ae2155e4',
    '817ee2b1-79ce-4bae-9a90-8b5019981eaa','8349c053-1177-443e-9d65-913485db2003',
    '4c7db67d-f409-4467-a786-07f59bb8c6c3')
   and e.status='active' and s.status='active' and not s.is_deleted
   and cardinality(e.lesson_weekdays)>0
   and exists(select 1 from public.student_renewal_events r
      where r.organization_id=e.organization_id and r.new_enrollment_id=e.id and r.renewal_status='completed')
   and not exists(select 1 from public.student_attendance_plans p
      where p.organization_id=e.organization_id and p.enrollment_id=e.id and p.is_active)
 for update of s,e
), deactivated as (
 update public.student_attendance_plans p set is_active=false,updated_at=now()
 from candidates e where p.organization_id=e.organization_id and p.student_id=e.student_id and p.is_active
 returning p.id
), inserted as (
 insert into public.student_attendance_plans
 (organization_id,student_id,enrollment_id,group_id,selected_weekdays,weekly_frequency,
  package_lesson_count,start_date,normal_planned_end_date,compensation_planned_end_date,is_active)
 select e.organization_id,e.student_id,e.id,e.group_id,
   array(select distinct case when d=0 then 7 else d end from unnest(e.lesson_weekdays) d order by 1),
   e.weekly_frequency,e.total_lessons,e.start_date,e.planned_end_date,e.protected_end,true
 from candidates e cross join (select count(*) from deactivated) completed
 returning id,organization_id,student_id,enrollment_id
), logged as (
 insert into public.student_activity_logs
 (organization_id,student_id,activity_type,title,description,source_type,source_id,old_value,new_value,performed_at)
 select i.organization_id,i.student_id,'renewal_plan_repaired','Yeni dönem ders planı eşleştirmesi düzeltildi',
 'Eski döneme bağlı aktif plan arşivlendi; mevcut yenilemenin gün, paket ve tarih bilgileriyle plan oluşturuldu. Telafi bitiş sınırları korundu. Ders sayaçları ve ödemeler değiştirilmedi.',
 'student_enrollments',i.enrollment_id,jsonb_build_object('active_plans',c.previous_plans),
 jsonb_build_object('plan_id',i.id,'enrollment_id',i.enrollment_id,'protected_end',c.protected_end,'repair','20261030_legacy_renewal_plans'),now()
 from inserted i join candidates c on c.id=i.enrollment_id
 returning student_id
)
select jsonb_build_object('repaired_plans',(select count(*) from inserted),
 'archived_old_plans',(select count(*) from deactivated),'audit_entries',(select count(*) from logged)) as result;

alter table public.guardian_satisfaction_surveys
  add column guardian_profile_id uuid references public.profiles(id) on delete set null,
  add column student_id uuid references public.students(id) on delete set null,
  add column problem_reported boolean not null default false;

create function public.submit_guardian_satisfaction_feedback(
  p_id uuid, p_org uuid, p_rating smallint, p_topic text, p_comment text,
  p_guardian uuid, p_student uuid, p_problem boolean
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_problem is null or (p_problem and nullif(btrim(p_comment), '') is null)
    or not exists (
      select 1 from public.profiles p
      join public.guardians g on g.auth_user_id = p.id and g.organization_id = p_org
      join public.guardian_students l on l.guardian_id = g.id and l.portal_access
      join public.students s on s.id = l.student_id and s.organization_id = p_org
      where p.id = p_guardian and p.organization_id = p_org and p.role = 'guardian' and p.is_active
        and g.is_active is not false and g.login_enabled is not false
        and s.id = p_student and s.status = 'active' and s.is_deleted = false
    ) then
    return false;
  end if;
  insert into public.guardian_satisfaction_surveys (id, organization_id, rating, topic, comment, guardian_profile_id, student_id, problem_reported)
    values (p_id, p_org, p_rating, p_topic, nullif(btrim(p_comment), ''), p_guardian, p_student, p_problem)
    on conflict (id) do nothing;
  if not found then
    return exists (
      select 1 from public.guardian_satisfaction_surveys
      where id = p_id and organization_id = p_org and rating = p_rating
        and guardian_profile_id = p_guardian and student_id = p_student
        and problem_reported = p_problem and topic = p_topic and comment is not distinct from nullif(btrim(p_comment), '')
    );
  end if;
  insert into public.system_notifications (
    organization_id, recipient_profile_id, recipient_user_id, notification_type, event_key,
    title, body, message, category, target_path
  )
  select p_org, id, id, 'guardian_satisfaction_survey', 'guardian_satisfaction_survey',
    case when p_problem then 'Ankette sorun bildirildi' else 'Yeni memnuniyet anketi' end, 'Yönetim Kurulu Başkanlığına yeni bir anket yanıtı iletildi.',
    'Yönetim Kurulu Başkanlığına yeni bir anket yanıtı iletildi.', 'system', '/memnuniyet-anketleri'
  from public.profiles
  where organization_id = p_org and role = 'owner' and is_active;
  return true;
end;
$$;
revoke execute on function public.submit_guardian_satisfaction_feedback(uuid, uuid, smallint, text, text, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.submit_guardian_satisfaction_feedback(uuid, uuid, smallint, text, text, uuid, uuid, boolean) to service_role;

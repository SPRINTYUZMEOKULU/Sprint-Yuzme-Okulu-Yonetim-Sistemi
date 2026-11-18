create table public.guardian_satisfaction_surveys (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  rating smallint not null check (rating between 1 and 5),
  topic text not null check (topic in ('lesson', 'communication', 'facility', 'portal', 'other')),
  comment text check (char_length(comment) <= 1200),
  submitted_at timestamptz not null default now()
);

create index guardian_satisfaction_surveys_org_date_idx
  on public.guardian_satisfaction_surveys (organization_id, submitted_at desc, id desc);

alter table public.guardian_satisfaction_surveys enable row level security;
revoke all on table public.guardian_satisfaction_surveys from public, anon, authenticated;
grant select, insert on table public.guardian_satisfaction_surveys to service_role;

create function public.submit_guardian_satisfaction_survey(
  p_id uuid, p_org uuid, p_rating smallint, p_topic text, p_comment text
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare chair uuid;
begin
  select id into strict chair from public.profiles
  where organization_id = p_org and role = 'owner' and is_active;
  insert into public.guardian_satisfaction_surveys (id, organization_id, rating, topic, comment)
    values (p_id, p_org, p_rating, p_topic, nullif(btrim(p_comment), ''))
    on conflict (id) do nothing;
  if not found then
    return exists (
      select 1 from public.guardian_satisfaction_surveys
      where id = p_id and organization_id = p_org and rating = p_rating
        and topic = p_topic and comment is not distinct from nullif(btrim(p_comment), '')
    );
  end if;
  insert into public.system_notifications (
    organization_id, recipient_profile_id, recipient_user_id, notification_type, event_key,
    title, body, message, category, target_path
  ) values (
    p_org, chair, chair, 'guardian_satisfaction_survey', 'guardian_satisfaction_survey',
    'Yeni memnuniyet anketi', 'Yönetim Kurulu Başkanlığına yeni bir anket yanıtı iletildi.',
    'Yönetim Kurulu Başkanlığına yeni bir anket yanıtı iletildi.', 'system', '/memnuniyet-anketleri'
  );
  return true;
end;
$$;
revoke execute on function public.submit_guardian_satisfaction_survey(uuid, uuid, smallint, text, text) from public, anon, authenticated;
grant execute on function public.submit_guardian_satisfaction_survey(uuid, uuid, smallint, text, text) to service_role;

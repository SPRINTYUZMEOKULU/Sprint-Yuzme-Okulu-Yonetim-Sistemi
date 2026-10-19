begin;
alter table public.guardian_requests add column if not exists source_note_id uuid references public.student_notes(id) on delete set null;
create table if not exists public.guardian_request_replies (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.guardian_requests(id) on delete cascade,
 organization_id uuid not null references public.organizations(id),
 author_id uuid references public.profiles(id) on delete set null,
 author_name text not null,
 sender_role text not null check(sender_role in ('guardian','staff')),
 body text not null check(length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index if not exists guardian_request_replies_thread_idx on public.guardian_request_replies(request_id,created_at);
alter table public.guardian_request_replies enable row level security;
-- Guardian writes go through the authorized server RPC; staff may also record trigger history.
revoke all on public.guardian_request_replies from anon,authenticated;
grant all on public.guardian_request_replies to service_role;
grant insert,select on public.guardian_request_replies to authenticated;
drop policy if exists staff_read_request_replies on public.guardian_request_replies;
create policy staff_read_request_replies on public.guardian_request_replies for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.organization_id=guardian_request_replies.organization_id and p.is_active and p.role::text in ('owner','admin','branch_manager','registration_staff','accounting','coach')));
drop policy if exists staff_record_request_reply on public.guardian_request_replies;
create policy staff_record_request_reply on public.guardian_request_replies for insert to authenticated with check(author_id=(select auth.uid()) and sender_role='staff' and exists(select 1 from public.guardian_requests r join public.profiles p on p.id=(select auth.uid()) where r.id=request_id and r.organization_id=guardian_request_replies.organization_id and p.organization_id=r.organization_id and p.is_active and p.role::text in ('owner','admin','branch_manager','registration_staff','accounting','coach')));

create or replace function public.record_guardian_request_response() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if nullif(trim(new.guardian_response),'') is not null and new.guardian_response is distinct from old.guardian_response then
  insert into public.guardian_request_replies(request_id,organization_id,author_id,author_name,sender_role,body,created_at)
  values(new.id,new.organization_id,new.responded_by,coalesce((select full_name from public.profiles where id=new.responded_by),'Yönetim'),'staff',new.guardian_response,coalesce(new.responded_at,now()));
 end if;
 return new;
end $$;
revoke execute on function public.record_guardian_request_response() from public,anon,authenticated;
drop trigger if exists record_guardian_request_response on public.guardian_requests;
create trigger record_guardian_request_response after update on public.guardian_requests for each row execute function public.record_guardian_request_response();

-- Preserve existing answers; never generate a notification while importing history.
insert into public.guardian_request_replies(request_id,organization_id,author_id,author_name,sender_role,body,created_at)
select r.id,r.organization_id,r.responded_by,coalesce(p.full_name,'Yönetim'),'staff',r.guardian_response,coalesce(r.responded_at,r.updated_at)
from public.guardian_requests r left join public.profiles p on p.id=r.responded_by
where nullif(trim(r.guardian_response),'') is not null and not exists(select 1 from public.guardian_request_replies x where x.request_id=r.id);
update public.guardian_requests set status='answered' where status in ('new','reviewing') and nullif(trim(guardian_response),'') is not null;

-- Atomic guardian reply + reopen: callable only by the authorized server action.
create or replace function public.reply_guardian_request(p_request uuid,p_org uuid,p_author uuid,p_body text) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.guardian_requests; reply_id uuid;
begin
 select * into r from public.guardian_requests where id=p_request and organization_id=p_org and guardian_id=p_author for update;
 if not found or r.status='archived' then raise exception 'Talep bulunamadı veya arşivlendi.'; end if;
 if not exists(select 1 from public.guardians g join public.guardian_students gs on gs.guardian_id=g.id join public.students s on s.id=gs.student_id join public.profiles p on p.id=g.auth_user_id
 where g.auth_user_id=p_author and g.organization_id=p_org and g.is_active and g.login_enabled and p.is_active and gs.portal_access and gs.student_id=r.student_id and s.organization_id=p_org and not s.is_deleted and s.status<>'passive') then raise exception 'Kursiyer erişimi bulunamadı.'; end if;
 insert into public.guardian_request_replies(request_id,organization_id,author_id,author_name,sender_role,body)
 values(r.id,p_org,p_author,coalesce((select full_name from public.profiles where id=p_author),'Veli'),'guardian',trim(p_body)) returning id into reply_id;
 update public.guardian_requests set status='reviewing',resolved_at=null,updated_at=now() where id=r.id;
 return reply_id;
end $$;
revoke execute on function public.reply_guardian_request(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reply_guardian_request(uuid,uuid,uuid,text) to service_role;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='system_notifications') then alter publication supabase_realtime add table public.system_notifications; end if;
end $$;
commit;

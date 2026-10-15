create or replace function public.save_organization_settings(p_organization_id uuid,p_section text,p_values jsonb,p_revision integer,p_actor uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare old_config jsonb; next_revision integer;
begin
 if not exists(select 1 from public.profiles where id=p_actor and organization_id=p_organization_id and is_active and (role::text in ('owner','admin') or exists(select 1 from public.staff where auth_user_id=p_actor and is_active and login_enabled and is_super_user))) then raise exception 'Yetkisiz ayar değişikliği'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_section,0));
 select config into old_config from public.organization_settings where organization_id=p_organization_id and section=p_section;
 insert into public.organization_settings(organization_id,section,config,revision,updated_by)
 select p_organization_id,p_section,p_values,1,p_actor where p_revision=0
 on conflict(organization_id,section) do nothing;
 if not found then
  update public.organization_settings set config=p_values,revision=revision+1,updated_by=p_actor,updated_at=now()
  where organization_id=p_organization_id and section=p_section and revision=p_revision and p_revision>0;
  if not found then raise exception 'Ayarlar başka bir oturumda değiştirildi. Sayfayı yenileyin.'; end if;
 end if;
 select revision into next_revision from public.organization_settings where organization_id=p_organization_id and section=p_section;
 insert into public.organization_settings_history(organization_id,section,old_values,new_values,revision,changed_by) values(p_organization_id,p_section,old_config,p_values,next_revision,p_actor);
 return next_revision;
end $$;

create or replace function public.save_settings_message_template(p_organization_id uuid,p_key text,p_title text,p_body text,p_version integer,p_actor uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare old_config jsonb; next_version integer;
begin
 if not exists(select 1 from public.profiles where id=p_actor and organization_id=p_organization_id and is_active and (role::text in ('owner','admin') or exists(select 1 from public.staff where auth_user_id=p_actor and is_active and login_enabled and is_super_user))) then raise exception 'Yetkisiz ayar değişikliği'; end if;
 select jsonb_build_object('title',title,'body',body) into old_config from public.message_templates where organization_id=p_organization_id and template_key=p_key for update;
 update public.message_templates set title=p_title,body=p_body,version=version+1,updated_at=now() where organization_id=p_organization_id and template_key=p_key and version=p_version returning version into next_version;
 if not found then raise exception 'Şablon başka bir oturumda değiştirildi. Sayfayı yenileyin.'; end if;
 insert into public.organization_settings_history(organization_id,section,old_values,new_values,revision,changed_by) values(p_organization_id,'mesaj/'||p_key,old_config,jsonb_build_object('title',p_title,'body',p_body),next_version,p_actor);
 return next_version;
end $$;

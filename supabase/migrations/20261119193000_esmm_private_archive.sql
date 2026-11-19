-- Private provider XML/PDF archive. No public or authenticated object policies.
-- The existing server-side service role is the only intended writer/reader.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('sprint-esmm-private','sprint-esmm-private',false,3145728,array['application/pdf','application/xml','text/xml']::text[])
on conflict (id) do nothing;
do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id='sprint-esmm-private' and public=false
      and file_size_limit is not null and file_size_limit<=3145728
      and 'application/pdf'=any(allowed_mime_types)
      and 'application/xml'=any(allowed_mime_types)
  ) then
    raise exception 'e-SMM private archive bucket security must be checked';
  end if;
end $$;
-- Never add an anon/authenticated storage.objects policy for this bucket.

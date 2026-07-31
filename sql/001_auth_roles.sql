-- SprintOS v1.1: Veli rolü ve ilk kullanıcı yetkilendirme hazırlığı

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'guardian'
  ) then
    alter type public.user_role add value 'guardian';
  end if;
end $$;

-- İlk kullanıcı Supabase Authentication > Users ekranından oluşturulduktan sonra:
-- update public.profiles
-- set organization_id = (select id from public.organizations where name = 'Sprint Yüzme Okulu' limit 1),
--     role = 'owner',
--     full_name = 'Sprint Yönetici'
-- where email = 'SIZIN_EPOSTANIZ';

-- SprintOS · Pasif kursiyer / portal erişim senkronizasyonu
-- Amaç:
-- 1) Kursiyer pasife alındığında o kursiyere ait portal erişimini kapatmak.
-- 2) Kursiyer tekrar aktif olduğunda aynı portal bağlantısını yeniden açmak.
-- 3) Aynı veliye birden fazla kursiyer bağlıysa, diğer aktif kursiyerlerin erişimini bozmamak.
-- 4) Hesabı veya geçmiş bağlantıyı silmemek; yalnızca erişim durumunu yönetmek.

begin;

create or replace function public.sync_student_portal_access_from_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian_id uuid;
  v_auth_user_id uuid;
  v_has_active_access boolean;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- İlgili kursiyerin portal bağlantısı öğrenci durumunu takip eder.
  update public.guardian_students
     set portal_access = (new.status = 'active')
   where student_id = new.id;

  -- Bu kursiyere bağlı her portal hesabını ayrı ayrı değerlendir.
  for v_guardian_id in
    select distinct gs.guardian_id
      from public.guardian_students gs
     where gs.student_id = new.id
       and gs.guardian_id is not null
  loop
    select exists (
      select 1
        from public.guardian_students gs2
        join public.students s2 on s2.id = gs2.student_id
       where gs2.guardian_id = v_guardian_id
         and coalesce(gs2.portal_access, false) = true
         and s2.status = 'active'
         and coalesce(s2.is_deleted, false) = false
    ) into v_has_active_access;

    select g.auth_user_id
      into v_auth_user_id
      from public.guardians g
     where g.id = v_guardian_id
     limit 1;

    -- Portal kişi kaydı korunur, sadece giriş yetkisi aktif/pasif yapılır.
    update public.guardians
       set login_enabled = v_has_active_access,
           is_active = v_has_active_access,
           updated_at = now()
     where id = v_guardian_id;

    -- Bir veliye birden çok çocuk bağlıysa en az bir aktif erişim varsa hesap açık kalır.
    if v_auth_user_id is not null then
      update public.profiles
         set is_active = v_has_active_access,
             updated_at = now()
       where id = v_auth_user_id
         and role = 'guardian';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_sync_student_portal_access_from_status on public.students;
create trigger trg_sync_student_portal_access_from_status
after update of status on public.students
for each row
when (old.status is distinct from new.status)
execute function public.sync_student_portal_access_from_status();

-- Mevcut pasif kursiyerlerde geçmiş bağlantıyı silmeden erişimi kapat.
update public.guardian_students gs
   set portal_access = false
  from public.students s
 where s.id = gs.student_id
   and s.status = 'passive'
   and coalesce(gs.portal_access, false) = true;

-- Mevcut portal hesaplarının giriş durumunu, bağlı aktif kursiyer durumuna göre düzelt.
with guardian_state as (
  select
    g.id as guardian_id,
    g.auth_user_id,
    exists (
      select 1
        from public.guardian_students gs
        join public.students s on s.id = gs.student_id
       where gs.guardian_id = g.id
         and coalesce(gs.portal_access, false) = true
         and s.status = 'active'
         and coalesce(s.is_deleted, false) = false
    ) as has_active_access
  from public.guardians g
)
update public.guardians g
   set login_enabled = st.has_active_access,
       is_active = st.has_active_access,
       updated_at = now()
  from guardian_state st
 where st.guardian_id = g.id;

with guardian_state as (
  select
    g.auth_user_id,
    exists (
      select 1
        from public.guardian_students gs
        join public.students s on s.id = gs.student_id
       where gs.guardian_id = g.id
         and coalesce(gs.portal_access, false) = true
         and s.status = 'active'
         and coalesce(s.is_deleted, false) = false
    ) as has_active_access
  from public.guardians g
  where g.auth_user_id is not null
)
update public.profiles p
   set is_active = st.has_active_access,
       updated_at = now()
  from guardian_state st
 where p.id = st.auth_user_id
   and p.role = 'guardian';

commit;

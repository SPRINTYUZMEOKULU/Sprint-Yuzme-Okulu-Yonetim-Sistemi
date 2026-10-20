-- Narrow existing notification access for guardian accounts without changing staff routing.
begin;
drop policy if exists guardian_notification_select_boundary on public.system_notifications;
create policy guardian_notification_select_boundary on public.system_notifications as restrictive for select to authenticated
using(private.current_user_role()<>'guardian' or (recipient_user_id=(select auth.uid()) and target_path ~ '^/veli-(paneli|devam|gelisim|odemeler|mesajlar|duyurular|belgeler|talepleri)([?#]|$)'));
drop policy if exists guardian_notification_update_boundary on public.system_notifications;
create policy guardian_notification_update_boundary on public.system_notifications as restrictive for update to authenticated
using(private.current_user_role()<>'guardian' or (recipient_user_id=(select auth.uid()) and target_path ~ '^/veli-(paneli|devam|gelisim|odemeler|mesajlar|duyurular|belgeler|talepleri)([?#]|$)'))
with check(private.current_user_role()<>'guardian' or (recipient_user_id=(select auth.uid()) and target_path ~ '^/veli-(paneli|devam|gelisim|odemeler|mesajlar|duyurular|belgeler|talepleri)([?#]|$)'));
commit;

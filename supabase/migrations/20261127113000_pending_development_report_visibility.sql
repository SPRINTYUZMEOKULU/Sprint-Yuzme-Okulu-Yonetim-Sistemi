alter table public.student_notes
  add constraint pending_development_report_is_private
  check (target is distinct from 'Gelişim raporu · Onay bekliyor' or is_guardian_visible is false);

create policy coach_pending_development_insert on public.student_notes
as restrictive for insert to authenticated
with check (private.current_user_role() <> 'coach' or target is distinct from 'Gelişim raporu · Onay bekliyor');

create policy coach_pending_development_update on public.student_notes
as restrictive for update to authenticated
using (private.current_user_role() <> 'coach' or target is distinct from 'Gelişim raporu · Onay bekliyor')
with check (private.current_user_role() <> 'coach' or target is distinct from 'Gelişim raporu · Onay bekliyor');

create policy coach_pending_development_delete on public.student_notes
as restrictive for delete to authenticated
using (private.current_user_role() <> 'coach' or target is distinct from 'Gelişim raporu · Onay bekliyor');

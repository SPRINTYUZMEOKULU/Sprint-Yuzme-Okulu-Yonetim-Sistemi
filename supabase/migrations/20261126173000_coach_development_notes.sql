-- Published development reports from coach accounts must use the scoped server workflow.
create policy coach_development_note_insert on public.student_notes
as restrictive for insert to authenticated
with check (private.current_user_role() <> 'coach' or target is distinct from 'Gelişim raporu');

create policy coach_development_note_update on public.student_notes
as restrictive for update to authenticated
using (private.current_user_role() <> 'coach' or target is distinct from 'Gelişim raporu')
with check (private.current_user_role() <> 'coach' or target is distinct from 'Gelişim raporu');

create policy coach_development_note_delete on public.student_notes
as restrictive for delete to authenticated
using (private.current_user_role() <> 'coach' or target is distinct from 'Gelişim raporu');

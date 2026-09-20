-- SprintOS: Öğrenci notlarında "Yönetici Notu" türünü destekle.
-- Mevcut türler korunur; yalnızca management eklenir.

alter table public.student_notes
  drop constraint if exists student_notes_note_type_check;

alter table public.student_notes
  add constraint student_notes_note_type_check
  check (note_type in ('general','management','coach','health','finance','crm'));

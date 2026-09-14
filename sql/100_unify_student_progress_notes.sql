-- SprintOS — Dijital Kursiyer Dosyası / Veli Portalı ortak gelişim notları
begin;

alter table public.student_notes
  add column if not exists target text;

-- Eski kurulumlarda progress_notes tablosu varsa kayıtları ana kaynak olan
-- student_notes tablosuna taşır. Tablo yoksa migration güvenle devam eder.
do $$
begin
  if to_regclass('public.progress_notes') is not null then
    execute $sql$
      insert into public.student_notes (
        organization_id,
        student_id,
        author_id,
        note_type,
        body,
        target,
        is_guardian_visible,
        created_at
      )
      select
        s.organization_id,
        p.student_id,
        p.coach_id,
        'coach',
        p.note,
        p.target,
        coalesce(p.visible_to_guardian, false),
        p.created_at
      from public.progress_notes p
      join public.students s on s.id = p.student_id
      where not exists (
        select 1
        from public.student_notes n
        where n.student_id = p.student_id
          and n.body = p.note
          and n.created_at = p.created_at
      )
    $sql$;
  end if;
end $$;

create index if not exists student_notes_guardian_progress_idx
  on public.student_notes(student_id, is_guardian_visible, created_at desc);

commit;

-- SprintOS v4.3 — Dijital Kursiyer Dosyası ve CRM zaman çizelgesi
begin;
create extension if not exists pgcrypto;

alter table public.students
  add column if not exists photo_url text,
  add column if not exists national_id text,
  add column if not exists school_name text,
  add column if not exists address text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists allergy_note text,
  add column if not exists chronic_condition_note text,
  add column if not exists medication_note text,
  add column if not exists emergency_medical_note text;

create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  note_type text not null default 'general' check (note_type in ('general','coach','health','finance','crm')),
  body text not null,
  is_guardian_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.student_timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  event_date timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists student_notes_student_date_idx on public.student_notes(student_id, created_at desc);
create index if not exists student_timeline_student_date_idx on public.student_timeline_events(student_id, event_date desc);

alter table public.student_notes enable row level security;
alter table public.student_timeline_events enable row level security;

drop policy if exists student_notes_staff_all on public.student_notes;
create policy student_notes_staff_all on public.student_notes for all to authenticated
using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting','coach'))
with check (organization_id = public.current_user_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting','coach'));

drop policy if exists student_notes_guardian_select on public.student_notes;
create policy student_notes_guardian_select on public.student_notes for select to authenticated
using (is_guardian_visible = true and exists (select 1 from public.guardian_students gs where gs.guardian_id = auth.uid() and gs.student_id = student_notes.student_id));

drop policy if exists student_timeline_staff_all on public.student_timeline_events;
create policy student_timeline_staff_all on public.student_timeline_events for all to authenticated
using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting','coach'))
with check (organization_id = public.current_user_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting','coach'));

drop policy if exists student_timeline_guardian_select on public.student_timeline_events;
create policy student_timeline_guardian_select on public.student_timeline_events for select to authenticated
using (exists (select 1 from public.guardian_students gs where gs.guardian_id = auth.uid() and gs.student_id = student_timeline_events.student_id));

commit;

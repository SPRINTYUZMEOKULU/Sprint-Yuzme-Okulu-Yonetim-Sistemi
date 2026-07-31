create table if not exists public.guardian_students (
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text default 'Veli',
  primary key (guardian_id, student_id)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_date date not null,
  status text not null check (status in ('present','absent','excused')),
  coach_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.progress_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  coach_id uuid references public.profiles(id),
  note text not null,
  target text,
  visible_to_guardian boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all',
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.guardian_students enable row level security;
alter table public.attendance_records enable row level security;
alter table public.progress_notes enable row level security;
alter table public.announcements enable row level security;

create policy "guardians read own links" on public.guardian_students for select using (guardian_id = auth.uid());
create policy "guardians read linked attendance" on public.attendance_records for select using (exists (select 1 from public.guardian_students gs where gs.student_id = attendance_records.student_id and gs.guardian_id = auth.uid()));
create policy "guardians read visible progress" on public.progress_notes for select using (visible_to_guardian and exists (select 1 from public.guardian_students gs where gs.student_id = progress_notes.student_id and gs.guardian_id = auth.uid()));
create policy "authenticated read published announcements" on public.announcements for select to authenticated using (is_published = true);

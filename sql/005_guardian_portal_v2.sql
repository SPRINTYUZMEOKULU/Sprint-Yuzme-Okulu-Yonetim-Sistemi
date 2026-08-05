-- SprintOS v3.5 — Gelişmiş Veli Paneli
begin;

create table if not exists public.guardian_students (
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text default 'Veli',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
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
  coach_id uuid references public.profiles(id) on delete set null,
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
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.guardian_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  title text not null,
  body text not null,
  message_type text not null default 'information',
  channel text not null default 'panel',
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.guardian_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  summary text,
  body text,
  document_type text not null default 'policy',
  version integer not null default 1,
  file_url text,
  requires_consent boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  document_id uuid not null references public.guardian_documents(id) on delete cascade,
  document_version integer not null,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  unique (guardian_id, student_id, document_id, document_version)
);

alter table public.guardian_students enable row level security;
alter table public.attendance_records enable row level security;
alter table public.progress_notes enable row level security;
alter table public.announcements enable row level security;
alter table public.guardian_messages enable row level security;
alter table public.guardian_documents enable row level security;
alter table public.guardian_consents enable row level security;

do $$ begin
  drop policy if exists "guardians read own links" on public.guardian_students;
  create policy "guardians read own links" on public.guardian_students for select to authenticated using (guardian_id = auth.uid());

  drop policy if exists "management manages guardian links" on public.guardian_students;
  create policy "management manages guardian links" on public.guardian_students for all to authenticated
  using (public.current_user_role() in ('owner','admin','branch_manager','registration_staff'))
  with check (public.current_user_role() in ('owner','admin','branch_manager','registration_staff'));

  drop policy if exists "guardians read linked attendance" on public.attendance_records;
  create policy "guardians read linked attendance" on public.attendance_records for select to authenticated using (
    exists(select 1 from public.guardian_students gs where gs.student_id=attendance_records.student_id and gs.guardian_id=auth.uid())
  );

  drop policy if exists "staff manages attendance records" on public.attendance_records;
  create policy "staff manages attendance records" on public.attendance_records for all to authenticated
  using (public.current_user_role() in ('owner','admin','branch_manager','coach'))
  with check (public.current_user_role() in ('owner','admin','branch_manager','coach'));

  drop policy if exists "guardians read visible progress" on public.progress_notes;
  create policy "guardians read visible progress" on public.progress_notes for select to authenticated using (
    visible_to_guardian and exists(select 1 from public.guardian_students gs where gs.student_id=progress_notes.student_id and gs.guardian_id=auth.uid())
  );

  drop policy if exists "staff manages progress notes" on public.progress_notes;
  create policy "staff manages progress notes" on public.progress_notes for all to authenticated
  using (public.current_user_role() in ('owner','admin','branch_manager','coach'))
  with check (public.current_user_role() in ('owner','admin','branch_manager','coach'));

  drop policy if exists "authenticated read published announcements" on public.announcements;
  create policy "authenticated read published announcements" on public.announcements for select to authenticated using (is_published=true);

  drop policy if exists "management manages announcements" on public.announcements;
  create policy "management manages announcements" on public.announcements for all to authenticated
  using (public.current_user_role() in ('owner','admin','branch_manager'))
  with check (public.current_user_role() in ('owner','admin','branch_manager'));

  drop policy if exists "guardians read own messages" on public.guardian_messages;
  create policy "guardians read own messages" on public.guardian_messages for select to authenticated using (guardian_id=auth.uid());

  drop policy if exists "staff manages guardian messages" on public.guardian_messages;
  create policy "staff manages guardian messages" on public.guardian_messages for all to authenticated
  using (organization_id=public.current_organization_id() and public.current_user_role() in ('owner','admin','branch_manager','registration_staff','accounting','coach'))
  with check (organization_id=public.current_organization_id());

  drop policy if exists "guardians read active documents" on public.guardian_documents;
  create policy "guardians read active documents" on public.guardian_documents for select to authenticated using (is_active=true);

  drop policy if exists "management manages guardian documents" on public.guardian_documents;
  create policy "management manages guardian documents" on public.guardian_documents for all to authenticated
  using (organization_id=public.current_organization_id() and public.current_user_role() in ('owner','admin'))
  with check (organization_id=public.current_organization_id());

  drop policy if exists "guardians read own consents" on public.guardian_consents;
  create policy "guardians read own consents" on public.guardian_consents for select to authenticated using (guardian_id=auth.uid());

  drop policy if exists "guardians create own consents" on public.guardian_consents;
  create policy "guardians create own consents" on public.guardian_consents for insert to authenticated
  with check (guardian_id=auth.uid());
end $$;

insert into public.guardian_documents(organization_id,title,summary,body,document_type,version,requires_consent,sort_order)
select o.id,x.title,x.summary,x.body,x.document_type,1,x.requires_consent,x.sort_order
from public.organizations o
cross join (values
 ('Kayıt ve Kurs Kuralları','Kurs katılımı, grup düzeni ve kurum kuralları.','Sprint Yüzme Okulu gerekli gördüğü durumlarda grup, eğitmen, saat ve şube değişikliği yapma hakkını saklı tutar.','course_rules',true,10),
 ('Ücret İadesi Politikası','Kayıt ve ücret iadesi koşulları.','Kurs başladıktan sonra ücret iadesi yapılmamaktadır. Yasal zorunluluklar ve yönetim tarafından onaylanan istisnalar saklıdır.','refund_policy',true,20),
 ('Telafi Dersi Politikası','Kaçırılan dersler ve telafi uygulamaları.','Kursiyerin katılmadığı dersler için standart olarak telafi uygulanmaz. Yönetim tarafından ilan edilen bonus veya telafi dersleri istisnadır.','makeup_policy',true,30),
 ('KVKK Aydınlatma Metni','Kişisel verilerin işlenmesine ilişkin bilgilendirme.','Kişisel veriler kayıt, eğitim, iletişim ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenir.','kvkk',true,40),
 ('Havuz ve Malzeme Kuralları','Derse gelirken gerekli malzemeler ve havuz kuralları.','Mayo, havlu, terlik ve havuz gözlüğü getirilmelidir. Sprint bonesi kurum politikalarına göre sağlanabilir.','pool_rules',false,50)
) x(title,summary,body,document_type,requires_consent,sort_order)
where o.name='Sprint Yüzme Okulu'
and not exists(select 1 from public.guardian_documents gd where gd.organization_id=o.id and gd.document_type=x.document_type);

commit;

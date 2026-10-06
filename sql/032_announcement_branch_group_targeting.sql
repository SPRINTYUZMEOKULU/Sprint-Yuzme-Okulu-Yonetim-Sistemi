-- SprintOS · Veli duyurularında şube / grup hedefleme
begin;

alter table public.announcements
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists group_id uuid references public.training_groups(id) on delete set null;

create index if not exists announcements_target_idx
  on public.announcements(organization_id, branch_id, group_id, is_published, published_at desc);

commit;

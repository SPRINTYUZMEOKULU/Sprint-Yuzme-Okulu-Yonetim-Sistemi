create table public.guardian_setup_links (
    code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
    account_id uuid not null references auth.users(id) on delete cascade,
    sealed_token text not null,
    expires_at timestamptz not null
);

create index guardian_setup_links_account_expiry_idx
    on public.guardian_setup_links (account_id, expires_at);

alter table public.guardian_setup_links enable row level security;
revoke all on public.guardian_setup_links from public, anon, authenticated;
grant select, insert, delete on public.guardian_setup_links to service_role;

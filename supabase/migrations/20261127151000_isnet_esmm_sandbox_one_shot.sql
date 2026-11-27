-- Dedicated sandbox-only audit table. No real student, payment or live issuer is referenced.
create table if not exists public.isnet_esmm_sandbox_runs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 created_by uuid not null references public.profiles(id) on delete restrict,
 test_company_code text not null check (test_company_code in ('4810173324','1234567805')),
 requested_document_number text not null check (requested_document_number ~ '^[A-Z]{3}20[0-9]{11}$'),
 ettn uuid not null default gen_random_uuid(),
 external_document_code text generated always as ('SPRINT-TEST-' || ettn::text) stored,
 state text not null default 'reserved' check(state in ('reserved','send_started','send_uncertain','send_confirmed','provider_rejected','search_pending','provider_report_accepted')),
 provider_document_number text,
 provider_report_status text,
 created_at timestamptz not null default now(),
 send_started_at timestamptz,
 searched_at timestamptz,
 updated_at timestamptz not null default now(),
 constraint isnet_sandbox_unique_ettn unique(ettn),
 constraint isnet_sandbox_unique_external unique(external_document_code),
 constraint isnet_sandbox_unique_document unique(test_company_code,requested_document_number)
);
create index if not exists isnet_sandbox_recent on public.isnet_esmm_sandbox_runs(organization_id,created_at desc);
alter table public.isnet_esmm_sandbox_runs enable row level security;
revoke all on public.isnet_esmm_sandbox_runs from public,anon,authenticated;
grant select,insert,update on public.isnet_esmm_sandbox_runs to service_role;

create or replace function public.reserve_isnet_esmm_sandbox_test(
 p_org uuid,p_actor uuid,p_test_company text,p_document_no text
) returns table(ok boolean,result_code text,run_id uuid,run_ettn uuid,run_external text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare row public.isnet_esmm_sandbox_runs%rowtype;
begin
 if not exists(select 1 from public.profiles where id=p_actor and organization_id=p_org and role in('owner','admin') and is_active=true)
 then return query select false,'unauthorized'::text,null::uuid,null::uuid,null::text; return; end if;
 if p_test_company not in ('4810173324','1234567805') or p_document_no is null or p_document_no !~ '^[A-Z]{3}20[0-9]{11}$'
 then return query select false,'invalid_test_parameters'::text,null::uuid,null::uuid,null::text;return;end if;
 -- A bounded daily quota prevents repeated sandbox dispatch from accidental double clicks.
 perform pg_advisory_xact_lock(hashtext(p_org::text||'sprint_esmm_sandbox'));
 if (select count(*) from public.isnet_esmm_sandbox_runs where organization_id=p_org and created_at >= now()-interval '24 hours') >= 3
 then return query select false,'daily_limit'::text,null::uuid,null::uuid,null::text;return;end if;
 if exists (select 1 from public.isnet_esmm_sandbox_runs where test_company_code=p_test_company and requested_document_number=p_document_no)
 then return query select false,'document_already_tested'::text,null::uuid,null::uuid,null::text;return;end if;
 insert into public.isnet_esmm_sandbox_runs(organization_id,created_by,test_company_code,requested_document_number)
 values(p_org,p_actor,p_test_company,p_document_no) returning * into row;
 return query select true,'reserved'::text,row.id,row.ettn,row.external_document_code;
exception when unique_violation then
 return query select false,'document_already_tested'::text,null::uuid,null::uuid,null::text;
end $$;
revoke all on function public.reserve_isnet_esmm_sandbox_test(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_isnet_esmm_sandbox_test(uuid,uuid,text,text) to service_role;

create or replace function public.isnet_esmm_sandbox_validate()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' then
  if old.organization_id is distinct from new.organization_id or old.created_by is distinct from new.created_by
   or old.test_company_code is distinct from new.test_company_code
   or old.requested_document_number is distinct from new.requested_document_number or old.ettn is distinct from new.ettn
  then raise exception 'Sandbox immutable document identity'; end if;
  if old.state='provider_report_accepted' and new.state<>'provider_report_accepted' then raise exception 'Accepted sandbox state is final'; end if;
 end if;
 new.updated_at=now();
 return new;
end $$;
drop trigger if exists trg_isnet_sandbox_validate on public.isnet_esmm_sandbox_runs;
create trigger trg_isnet_sandbox_validate before update on public.isnet_esmm_sandbox_runs
for each row execute function public.isnet_esmm_sandbox_validate();
comment on table public.isnet_esmm_sandbox_runs is 'TEST ONLY: provider synthetic e-SMM identity, one-shot send audit. No live issuer, payment or customer data. Provider_report_accepted means report status alone; PDF/XML evidence must be independently verified.';

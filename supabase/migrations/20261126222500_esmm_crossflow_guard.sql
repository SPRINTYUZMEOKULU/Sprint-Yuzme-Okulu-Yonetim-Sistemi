-- Protect against accidental dual processing of the same payment via
-- "manual portal reference" and "automated issue preapproval".
-- Server RPCs lock payment_document_requests row before inserting.
create or replace function public.check_esmm_reference_exclusivity()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_table_name='esmm_issue_approvals' then
  if exists (select 1 from public.manual_esmm_reconciliation where request_id=new.request_id or payment_id=new.payment_id) then
   raise exception 'Manual portal e-SMM reference already exists for this payment';
  end if;
 elsif tg_table_name='manual_esmm_reconciliation' then
  if exists (select 1 from public.esmm_issue_approvals where request_id=new.request_id or payment_id=new.payment_id) then
   raise exception 'Automated issue preapproval already exists for this payment';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists esmm_approval_crossflow_guard on public.esmm_issue_approvals;
create trigger esmm_approval_crossflow_guard before insert on public.esmm_issue_approvals
for each row execute function public.check_esmm_reference_exclusivity();
drop trigger if exists esmm_manual_crossflow_guard on public.manual_esmm_reconciliation;
create trigger esmm_manual_crossflow_guard before insert on public.manual_esmm_reconciliation
for each row execute function public.check_esmm_reference_exclusivity();

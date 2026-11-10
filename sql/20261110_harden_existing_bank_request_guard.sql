-- Preserve existing bank import data. Harden only the manager-approved bank->document RPC.
-- Existing secure-document requests are never overwritten, deleted or re-issued here.
create or replace function public.link_invoice_bank_entry(
 p_organization uuid, p_entry uuid, p_student uuid, p_actor uuid,
 p_duplicate_note text default null
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
 bank_row public.invoice_bank_entries%rowtype;
 request_id uuid;
begin
 if current_user <> 'service_role' then raise exception 'Service role required'; end if;
 if not exists (
   select 1 from public.profiles p
   where p.id=p_actor and p.organization_id=p_organization and p.is_active=true
     and (p.role::text in ('owner','admin') or exists (
       select 1 from public.staff s where s.auth_user_id=p.id
       and s.is_active=true and s.login_enabled=true and s.is_super_user=true))
 ) then raise exception 'Not authorized'; end if;

 select * into bank_row from public.invoice_bank_entries
 where id=p_entry and organization_id=p_organization for update;
 if not found then raise exception 'Bank entry not found'; end if;
 if bank_row.status='excluded' then raise exception 'Excluded bank entry'; end if;
 if bank_row.document_request_id is not null then
   if bank_row.matched_student_id is distinct from p_student then
     raise exception 'Already matched to another student';
   end if;
   return bank_row.document_request_id;
 end if;
 if bank_row.status <> 'review' then raise exception 'Bank entry is not under review'; end if;
 if not exists (select 1 from public.students
   where id=p_student and organization_id=p_organization) then
   raise exception 'Student not found';
 end if;

 -- Serialize parallel bank actions for this organization/student/amount combination.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(
     p_organization::text || ':' || p_student::text || ':' || bank_row.amount::text, 0
   )
 );
 if exists (
   select 1 from public.payment_document_requests r
   where r.organization_id=p_organization and r.student_id=p_student
     and r.expected_amount=bank_row.amount
     and r.status in ('waiting_customer','waiting_payment')
     and r.document_status='not_created' and r.payment_id is null
     and r.expires_at > pg_catalog.now()
 ) then
   raise exception 'An active secure payment request exists. Link that request instead';
 end if;

 if exists (
   select 1 from public.invoice_bank_entries b
   where b.organization_id=p_organization and b.content_key=bank_row.content_key
    and b.id<>p_entry and b.status<>'excluded'
 ) and pg_catalog.length(pg_catalog.btrim(coalesce(p_duplicate_note,'')))<10 then
   raise exception 'Resolve similar bank entries first';
 end if;
 insert into public.payment_document_requests
   (organization_id, student_id, payment_method, expected_amount, status,
    document_provider, document_type, created_by)
 values (p_organization,p_student,'bank_transfer',bank_row.amount,
    'waiting_customer','nettefatura','pending_classification',p_actor)
 returning id into request_id;

 update public.invoice_bank_entries set document_request_id=request_id,
   matched_student_id=p_student,status='linked',reviewed_by=p_actor,
   reviewed_at=pg_catalog.now(),
   review_note=nullif(pg_catalog.btrim(p_duplicate_note),'')
 where id=p_entry and organization_id=p_organization
   and status='review' and document_request_id is null;
 if not found then raise exception 'Bank entry changed during review'; end if;
 return request_id;
end;
$$;
revoke all on function public.link_invoice_bank_entry(uuid,uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.link_invoice_bank_entry(uuid,uuid,uuid,uuid,text)
 to service_role;

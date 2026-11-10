-- STAGING: explicit, atomic VakıfBank -> existing secure document request association.
-- No invoice is created; no student payment row is inserted or altered.
-- Apply only after integration tests in staging; service_role only.
create or replace function public.attach_invoice_bank_to_existing_request(
  p_organization uuid,
  p_entry uuid,
  p_request uuid,
  p_actor uuid,
  p_duplicate_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  bank_row public.invoice_bank_entries%rowtype;
  doc_row public.payment_document_requests%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor and p.organization_id = p_organization and p.is_active = true
      and (p.role::text in ('owner','admin') or exists (
        select 1 from public.staff s where s.auth_user_id=p.id
          and s.is_active=true and s.login_enabled=true and s.is_super_user=true
      ))
  ) then
    raise exception 'Not authorized';
  end if;

  select * into bank_row from public.invoice_bank_entries
  where id = p_entry and organization_id = p_organization for update;
  if not found or bank_row.status <> 'review' or bank_row.document_request_id is not null then
    raise exception 'Bank entry not available for review';
  end if;

  select * into doc_row from public.payment_document_requests
  where id = p_request and organization_id = p_organization for update;
  if not found
     or doc_row.student_id is null
     or doc_row.status not in ('waiting_customer','waiting_payment')
     or doc_row.document_status <> 'not_created'
     or doc_row.payment_id is not null
     or doc_row.provider_document_id is not null
     or doc_row.document_number is not null
     or doc_row.expires_at <= now() then
    raise exception 'Document request is not available for bank association';
  end if;

  if doc_row.expected_amount is null
     or round(doc_row.expected_amount::numeric,2) <> round(bank_row.amount::numeric,2)
     or bank_row.currency <> 'TRY' then
    raise exception 'Bank amount and document request amount must match';
  end if;

  if exists (
    select 1 from public.invoice_bank_entries b
    where b.organization_id = p_organization
      and b.content_key = bank_row.content_key
      and b.id <> p_entry and b.status <> 'excluded'
  ) and length(trim(coalesce(p_duplicate_note,''))) < 10 then
    raise exception 'Similar bank movements must be reviewed';
  end if;

  -- The database unique constraint on document_request_id also prevents reuse.
  update public.invoice_bank_entries set
    document_request_id = p_request,
    matched_student_id = doc_row.student_id,
    status = 'linked',
    reviewed_by = p_actor,
    reviewed_at = now(),
    review_note = nullif(trim(p_duplicate_note),'')
  where id = p_entry and organization_id = p_organization
    and status = 'review' and document_request_id is null;
  if not found then raise exception 'Bank entry changed during review'; end if;
  return p_request;
end;
$$;

revoke all on function public.attach_invoice_bank_to_existing_request(uuid,uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.attach_invoice_bank_to_existing_request(uuid,uuid,uuid,uuid,text)
  to service_role;

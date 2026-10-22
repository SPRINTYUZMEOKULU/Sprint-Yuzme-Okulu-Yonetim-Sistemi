begin;
do $$
declare actor uuid; org uuid; student uuid; entry uuid; request_one uuid; request_two uuid; rejected boolean;
begin
  if has_table_privilege('authenticated','public.invoice_bank_entries','SELECT') or has_table_privilege('anon','public.invoice_bank_entries','SELECT') then raise exception 'Bank staging must be private'; end if;
  if has_function_privilege('authenticated','public.link_invoice_bank_entry(uuid,uuid,uuid,uuid,text)','EXECUTE') then raise exception 'RPC must be service-only'; end if;
  select id,organization_id into actor,org from public.profiles where role::text='owner' and is_active=true and organization_id is not null limit 1;
  select id into student from public.students where organization_id=org limit 1;
  if actor is null or student is null then raise exception 'No test context'; end if;
  insert into public.invoice_bank_entries(organization_id,account_iban,row_key,content_key,source_file,source_file_hash,source_sheet,source_row,occurred_at,sender_name,amount,imported_by)
  values(org,'TR140001500158007357481506',encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),repeat('f',64),'ROLLBACK_TEST',repeat('a',64),'Test',1,now(),'ROLLBACK TEST',1,actor) returning id into entry;
  rejected=false;
  begin perform public.link_invoice_bank_entry(gen_random_uuid(),entry,student,actor,null); exception when others then rejected=true; end;
  if not rejected then raise exception 'Cross-org access allowed'; end if;
  request_one=public.link_invoice_bank_entry(org,entry,student,actor,null);
  request_two=public.link_invoice_bank_entry(org,entry,student,actor,null);
  if request_one<>request_two then raise exception 'Repeated request was duplicated'; end if;
  if not exists(select 1 from public.payment_document_requests where id=request_one and organization_id=org and student_id=student and status='waiting_customer' and payment_id is null and provider_document_id is null and expected_amount=1) then raise exception 'Unexpected document request or payment'; end if;
end;
$$;
rollback;

-- Real database verification; all receipts, balances and notifications roll back.
begin;
do $$
declare debt public.student_financial_obligations%rowtype; actor uuid; result jsonb; repeated jsonb; receipts int;
begin
 select * into debt from public.student_financial_obligations where status='open' and paid_amount=0 and amount>=100 order by created_at desc limit 1;
 if debt.id is null then raise exception 'Test requires an open obligation of at least 100 TL.'; end if;
 select id into actor from public.profiles where organization_id=debt.organization_id and is_active and role::text='owner' limit 1;
 if actor is null then raise exception 'Test requires an owner in the same organization.'; end if;
 select count(*) into receipts from public.student_payments where organization_id=debt.organization_id and student_id=debt.student_id;
 result:=public.collect_student_obligation(actor,debt.id,100,'bank_transfer','rollback-verification');
 assert not (result->>'duplicate')::boolean;
 assert (select paid_amount from public.student_financial_obligations where id=debt.id)=100;
 assert (select count(*) from public.student_payments where organization_id=debt.organization_id and student_id=debt.student_id)=receipts+1;
 assert exists(select 1 from public.student_activity_logs where source_id=debt.id and activity_type='financial_obligation_payment' and new_value->>'payment_id'=result->>'payment_id');
 repeated:=public.collect_student_obligation(actor,debt.id,100,'bank_transfer','rollback-verification');
 assert (repeated->>'duplicate')::boolean;
 assert repeated->>'payment_id'=result->>'payment_id';
 assert (select count(*) from public.student_payments where organization_id=debt.organization_id and student_id=debt.student_id)=receipts+1;
 begin
  perform public.collect_student_obligation(actor,debt.id,debt.amount,'bank_transfer','too-much');
  raise exception 'Overcollection was accepted.' using errcode='XX000';
 exception when raise_exception then null;
 end;
 begin
  perform public.collect_student_obligation(null,debt.id,1,'cash',null);
  raise exception 'Missing actor was accepted.' using errcode='XX000';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;

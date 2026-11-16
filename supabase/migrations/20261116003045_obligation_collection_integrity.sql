-- One locked transaction writes the receipt, balance and linkage audit together.
create or replace function public.collect_student_obligation(p_actor uuid,p_obligation uuid,p_amount numeric,p_method text,p_request text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.profiles%rowtype; debt public.student_financial_obligations%rowtype;
 payment_id uuid; previous_payment uuid; next_paid numeric; next_status text;
begin
 select * into actor from public.profiles where id=p_actor and is_active;
 if actor.id is null or actor.role::text not in ('owner','admin','branch_manager','registration_staff','accounting') then raise exception 'Tahsilat yetkisi gerekiyor.' using errcode='42501'; end if;
 select * into debt from public.student_financial_obligations where id=p_obligation and organization_id=actor.organization_id for update;
 if debt.id is null then raise exception 'Borç kaydı bulunamadı.'; end if;
 if p_request is not null then
  if length(p_request)>100 then raise exception 'İstek kimliği geçersiz.'; end if;
  select (new_value->>'payment_id')::uuid into previous_payment from public.student_activity_logs where organization_id=actor.organization_id and student_id=debt.student_id and source_id=debt.id and activity_type='financial_obligation_payment' and new_value->>'request_id'=p_request and performed_by=p_actor limit 1;
  if previous_payment is not null then return jsonb_build_object('duplicate',true,'payment_id',previous_payment,'student_id',debt.student_id,'title',debt.title,'status',debt.status,'remaining',greatest(0,debt.amount-debt.paid_amount)); end if;
 end if;
 if debt.status in ('paid','cancelled') then raise exception 'Açık borç kaydı bulunamadı.'; end if;
 if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>debt.amount-coalesce(debt.paid_amount,0) then raise exception 'Tahsilat kalan borçtan fazla olamaz ve pozitif olmalıdır.'; end if;
 if p_method not in ('cash','card','bank_transfer','eft','other') then raise exception 'Ödeme yöntemi geçersiz.'; end if;
 next_paid:=coalesce(debt.paid_amount,0)+p_amount;next_status:=case when next_paid>=debt.amount then 'paid' else 'partially_paid' end;
 insert into public.student_payments(organization_id,student_id,enrollment_id,amount,currency,payment_method,payment_status,description,received_by,received_at,cash_handover_status,cash_handover_approved_at)
 values(actor.organization_id,debt.student_id,debt.enrollment_id,p_amount,'TRY',p_method,'received','Ek borç tahsilatı · '||debt.title,p_actor,now(),case when p_method='cash' then 'with_staff' else 'main_cash_confirmed' end,case when p_method='cash' then null else now() end) returning id into payment_id;
 update public.student_financial_obligations set paid_amount=next_paid,status=next_status,paid_by=p_actor,paid_at=case when next_status='paid' then now() else null end,updated_at=now() where id=debt.id;
 insert into public.student_activity_logs(organization_id,student_id,activity_type,title,description,source_type,source_id,new_value,performed_by,performed_at)
 values(actor.organization_id,debt.student_id,'financial_obligation_payment',case when next_status='paid' then 'Ek borç tamamen ödendi' else 'Ek borca kısmi ödeme alındı' end,debt.title||' · '||p_amount||' TL tahsil edildi.','student_financial_obligation',debt.id,jsonb_build_object('obligation_id',debt.id,'payment_id',payment_id,'paid_amount',p_amount,'status',next_status,'request_id',p_request),p_actor,now());
 return jsonb_build_object('duplicate',false,'payment_id',payment_id,'student_id',debt.student_id,'title',debt.title,'status',next_status,'remaining',greatest(0,debt.amount-next_paid));
end $$;
revoke all on function public.collect_student_obligation(uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.collect_student_obligation(uuid,uuid,numeric,text,text) to service_role;

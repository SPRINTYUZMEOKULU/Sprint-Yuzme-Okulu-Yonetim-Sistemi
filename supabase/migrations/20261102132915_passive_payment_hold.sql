begin;
alter table public.students add column if not exists registration_payment_hold jsonb;

-- Freeze the original period's price; later renewals must not hide this debt.
create or replace function public.registration_hold_remaining(p_hold jsonb, p_organization_id uuid)
returns numeric language sql stable security invoker
set search_path = pg_catalog, public, pg_temp as $$
 select case when p_hold is null then 0 else
 greatest(coalesce((p_hold->>'package_amount')::numeric,0) - coalesce((
   select sum(p.amount) from public.student_payments p
   where p.organization_id=p_organization_id and p.enrollment_id=(p_hold->>'enrollment_id')::uuid
     and p.cancelled_at is null and coalesce(p.payment_status,'received')<>'cancelled'
 ),0),0) + coalesce((
   select sum(greatest(o.amount-coalesce(o.paid_amount,0),0))
   from public.student_financial_obligations o
   where o.organization_id=p_organization_id and o.student_id=(p_hold->>'student_id')::uuid
     and o.status not in ('paid','cancelled')
 ),0) end;
$$;

create or replace function public.student_registration_payment_due(p_student_id uuid)
returns numeric language sql stable security invoker
set search_path = pg_catalog, public, pg_temp as $$
 select public.registration_hold_remaining(s.registration_payment_hold,s.organization_id)
 from public.students s where s.id=p_student_id;
$$;

create or replace function public.guard_student_registration_payment()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp as $$
declare v_summary record; v_due numeric;
begin
 if tg_op='UPDATE' then
   -- A status or profile edit cannot silently erase a payment restriction.
   new.registration_payment_hold:=old.registration_payment_hold;
 else
   -- Re-applications reuse the restriction for a reliably matched identity.
   select s.registration_payment_hold into new.registration_payment_hold
   from public.students s
   where s.organization_id=new.organization_id and not coalesce(s.is_deleted,false)
     and s.registration_payment_hold is not null
     and ((nullif(btrim(new.national_id),'') is not null and s.national_id=new.national_id)
       or (new.birth_date is not null and s.birth_date=new.birth_date
         and lower(btrim(s.first_name))=lower(btrim(new.first_name))
         and lower(btrim(s.last_name))=lower(btrim(new.last_name))))
     and public.registration_hold_remaining(s.registration_payment_hold,s.organization_id)>0
   order by s.created_at desc limit 1;
 end if;

 if new.status='passive' and new.registration_payment_hold is null then
   select * into v_summary from public.student_payment_summary where student_id=new.id;
   if found and v_summary.outstanding_balance>0 then
     new.registration_payment_hold:=jsonb_build_object('student_id',new.id,
       'enrollment_id',v_summary.active_enrollment_id,'package_amount',v_summary.total_amount,
       'captured_at',now(),'reason','Önceki kayıt döneminden kalan ödeme tamamlanmalıdır.');
   end if;
 end if;
 v_due:=public.registration_hold_remaining(new.registration_payment_hold,new.organization_id);
 if new.status='active' and coalesce(v_due,0)>0 then
   raise exception 'Önceki dönemden % TL borç bulunmaktadır. Ödeme tamamlanmadan aktife alma veya yeni kayıt yapılamaz.',v_due using errcode='P0001';
 end if;
 -- A settled restriction is cleared only during an explicit status change.
 if new.registration_payment_hold is not null and coalesce(v_due,0)<=0 then
   new.registration_payment_hold:=null;
 end if;
 return new;
end $$;
drop trigger if exists students_registration_payment_guard on public.students;
create trigger students_registration_payment_guard before insert or update on public.students
for each row execute function public.guard_student_registration_payment();

create or replace function public.guard_enrollment_registration_payment()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp as $$
declare v_due numeric;
begin
 -- Serialize with status changes, and check before an RPC can retire the old period.
 perform 1 from public.students where id=new.student_id and organization_id=new.organization_id for update;
 v_due:=public.student_registration_payment_due(new.student_id);
 if coalesce(v_due,0)>0 then
   raise exception 'Önceki dönemden % TL borç bulunmaktadır. Ödeme tamamlanmadan yeni kayıt veya kayıt yenileme yapılamaz.',v_due using errcode='P0001';
 end if;
 return new;
end $$;
drop trigger if exists enrollments_registration_payment_guard on public.student_enrollments;
create trigger enrollments_registration_payment_guard before insert or update of status on public.student_enrollments
for each row when (new.status in ('active','scheduled')) execute function public.guard_enrollment_registration_payment();

-- Existing passive students remain passive when their old enrollment is edited.
create or replace function public.sync_student_active_status_from_enrollment()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if new.status='active' then
   update public.students set status='active',updated_at=now()
   where id=new.student_id and organization_id=new.organization_id
     and status is distinct from 'active' and status is distinct from 'passive';
 end if;
 return new;
end $$;
commit;

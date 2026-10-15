import { createClient } from "@/lib/supabase/server";
import { updateApprovalRuleField } from "./onay-merkezi/actions";
import PendingSubmitButton from "@/app/ogrenciler/[id]/pending-submit-button";
export default async function ApprovalEditor({organizationId,module}:{organizationId:string;module?:string}) {
  const db=await createClient();let query=db.from("approval_rules").select("id,title,module,is_active,requires_approval,dashboard_notification,push_notification").eq("organization_id",organizationId).order("module").order("title");if(module)query=query.eq("module",module);
  const{data,error}=await query;if(error)throw Error("Onay kuralları yüklenemedi.");
  return <div className="centralApproval">{!(data||[]).length?<p>Bu kapsamda tanımlı onay kuralı bulunmuyor.</p>:(data||[]).map(rule=><article key={rule.id}><h3>{rule.title}</h3><small>{rule.module}</small><div>{([['is_active','Kural aktif'],['requires_approval','Yönetici onayı'],['dashboard_notification','Panel bildirimi'],['push_notification','Telefon bildirimi']] as const).map(([key,label])=><form action={updateApprovalRuleField} key={key}><input type="hidden" name="ruleId" value={rule.id}/><input type="hidden" name="field" value={key}/><input type="hidden" name="value" value={String(!rule[key])}/><span>{label}</span><PendingSubmitButton className={rule[key]?"ruleOn":"ruleOff"} pendingText="Kaydediliyor…">{rule[key]?"Açık · Kapat":"Kapalı · Aç"}</PendingSubmitButton></form>)}</div></article>)}</div>;
}

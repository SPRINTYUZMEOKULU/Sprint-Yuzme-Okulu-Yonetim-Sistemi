import {trialIdentity} from "./trial-policy";
/** Compare the saved student and duplicate applications for the same person, not siblings sharing a phone. */
export async function assertTrialAvailable(db:any,organizationId:string,student:{id?:string;first_name:string;last_name:string;birth_date?:string|null}) {
  const {data:candidates,error} = student.birth_date ? await db.from("students").select("id,first_name,last_name")
    .eq("organization_id",organizationId).eq("birth_date",student.birth_date) : {data:[],error:null};
  if(error) throw new Error("Önceki deneme dersleri kontrol edilemedi. Tekrar deneyiniz.");
  const identity=trialIdentity(student.first_name,student.last_name);
  const ids=Array.from(new Set([...(candidates || []).filter((s:any)=>trialIdentity(s.first_name,s.last_name)===identity).map((s:any)=>s.id),...(student.id?[student.id]:[])]));
  if(!ids.length)return;
  const {data:logs,error:logError} = await db.from("student_activity_logs").select("student_id,new_value")
    .eq("organization_id",organizationId).eq("activity_type","trial_lesson").in("student_id",ids).order("performed_at",{ascending:false});
  if(logError)throw new Error("Önceki deneme dersleri kontrol edilemedi. Tekrar deneyiniz.");
  const seen=new Set<string>();
  for(const log of logs || []) {
    if(seen.has(log.student_id))continue;
    seen.add(log.student_id);
    if(["planned","attended","absent"].includes(log.new_value?.status))throw new Error("Bu kişi için daha önce onaylanmış veya kullanılmış bir deneme dersi bulunuyor. Kişi başına yalnızca bir deneme dersi alınabilir.");
  }
}

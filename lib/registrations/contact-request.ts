import {contactNeedsFollowUp,contactResolved} from "./follow-up";
export async function resolveContactRequest(db:any,profile:{id:string;organization_id:string|null},studentId:string,note="") {
  if(!profile.organization_id || !studentId)throw new Error("Kayıt bulunamadı.");
  const {data:student,error}=await db.from("students").select("id,status").eq("organization_id",profile.organization_id).eq("id",studentId).maybeSingle();
  if(error || !student || !["pre_registration","active"].includes(student.status))throw new Error("İletişim talebi için kayıt bulunamadı.");
  const {data:consent,error:consentError}=await db.from("registration_consents").select("contact_request,accepted_at").eq("organization_id",profile.organization_id).eq("student_id",studentId).order("accepted_at",{ascending:false}).limit(1).maybeSingle();
  if(consentError)throw new Error("İletişim talebi okunamadı.");
  if(!contactNeedsFollowUp(consent?.contact_request))return {ok:true as const,message:"Bekleyen iletişim talebi yok."};
  const {data:logs,error:logError}=await db.from("student_activity_logs").select("new_value").eq("organization_id",profile.organization_id).eq("student_id",studentId).eq("activity_type","contact_request_resolved").order("performed_at",{ascending:false}).limit(100);
  if(logError)throw new Error("İletişim geçmişi okunamadı.");
  if(contactResolved(consent,logs || []))return {ok:true as const,message:"İletişim talebi zaten karşılandı olarak işaretli."};
  const resolution=note.trim().slice(0,1000) || "İletişim talebi karşılandı olarak işaretlendi.";
  const {error:writeError}=await db.from("student_activity_logs").insert({organization_id:profile.organization_id,student_id:studentId,activity_type:"contact_request_resolved",title:"İletişim talebi karşılandı",description:resolution,new_value:{contact_request:consent.contact_request,consent_accepted_at:consent.accepted_at,resolution},source_type:"pre_registration_center",source_id:studentId,performed_by:profile.id,performed_at:new Date().toISOString()});
  if(writeError)throw new Error("İletişim talebi kaydedilemedi. Tekrar deneyiniz.");
  return {ok:true as const,message:"İletişim talebi karşılandı olarak işaretlendi."};
}

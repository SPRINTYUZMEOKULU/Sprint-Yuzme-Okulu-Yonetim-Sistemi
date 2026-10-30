// Keep a correction attached to its exact registration period, preserving prior-period plans.
export async function syncCorrectedPlan(db:any,input:{organizationId:string;studentId:string;enrollmentId:string;groupId:string;weekdays:number[];totalLessons:number;startDate:string;normalEnd:string|null;actorId:string;now:string}){
 const {data:plans,error:readError}=await db.from("student_attendance_plans")
  .select("id,enrollment_id,compensation_planned_end_date").eq("organization_id",input.organizationId)
  .eq("student_id",input.studentId).eq("is_active",true);
 if(readError)return {ok:false,error:"Mevcut dönem planları okunamadı."};
 const current=(plans||[]).filter((p:any)=>p.enrollment_id===input.enrollmentId);
 if(current.length>1)return {ok:false,error:"Bu dönemde birden fazla aktif plan var; plan eşleştirmesi kontrol edilmeli."};
 const bounds=[input.normalEnd,...(plans||[]).map((p:any)=>p.compensation_planned_end_date)].filter(Boolean).sort();
 const payload={organization_id:input.organizationId,student_id:input.studentId,enrollment_id:input.enrollmentId,
  group_id:input.groupId,selected_weekdays:input.weekdays,weekly_frequency:input.weekdays.length,
  package_lesson_count:input.totalLessons,start_date:input.startDate,normal_planned_end_date:input.normalEnd,
  compensation_planned_end_date:bounds[bounds.length-1]||null,is_active:true,updated_by:input.actorId,updated_at:input.now};
 const query=current[0]?db.from("student_attendance_plans").update(payload).eq("organization_id",input.organizationId).eq("student_id",input.studentId).eq("enrollment_id",input.enrollmentId).eq("id",current[0].id):db.from("student_attendance_plans").insert({...payload,created_by:input.actorId});
 const {data:saved,error:saveError}=await query.select("id").maybeSingle();
 if(saveError||!saved)return {ok:false,error:"Yeni dönem ders planı kaydedilemedi."};
 const {error:archiveError}=await db.from("student_attendance_plans").update({is_active:false,updated_by:input.actorId,updated_at:input.now})
  .eq("organization_id",input.organizationId).eq("student_id",input.studentId).eq("is_active",true).neq("id",saved.id);
 if(archiveError)return {ok:false,error:"Yeni plan kaydedildi fakat eski plan arşivlenemedi. Tekrar kontrol edin."};
 return {ok:true,planId:saved.id};
}

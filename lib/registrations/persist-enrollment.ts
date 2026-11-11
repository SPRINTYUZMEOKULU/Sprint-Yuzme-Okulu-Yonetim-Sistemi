type RegistrationPlan={organizationId:string;studentId:string;actorId:string;previousStatus:string;branchId:string;groupId:string;packageId:string|null;startDate:string;plannedEndDate:string|null;weekdays:number[];isoWeekdays:number[];totalLessons:number;paymentDueDate:string};
function sameDays(a:unknown,b:number[]) {return Array.isArray(a) && [...new Set(a.map(Number))].sort().join(",") === [...new Set(b)].sort().join(",");}
/** Resume a partially completed transfer without closing/resetting an existing term. */
export async function persistRegistrationEnrollment(db:any,input:RegistrationPlan) {
  const org=input.organizationId,id=input.studentId;
  const {data:current,error:lookupError}=await db.from("student_enrollments").select("id,branch_id,group_id,package_id,start_date,total_lessons,used_lessons,lesson_weekdays,planned_end_date,payment_due_date").eq("organization_id",org).eq("student_id",id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(lookupError)throw new Error("Aktif kayıt kontrol edilemedi. Tekrar deneyiniz.");
  if(current && (current.branch_id!==input.branchId || current.group_id!==input.groupId || (current.package_id || null)!==(input.packageId || null) || current.start_date!==input.startDate || Number(current.total_lessons)!==input.totalLessons || !sameDays(current.lesson_weekdays,input.weekdays))) {
    throw new Error("Bu kursiyerin farklı bir aktif kaydı zaten var. Yeni dönem oluşturmadan öğrenci dosyasından mevcut kaydı kontrol ediniz.");
  }
  let enrollment=current;
  if(!enrollment) {
    const {data,error}=await db.from("student_enrollments").insert({organization_id:org,student_id:id,package_id:input.packageId || null,branch_id:input.branchId,group_id:input.groupId,start_date:input.startDate,planned_end_date:input.plannedEndDate,lesson_weekdays:input.weekdays,total_lessons:input.totalLessons,used_lessons:0,payment_due_date:input.paymentDueDate,status:"active"}).select("id,planned_end_date,payment_due_date").single();
    if(error || !data)throw new Error(error?.message || "Aktif kayıt oluşturulamadı.");
    enrollment=data;
  }
  const {data:membership,error:membershipReadError}=await db.from("student_group_memberships").select("id").eq("organization_id",org).eq("student_id",id).eq("group_id",input.groupId).eq("is_active",true).limit(1).maybeSingle();
  if(membershipReadError)throw new Error("Grup bağlantısı kontrol edilemedi.");
  if(!membership) {
    const {error}=await db.from("student_group_memberships").insert({organization_id:org,student_id:id,group_id:input.groupId,started_at:input.startDate,is_active:true});
    if(error)throw new Error("Grup bağlantısı oluşturulamadı. Mevcut kayıt korunuyor; tekrar deneyiniz.");
  }
  const {data:plan,error:planReadError}=await db.from("student_attendance_plans").select("id").eq("organization_id",org).eq("student_id",id).eq("enrollment_id",enrollment.id).eq("is_active",true).limit(1).maybeSingle();
  if(planReadError)throw new Error("Katılım planı kontrol edilemedi.");
  if(!plan) {
    const {error:closeError}=await db.from("student_attendance_plans").update({is_active:false,updated_by:input.actorId,updated_at:new Date().toISOString()}).eq("organization_id",org).eq("student_id",id).eq("is_active",true);
    if(closeError)throw new Error("Önceki katılım planı güncellenemedi.");
    const end=enrollment.planned_end_date || input.plannedEndDate;
    const {error}=await db.from("student_attendance_plans").insert({organization_id:org,student_id:id,enrollment_id:enrollment.id,group_id:input.groupId,selected_weekdays:input.isoWeekdays,weekly_frequency:input.isoWeekdays.length,package_lesson_count:input.totalLessons,start_date:input.startDate,normal_planned_end_date:end,compensation_planned_end_date:end,is_active:true,created_by:input.actorId,updated_by:input.actorId});
    if(error)throw new Error("Katılım planı oluşturulamadı. Mevcut kayıt korunuyor; tekrar deneyiniz.");
  }
  // Enrollment's database trigger may already have changed pre_registration to active.
  const {data:student,error:studentError}=await db.from("students").update({status:"active",is_active:true,branch_id:input.branchId,preferred_group_id:input.groupId,preferred_package_id:input.packageId || null,preferred_days:input.weekdays.join(","),updated_at:new Date().toISOString()}).eq("organization_id",org).eq("id",id).in("status",[...new Set([input.previousStatus,"active"])]).select("id,student_number,first_name,last_name").single();
  if(studentError || !student)throw new Error("Kayıt oluştu; öğrenci bilgileri eşitlenemedi. Aynı planla tekrar deneyiniz.");
  return {enrollment,student,reused:Boolean(current)};
}

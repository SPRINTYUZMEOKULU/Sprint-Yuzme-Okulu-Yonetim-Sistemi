import { visibleSchedules } from "./presentation";
import { formatDisplayDate } from "@/lib/dates/display";
import { loadLessonRightsContext, rightsForEnrollment } from "@/lib/students/lesson-rights-context";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type GuardianStudent = {
  id: string;
  first_name: string;
  last_name: string;
  status: string | null;
  birth_date: string | null;
  swimming_level: string | null;
  branch_id: string | null;
};

export type GuardianContext = {
  students: GuardianStudent[];
  issues: string[];
  selected: GuardianStudent | null;
  enrollment: any | null;
  group: any | null;
  branch: any | null;
  coursePackage: any | null;
  coach: any | null;
  schedules: any[];
  attendance: any[];
  progress: any[];
  announcements: any[];
  payments: any[];
  paymentPlan: any | null;
  paymentInstallments: any[];
  messages: any[];
  requests: any[];
  documents: any[];
  consents: any[];
};

function emptyContext(students: GuardianStudent[] = [], issue?:string): GuardianContext {
  return {
    students,
    issues: issue?[issue]:[],
    selected: null,
    enrollment: null,
    group: null,
    branch: null,
    coursePackage: null,
    coach: null,
    schedules: [],
    attendance: [],
    progress: [],
    announcements: [],
    payments: [],
    paymentPlan: null,
    paymentInstallments: [],
    messages: [],
    requests: [],
    documents: [],
    consents: [],
  };
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getGuardianContext(userId: string, selectedId?: string): Promise<GuardianContext> {
  const supabase = await createClient();
  // Veli portalındaki tüm ders bakiyeleri de merkezi planlı ders motorundan gelir.
  await supabase.rpc("sync_scheduled_used_lessons");
  const admin = getAdminClient();

  if (!admin) return emptyContext([],"Portal bağlantısı şu anda kullanılamıyor.");

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,organization_id,role,is_active")
    .eq("id", userId)
    .eq("role", "guardian")
    .eq("is_active", true)
    .maybeSingle();

  if(profileError)return emptyContext([],"Portal hesabı doğrulanamadı.");
  if (!profile?.organization_id) return emptyContext();

  const { data: guardian, error: guardianError } = await admin
    .from("guardians")
    .select("id,login_enabled,is_active")
    .eq("organization_id", profile.organization_id)
    .eq("auth_user_id", userId)
    .maybeSingle();

  if(guardianError)return emptyContext([],"Portal bağlantısı doğrulanamadı.");
  if (!guardian?.id || guardian.is_active === false || guardian.login_enabled === false) return emptyContext();

  const { data: links, error: linksError } = await admin
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", guardian.id)
    .eq("portal_access", true);

  if(linksError)return emptyContext([],"Kursiyer bağlantıları yüklenemedi.");
  const ids = (links || []).map((item: any) => item.student_id).filter(Boolean);
  if (!ids.length) return emptyContext();

  const { data: students, error: studentsError } = await admin
    .from("students")
    .select("id,first_name,last_name,status,birth_date,swimming_level,branch_id,is_deleted")
    .eq("organization_id", profile.organization_id)
    .in("id", ids)
    .eq("status", "active")
    .eq("is_deleted", false)
    .order("first_name");

  if(studentsError)return emptyContext([],"Kursiyer bilgileri yüklenemedi.");
  const studentList = (students || []) as GuardianStudent[];
  const selected = studentList.find((student) => student.id === selectedId) || studentList[0] || null;
  if (!selected) return emptyContext(studentList);

  const issues: string[] = [];
  async function allRows(table:string, configure:(query:any)=>any) {
    const rows:any[]=[];
    for(let offset=0;;offset+=500){
      const result=await configure(admin!.from(table).select("*").eq("organization_id",profile!.organization_id).eq("student_id",selected!.id)).range(offset,offset+499);
      if(result.error)return {data:[],error:result.error};
      rows.push(...(result.data || []));if((result.data || []).length<500)return {data:rows,error:null};
    }
  }
  const [enrollmentsRes, attendanceRes, progressRes, announcementRes, paymentsRes, messagesRes, documentsRes, consentsRes, requestsRes] = await Promise.all([
    admin.from("student_enrollments").select("*").eq("organization_id", profile.organization_id).eq("student_id", selected.id).order("created_at", { ascending: false }),
    allRows("attendance_records",query=>query.order("lesson_date",{ascending:false}).order("id")),
    admin.from("student_notes").select("id,student_id,author_id,note_type,body,target,is_guardian_visible,created_at").eq("organization_id", profile.organization_id).eq("student_id", selected.id).eq("is_guardian_visible", true).order("created_at", { ascending: false }).limit(30),
    Promise.resolve({data:[],error:null}),
    allRows("student_payments",query=>query.order("received_at",{ascending:false}).order("id")),
    admin.from("guardian_messages").select("*").eq("organization_id", profile.organization_id).eq("guardian_id", userId).or(`student_id.eq.${selected.id},student_id.is.null`).order("created_at", { ascending: false }).limit(40),
    admin.from("guardian_documents").select("*").eq("organization_id", profile.organization_id).eq("is_active", true).order("sort_order").order("created_at", { ascending: false }),
    admin.from("guardian_consents").select("*").eq("organization_id", profile.organization_id).eq("guardian_id", userId).eq("student_id",selected.id).order("accepted_at", { ascending: false }),
    admin.from("guardian_requests").select("id,subject,status,created_at,responded_at").eq("organization_id",profile.organization_id).eq("guardian_id",userId).eq("student_id",selected.id).order("updated_at",{ascending:false}).limit(200)
  ]);

  for(const [label,result] of [["Kayıt",enrollmentsRes],["Yoklama",attendanceRes],["Gelişim",progressRes],["Duyuru",announcementRes],["Ödeme",paymentsRes],["Mesaj",messagesRes],["Belge",documentsRes],["Onay",consentsRes],["Talep",requestsRes]] as const) if(result.error)issues.push(`${label} bilgileri yüklenemedi. Lütfen daha sonra tekrar deneyin.`);
  const enrollmentRows=enrollmentsRes.data || [];
  const enrollment = enrollmentRows.find((row:any)=>row.status==='active') || enrollmentRows[0] || null;
  const planResult = enrollment?.id ? await admin.from("student_payment_plans").select("id,total_amount,status").eq("organization_id", profile.organization_id).eq("student_id", selected.id).eq("enrollment_id", enrollment.id).maybeSingle() : {data:null,error:null};
  const installmentsResult = planResult.data?.id ? await admin.from("student_payment_installments").select("id,sequence_no,due_date,amount,paid_amount,status").eq("plan_id", planResult.data.id).order("sequence_no") : {data:[],error:null};

  if(planResult.error || installmentsResult.error)issues.push("Ödeme planı yüklenemedi. Lütfen daha sonra tekrar deneyin.");
  if(enrollment){
    const context=await loadLessonRightsContext(admin,profile.organization_id,[selected.id]);
    enrollment.lesson_rights=rightsForEnrollment(context,enrollment);
  }
  let group: any = null;
  let branch: any = null;
  let coursePackage: any = null;
  let coach: any = null;
  let schedules: any[] = [];

  if (enrollment?.group_id) {
    const { data,error } = await admin.from("training_groups").select("*").eq("organization_id", profile.organization_id).eq("id", enrollment.group_id).maybeSingle();
    if(error)issues.push("Grup bilgileri yüklenemedi.");
    group = data || null;
  }
  const branchId = group?.branch_id || selected.branch_id;
  if (branchId) {
    const { data,error } = await admin.from("branches").select("id,name,address,location_url,phone").eq("organization_id", profile.organization_id).eq("id", branchId).maybeSingle();
    if(error)issues.push("Şube bilgileri yüklenemedi.");
    branch = data || null;
  }
  if (enrollment?.package_id) {
    const { data,error } = await admin.from("course_packages").select("*").eq("organization_id", profile.organization_id).eq("id", enrollment.package_id).maybeSingle();
    if(error)issues.push("Ödeme paketi bilgileri yüklenemedi.");
    coursePackage = data || null;
  }
  const {data:assignments,error:assignmentError}=await admin.from("lesson_student_assignments").select("coach_id,schedule_id,group_id").eq("organization_id",profile.organization_id).eq("student_id",selected.id).eq("is_active",true);
  if(assignmentError)issues.push("Eğitmen atamaları yüklenemedi.");
  const currentAssignments=(assignments || []).filter((row:any)=>row.group_id===group?.id);
  const coachIds=[...new Set(currentAssignments.map((row:any)=>row.coach_id).filter(Boolean))];
  if(!coachIds.length && group?.primary_coach_id)coachIds.push(group.primary_coach_id);
  if(coachIds.length){const {data}=await admin.from("profiles").select("id,full_name").eq("organization_id",profile.organization_id).in("id",coachIds);coach=data?.length?{full_name:data.map((row:any)=>row.full_name).join(", ")}:null;}
  if(group?.id){
    const {data,error}=await admin.from("lesson_schedules").select("*").eq("organization_id",profile.organization_id).eq("group_id",group.id).eq("is_active",true);
    if(error)issues.push("Ders programı yüklenemedi.");
    schedules=visibleSchedules(data || [],enrollment,currentAssignments);
  }

  const scopes=["and(group_id.is.null,branch_id.is.null)"];
  if(branchId)scopes.push(`and(group_id.is.null,branch_id.eq.${branchId})`);
  if(group?.id)scopes.push(`group_id.eq.${group.id}`);
  const scopedAnnouncementRes=await admin.from("announcements").select("*").eq("organization_id",profile.organization_id).eq("is_published",true).or(scopes.join(",")).order("published_at",{ascending:false}).limit(200);
  if(scopedAnnouncementRes.error)issues.push("Duyurular yüklenemedi.");
  const visibleAnnouncements = (scopedAnnouncementRes.data || []).filter((a: any) => {
    if (a.group_id) return Boolean(group?.id) && a.group_id === group.id;
    if (a.branch_id) return Boolean(branchId) && a.branch_id === branchId;
    return true;
  });

  const progress = (progressRes.data || []).map((item: any) => ({
    ...item,
    note: item.body,
    visible_to_guardian: item.is_guardian_visible,
    coach_id: item.author_id,
  }));

  return {
    students: studentList,
    issues,
    selected,
    enrollment,
    group,
    branch,
    coursePackage,
    coach,
    schedules,
    attendance: attendanceRes.data || [],
    progress: progress.filter((note:any)=>note.note_type==="coach"),
    announcements: visibleAnnouncements,
    payments: paymentsRes.data || [],
    paymentPlan: planResult.data || null,
    paymentInstallments: installmentsResult.data || [],
    requests: requestsRes.data || [],
    messages: [...(messagesRes.data || []),...progress.map((note:any)=>({id:note.id,kind:'note',title:note.note_type==='coach'?'Eğitmen notu':'Yönetim notu',body:note.body,created_at:note.created_at,channel:'Öğrenci dosyası',student_id:selected.id}))].sort((a:any,b:any)=>String(b.created_at).localeCompare(String(a.created_at))),
    documents: documentsRes.data || [],
    consents: consentsRes.data || []
  };
}

export function weekdayLabel(value: number) {
  return ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][value === 7 ? 0 : value] || "";
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return formatDisplayDate(value);
}

export function formatMoney(value?: number | string | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
}

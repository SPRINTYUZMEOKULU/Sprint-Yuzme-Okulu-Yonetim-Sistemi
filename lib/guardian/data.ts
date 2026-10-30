import { visibleSchedules } from "./presentation";
import { formatDisplayDate } from "@/lib/dates/display";
import { loadLessonRightsContext, rightsForEnrollment } from "@/lib/students/lesson-rights-context";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {guardianLoadPlan,guardianHistoryPage,HISTORY_PAGE_SIZE,type GuardianDataView} from "./load-plan";

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
  paymentHistory: any[];
  historyPage: number;
  historyHasNext: boolean;
  unreadMessageCount?: number;
  openRequestCount?: number;
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
    paymentHistory: [],
    historyPage: 1,
    historyHasNext: false,
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

export async function getGuardianContext(userId: string, selectedId?: string, view:GuardianDataView="full", pageValue?:string): Promise<GuardianContext> {
  const plan=guardianLoadPlan(view),historyPage=guardianHistoryPage(pageValue);
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
  const empty=()=>Promise.resolve({data:[] as any[],error:null,count:0});
  const emptyOne=()=>Promise.resolve({data:null as any,error:null});
  const base=(table:string,columns:string)=>admin.from(table).select(columns).eq("organization_id",profile.organization_id).eq("student_id",selected.id);
  const report=(label:string,result:{error:any})=>{if(result.error)issues.push(`${label} bilgileri yüklenemedi. Lütfen daha sonra tekrar deneyin.`);};
  async function allRows(table:string,columns:string,configure:(query:any)=>any){
    const rows:any[]=[];
    for(let offset=0;;offset+=500){
      const result=await configure(base(table,columns)).range(offset,offset+499);
      if(result.error)return {data:[],error:result.error};
      rows.push(...(result.data||[]));if((result.data||[]).length<500)return {data:rows,error:null};
    }
  }
  const enrollments=plan.enrollment?await base("student_enrollments","*").order("created_at",{ascending:false}):await empty();
  report("Kayıt",enrollments);
  const enrollment:any=(enrollments.data||[]).find((row:any)=>row.status==='active')||(enrollments.data||[])[0]||null;
  async function currentRights(){
    if(!plan.rights||!enrollment||!admin||!profile?.organization_id)return null;
    try{
      // The same central engine, read for exactly the enrollment already authorized above.
      const [used,context]=await Promise.all([
        admin.rpc("scheduled_used_lessons",{p_enrollment_id:enrollment.id}),
        loadLessonRightsContext(admin,profile.organization_id,[selected.id]),
      ]);
      if(used.error||used.data===null||!Number.isFinite(Number(used.data)))throw new Error("Bakiye doğrulanamadı.");
      enrollment.used_lessons=Number(used.data);
      return rightsForEnrollment(context,enrollment);
    }catch{issues.push("Ders bakiyesi doğrulanamadı. Son kayıtlı bilgiler gösteriliyor.");return null;}
  }
  const attendance=()=>{
    if(!plan.attendance)return empty();
    if(plan.attendanceHistory)return base("attendance_records","id,student_id,group_id,schedule_id,lesson_date,status,coach_note,enrollment_id").order("lesson_date",{ascending:false}).order("id").range((historyPage-1)*HISTORY_PAGE_SIZE,historyPage*HISTORY_PAGE_SIZE);
    if(plan.full)return allRows("attendance_records","id,student_id,group_id,schedule_id,lesson_date,status,coach_note,enrollment_id",q=>q.order("lesson_date",{ascending:false}).order("id"));
    if(!enrollment)return empty();
    return allRows("attendance_records","id,student_id,group_id,schedule_id,lesson_date,status,coach_note,enrollment_id",q=>{
      if(!enrollment.start_date)return q.eq("enrollment_id",enrollment.id).order("lesson_date",{ascending:false}).order("id");
      const legacy=`and(enrollment_id.is.null,lesson_date.gte.${enrollment.start_date}${enrollment.planned_end_date?`,lesson_date.lte.${enrollment.planned_end_date}`:""})`;
      return q.or(`enrollment_id.eq.${enrollment.id},${legacy}`).order("lesson_date",{ascending:false}).order("id");
    });
  };
  const noteQuery=()=>{
    if(!plan.notes)return empty();
    let q=base("student_notes","id,student_id,author_id,note_type,body,target,is_guardian_visible,created_at").eq("is_guardian_visible",true);
    if(plan.progressOnly)q=q.eq("note_type","coach");
    return q.order("created_at",{ascending:false}).order("id").limit(30);
  };
  const messageQuery=()=>{
    if(!plan.messages)return empty();
    let q=admin.from("guardian_messages").select(plan.overview?"id":"id,title,body,channel,read_at,created_at,student_id",plan.overview?{count:"exact",head:true}:undefined).eq("organization_id",profile.organization_id).eq("guardian_id",userId).or(`student_id.eq.${selected.id},student_id.is.null`);
    if(plan.overview)return q.is("read_at",null);
    return q.order("created_at",{ascending:false}).order("id").limit(40);
  };
  const requestQuery=()=>{
    if(!plan.requests)return empty();
    let q=admin.from("guardian_requests").select(plan.overview?"id":"id,subject,status,created_at,responded_at",plan.overview?{count:"exact",head:true}:undefined).eq("organization_id",profile.organization_id).eq("guardian_id",userId).eq("student_id",selected.id);
    if(plan.overview)return q.not("status","in","(resolved,rejected,archived)");
    return q.order("updated_at",{ascending:false}).limit(200);
  };
  const [attendanceRes,notesRes,paymentsRes,messagesRes,documentsRes,consentsRes,requestsRes,planRes,groupRes,packageRes,assignmentsRes,paymentHistoryRes,rights]=await Promise.all([
    attendance(),noteQuery(),
    plan.finance&&enrollment?allRows("student_payments",plan.full?"id,enrollment_id,amount,payment_status,payment_method,received_at":"id,enrollment_id,amount,payment_status",q=>(plan.full?q:q.eq("enrollment_id",enrollment.id)).order("id")):empty(),
    messageQuery(),
    plan.documents?admin.from("guardian_documents").select(plan.overview?"id,version,requires_consent":"*").eq("organization_id",profile.organization_id).eq("is_active",true).order("sort_order").order("created_at",{ascending:false}):empty(),
    plan.documents?admin.from("guardian_consents").select("id,document_id,document_version,accepted_at,student_id").eq("organization_id",profile.organization_id).eq("guardian_id",userId).eq("student_id",selected.id).order("accepted_at",{ascending:false}):empty(),
    requestQuery(),
    plan.finance&&enrollment?base("student_payment_plans","id,total_amount,status").eq("enrollment_id",enrollment.id).maybeSingle():emptyOne(),
    plan.group&&enrollment?.group_id?admin.from("training_groups").select("id,name,branch_id,primary_coach_id").eq("organization_id",profile.organization_id).eq("id",enrollment.group_id).maybeSingle():emptyOne(),
    plan.finance&&enrollment?.package_id?admin.from("course_packages").select("id,name,price,lesson_count").eq("organization_id",profile.organization_id).eq("id",enrollment.package_id).maybeSingle():emptyOne(),
    plan.schedule?base("lesson_student_assignments","coach_id,schedule_id,group_id").eq("is_active",true):empty(),
    plan.paymentHistory?base("student_payments","id,enrollment_id,amount,payment_status,payment_method,received_at").order("received_at",{ascending:false}).order("id").range((historyPage-1)*HISTORY_PAGE_SIZE,historyPage*HISTORY_PAGE_SIZE):empty(),
    currentRights(),
  ]);
  for(const [label,result] of [["Yoklama",attendanceRes],["Gelişim",notesRes],["Ödeme",paymentsRes],["Mesaj",messagesRes],["Belge",documentsRes],["Onay",consentsRes],["Talep",requestsRes],["Ödeme planı",planRes],["Grup",groupRes],["Ödeme paketi",packageRes],["Eğitmen atamaları",assignmentsRes],["Ödeme geçmişi",paymentHistoryRes]] as const)report(label,result);
  if(enrollment&&rights)enrollment.lesson_rights=rights;
  const group=groupRes.data||null,branchId=group?.branch_id||selected.branch_id;
  const currentAssignments=(assignmentsRes.data||[]).filter((row:any)=>row.group_id===group?.id);
  const coachIds=[...new Set(currentAssignments.map((row:any)=>row.coach_id).filter(Boolean))];
  if(!coachIds.length&&group?.primary_coach_id)coachIds.push(group.primary_coach_id);
  const scopes=["and(group_id.is.null,branch_id.is.null)"];
  if(branchId)scopes.push(`and(group_id.is.null,branch_id.eq.${branchId})`);
  if(group?.id)scopes.push(`group_id.eq.${group.id}`);
  const [installmentsRes,branchRes,coachesRes,schedulesRes,announcementsRes]=await Promise.all([
    planRes.data?.id&&planRes.data.status!=="cancelled"?admin.from("student_payment_installments").select("id,sequence_no,due_date,amount,paid_amount,status").eq("plan_id",planRes.data.id).order("sequence_no"):empty(),
    plan.branch&&branchId?admin.from("branches").select("id,name,address,location_url,phone").eq("organization_id",profile.organization_id).eq("id",branchId).maybeSingle():emptyOne(),
    plan.coach&&coachIds.length?admin.from("profiles").select("id,full_name").eq("organization_id",profile.organization_id).in("id",coachIds):empty(),
    plan.schedule&&group?.id?admin.from("lesson_schedules").select("id,weekday,start_time,end_time").eq("organization_id",profile.organization_id).eq("group_id",group.id).eq("is_active",true):empty(),
    plan.announcements?admin.from("announcements").select("id,title,body,branch_id,group_id,published_at,created_at").eq("organization_id",profile.organization_id).eq("is_published",true).or(scopes.join(",")).order("published_at",{ascending:false}).limit(200):empty(),
  ]);
  for(const [label,result] of [["Ödeme planı",installmentsRes],["Şube",branchRes],["Eğitmen",coachesRes],["Ders programı",schedulesRes],["Duyuru",announcementsRes]] as const)report(label,result);
  const progress=(notesRes.data||[]).map((item:any)=>({...item,note:item.body,visible_to_guardian:item.is_guardian_visible,coach_id:item.author_id}));
  const history=plan.attendanceHistory?attendanceRes.data:paymentHistoryRes.data;
  return {
    students:studentList,issues,selected,enrollment,group,branch:branchRes.data||null,coursePackage:packageRes.data||null,
    coach:coachesRes.data?.length?{full_name:coachesRes.data.map((row:any)=>row.full_name).join(", ")}:null,
    schedules:visibleSchedules(schedulesRes.data||[],enrollment,currentAssignments),
    attendance:plan.attendanceHistory?(attendanceRes.data||[]).slice(0,HISTORY_PAGE_SIZE):attendanceRes.data||[],
    progress:progress.filter((note:any)=>note.note_type==='coach'),
    announcements:(announcementsRes.data||[]).filter((a:any)=>a.group_id?a.group_id===group?.id:a.branch_id?a.branch_id===branchId:true),
    payments:paymentsRes.data||[],paymentHistory:(paymentHistoryRes.data||[]).slice(0,HISTORY_PAGE_SIZE),
    historyPage,historyHasNext:Boolean(history&&history.length>HISTORY_PAGE_SIZE),
    paymentPlan:planRes.data||null,paymentInstallments:installmentsRes.data||[],
    requests:requestsRes.data||[],openRequestCount:plan.overview?requestsRes.count||0:undefined,
    unreadMessageCount:plan.overview?messagesRes.count||0:undefined,
    messages:[...(messagesRes.data||[]),...(!plan.overview?progress.map((note:any)=>({id:note.id,kind:'note',title:note.note_type==='coach'?'Eğitmen notu':'Yönetim notu',body:note.body,created_at:note.created_at,channel:'Öğrenci dosyası',student_id:selected.id})):[])].sort((a:any,b:any)=>String(b.created_at).localeCompare(String(a.created_at))),
    documents:documentsRes.data||[],consents:consentsRes.data||[],
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

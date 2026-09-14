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
  messages: any[];
  documents: any[];
  consents: any[];
};

function emptyContext(students: GuardianStudent[] = []): GuardianContext {
  return {
    students,
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
    messages: [],
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
  const admin = getAdminClient();

  if (!admin) return emptyContext();

  const { data: profile } = await admin
    .from("profiles")
    .select("id,organization_id,role,is_active")
    .eq("id", userId)
    .eq("role", "guardian")
    .eq("is_active", true)
    .maybeSingle();

  if (!profile?.organization_id) return emptyContext();

  const { data: guardian } = await admin
    .from("guardians")
    .select("id,login_enabled,is_active")
    .eq("organization_id", profile.organization_id)
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!guardian?.id || guardian.is_active === false || guardian.login_enabled === false) return emptyContext();

  const { data: links } = await admin
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", guardian.id)
    .eq("portal_access", true);

  const ids = (links || []).map((item: any) => item.student_id).filter(Boolean);
  if (!ids.length) return emptyContext();

  const { data: students } = await admin
    .from("students")
    .select("id,first_name,last_name,status,birth_date,swimming_level,branch_id")
    .eq("organization_id", profile.organization_id)
    .in("id", ids)
    .order("first_name");

  const studentList = (students || []) as GuardianStudent[];
  const selected = studentList.find((student) => student.id === selectedId) || studentList[0] || null;
  if (!selected) return emptyContext(studentList);

  const [enrollmentRes, attendanceRes, progressRes, announcementRes, paymentsRes, messagesRes, documentsRes, consentsRes] = await Promise.all([
    admin.from("student_enrollments").select("*").eq("organization_id", profile.organization_id).eq("student_id", selected.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("attendance_records").select("*").eq("organization_id", profile.organization_id).eq("student_id", selected.id).order("lesson_date", { ascending: false }).limit(40),
    admin.from("student_notes").select("id,student_id,author_id,note_type,body,target,is_guardian_visible,created_at").eq("organization_id", profile.organization_id).eq("student_id", selected.id).eq("note_type", "coach").eq("is_guardian_visible", true).order("created_at", { ascending: false }).limit(30),
    supabase.from("announcements").select("*").eq("is_published", true).order("published_at", { ascending: false }).limit(20),
    admin.from("payments").select("*").eq("student_id", selected.id).order("received_at", { ascending: false }).limit(30),
    admin.from("guardian_messages").select("*").eq("guardian_id", userId).or(`student_id.eq.${selected.id},student_id.is.null`).order("created_at", { ascending: false }).limit(40),
    supabase.from("guardian_documents").select("*").eq("is_active", true).order("sort_order").order("created_at", { ascending: false }),
    admin.from("guardian_consents").select("*").eq("guardian_id", userId).or(`student_id.eq.${selected.id},student_id.is.null`).order("accepted_at", { ascending: false })
  ]);

  const enrollment = enrollmentRes.data || null;
  let group: any = null;
  let branch: any = null;
  let coursePackage: any = null;
  let coach: any = null;
  let schedules: any[] = [];

  if (enrollment?.group_id) {
    const { data } = await admin.from("training_groups").select("*").eq("organization_id", profile.organization_id).eq("id", enrollment.group_id).maybeSingle();
    group = data || null;
  }
  const branchId = group?.branch_id || selected.branch_id;
  if (branchId) {
    const { data } = await admin.from("branches").select("id,name,address,location_url,phone").eq("organization_id", profile.organization_id).eq("id", branchId).maybeSingle();
    branch = data || null;
  }
  if (enrollment?.package_id) {
    const { data } = await admin.from("course_packages").select("*").eq("organization_id", profile.organization_id).eq("id", enrollment.package_id).maybeSingle();
    coursePackage = data || null;
  }
  if (group?.primary_coach_id) {
    const { data } = await admin.from("profiles").select("id,full_name").eq("organization_id", profile.organization_id).eq("id", group.primary_coach_id).maybeSingle();
    coach = data || null;
  }
  if (group?.id) {
    const { data } = await admin.from("lesson_schedules").select("*").eq("organization_id", profile.organization_id).eq("group_id", group.id).eq("is_active", true).order("weekday").order("start_time");
    schedules = data || [];
  }

  const progress = (progressRes.data || []).map((item: any) => ({
    ...item,
    note: item.body,
    visible_to_guardian: item.is_guardian_visible,
    coach_id: item.author_id,
  }));

  return {
    students: studentList,
    selected,
    enrollment,
    group,
    branch,
    coursePackage,
    coach,
    schedules,
    attendance: attendanceRes.data || [],
    progress,
    announcements: announcementRes.data || [],
    payments: paymentsRes.data || [],
    messages: messagesRes.data || [],
    documents: documentsRes.data || [],
    consents: consentsRes.data || []
  };
}

export function weekdayLabel(value: number) {
  return ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][value] || "";
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

export function formatMoney(value?: number | string | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);
}

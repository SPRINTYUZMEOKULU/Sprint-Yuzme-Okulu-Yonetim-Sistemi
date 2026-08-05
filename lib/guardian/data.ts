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

export async function getGuardianContext(userId: string, selectedId?: string): Promise<GuardianContext> {
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", userId);

  const ids = (links || []).map((item: any) => item.student_id).filter(Boolean);
  if (!ids.length) {
    return {
      students: [], selected: null, enrollment: null, group: null, branch: null,
      coursePackage: null, coach: null, schedules: [], attendance: [], progress: [],
      announcements: [], payments: [], messages: [], documents: [], consents: []
    };
  }

  const { data: students } = await supabase
    .from("students")
    .select("id,first_name,last_name,status,birth_date,swimming_level,branch_id")
    .in("id", ids)
    .order("first_name");

  const studentList = (students || []) as GuardianStudent[];
  const selected = studentList.find((student) => student.id === selectedId) || studentList[0] || null;
  if (!selected) {
    return {
      students: studentList, selected: null, enrollment: null, group: null, branch: null,
      coursePackage: null, coach: null, schedules: [], attendance: [], progress: [],
      announcements: [], payments: [], messages: [], documents: [], consents: []
    };
  }

  const [enrollmentRes, attendanceRes, progressRes, announcementRes, paymentsRes, messagesRes, documentsRes, consentsRes] = await Promise.all([
    supabase.from("student_enrollments").select("*").eq("student_id", selected.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("attendance_records").select("*").eq("student_id", selected.id).order("lesson_date", { ascending: false }).limit(40),
    supabase.from("progress_notes").select("*").eq("student_id", selected.id).eq("visible_to_guardian", true).order("created_at", { ascending: false }).limit(30),
    supabase.from("announcements").select("*").eq("is_published", true).order("published_at", { ascending: false }).limit(20),
    supabase.from("payments").select("*").eq("student_id", selected.id).order("received_at", { ascending: false }).limit(30),
    supabase.from("guardian_messages").select("*").eq("guardian_id", userId).or(`student_id.eq.${selected.id},student_id.is.null`).order("created_at", { ascending: false }).limit(40),
    supabase.from("guardian_documents").select("*").eq("is_active", true).order("sort_order").order("created_at", { ascending: false }),
    supabase.from("guardian_consents").select("*").eq("guardian_id", userId).or(`student_id.eq.${selected.id},student_id.is.null`).order("accepted_at", { ascending: false })
  ]);

  const enrollment = enrollmentRes.data || null;
  let group: any = null;
  let branch: any = null;
  let coursePackage: any = null;
  let coach: any = null;
  let schedules: any[] = [];

  if (enrollment?.group_id) {
    const { data } = await supabase.from("training_groups").select("*").eq("id", enrollment.group_id).maybeSingle();
    group = data || null;
  }
  const branchId = group?.branch_id || selected.branch_id;
  if (branchId) {
    const { data } = await supabase.from("branches").select("id,name,address,location_url,phone").eq("id", branchId).maybeSingle();
    branch = data || null;
  }
  if (enrollment?.package_id) {
    const { data } = await supabase.from("course_packages").select("*").eq("id", enrollment.package_id).maybeSingle();
    coursePackage = data || null;
  }
  if (group?.primary_coach_id) {
    const { data } = await supabase.from("profiles").select("id,full_name").eq("id", group.primary_coach_id).maybeSingle();
    coach = data || null;
  }
  if (group?.id) {
    const { data } = await supabase.from("lesson_schedules").select("*").eq("group_id", group.id).eq("is_active", true).order("weekday").order("start_time");
    schedules = data || [];
  }

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
    progress: progressRes.data || [],
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

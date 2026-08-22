import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile([
      "owner",
      "admin",
      "branch_manager",
      "registration_staff",
      "accounting",
      "coach",
    ]);

    const organizationId = profile.organization_id;

    if (!organizationId) {
      return NextResponse.json(
        { results: [], error: "Organizasyon bilgisi bulunamadı." },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const query = (searchParams.get("q") || "").trim();

    if (query.length < 2) {
      return NextResponse.json({
        results: [],
      });
    }

    const supabase = await createClient();

    /*
     * =========================================================
     * ÖĞRENCİ ARAMA
     * =========================================================
     */

    const safeQuery = query
      .replace(/[%_,()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const words = safeQuery
      .split(" ")
      .filter(Boolean);

    const searchValue = words.join(" ");

    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select(`
        id,
        first_name,
        last_name,
        student_number,
        phone,
        guardian_phone,
        guardian_name,
        email,
        guardian_email,
        swimming_level,
        branch_id,
        preferred_group_id,
        status,
        created_at
      `)
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .or(
        [
          `first_name.ilike.%${searchValue}%`,
          `last_name.ilike.%${searchValue}%`,
          `student_number.ilike.%${searchValue}%`,
          `phone.ilike.%${searchValue}%`,
          `guardian_phone.ilike.%${searchValue}%`,
          `guardian_name.ilike.%${searchValue}%`,
          `email.ilike.%${searchValue}%`,
          `guardian_email.ilike.%${searchValue}%`,
        ].join(",")
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(15);

    if (studentsError) {
      console.error(
        "Genel arama öğrenci hatası:",
        studentsError
      );
    }

    /*
     * "Ali Yılmaz" gibi ad + soyad aramalarını da destekle.
     */

    let extraStudents: any[] = [];

    if (words.length >= 2) {
      const firstWord = words[0];
      const lastWords = words.slice(1).join(" ");

      const { data, error } = await supabase
        .from("students")
        .select(`
          id,
          first_name,
          last_name,
          student_number,
          phone,
          guardian_phone,
          guardian_name,
          email,
          guardian_email,
          swimming_level,
          branch_id,
          preferred_group_id,
          status,
          created_at
        `)
        .eq("organization_id", organizationId)
        .eq("is_deleted", false)
        .ilike("first_name", `%${firstWord}%`)
        .ilike("last_name", `%${lastWords}%`)
        .limit(10);

      if (!error && data) {
        extraStudents = data;
      }
    }

    /*
     * İki sorgudan gelen öğrencileri tekilleştir.
     */

    const studentMap = new Map<string, any>();

    for (const student of [
      ...(students || []),
      ...extraStudents,
    ]) {
      studentMap.set(student.id, student);
    }

    const studentList = Array.from(
      studentMap.values()
    ).slice(0, 15);

    /*
     * =========================================================
     * GRUP / ŞUBE BİLGİLERİ
     * =========================================================
     */

    const studentIds = studentList.map(
      (student) => student.id
    );

    const [
      membershipsResult,
      enrollmentsResult,
      groupsResult,
      branchesResult,
    ] = await Promise.all([
      studentIds.length
        ? supabase
            .from("student_group_memberships")
            .select("student_id,group_id,started_at")
            .in("student_id", studentIds)
            .eq("is_active", true)
            .order("started_at", {
              ascending: false,
            })
        : Promise.resolve({
            data: [],
            error: null,
          }),

      studentIds.length
        ? supabase
            .from("student_enrollments")
            .select("student_id,group_id,branch_id,created_at")
            .in("student_id", studentIds)
            .eq("status", "active")
            .order("created_at", {
              ascending: false,
            })
        : Promise.resolve({
            data: [],
            error: null,
          }),

      supabase
        .from("training_groups")
        .select("id,name,branch_id")
        .eq("organization_id", organizationId)
        .eq("is_active", true),

      supabase
        .from("branches")
        .select("id,name")
        .eq("organization_id", organizationId)
        .eq("is_active", true),
    ]);

    /*
     * =========================================================
     * HARİTALAR
     * =========================================================
     */

    const membershipMap = new Map<string, any>();

    for (const membership of
      membershipsResult.data || []) {
      if (
        membership.student_id &&
        !membershipMap.has(membership.student_id)
      ) {
        membershipMap.set(
          membership.student_id,
          membership
        );
      }
    }

    const enrollmentMap = new Map<string, any>();

    for (const enrollment of
      enrollmentsResult.data || []) {
      if (
        enrollment.student_id &&
        !enrollmentMap.has(enrollment.student_id)
      ) {
        enrollmentMap.set(
          enrollment.student_id,
          enrollment
        );
      }
    }

    const groupMap = new Map<string, any>();

    for (const group of groupsResult.data || []) {
      groupMap.set(group.id, group);
    }

    const branchMap = new Map<string, any>();

    for (const branch of branchesResult.data || []) {
      branchMap.set(branch.id, branch);
    }

    /*
     * =========================================================
     * SONUÇLARI HAZIRLA
     * =========================================================
     */

    const results = studentList.map(
      (student) => {
        const membership =
          membershipMap.get(student.id);

        const enrollment =
          enrollmentMap.get(student.id);

        const groupId =
          membership?.group_id ||
          enrollment?.group_id ||
          student.preferred_group_id ||
          null;

        const group = groupId
          ? groupMap.get(groupId)
          : null;

        const branchId =
          group?.branch_id ||
          student.branch_id ||
          enrollment?.branch_id ||
          null;

        const branch = branchId
          ? branchMap.get(branchId)
          : null;

        const fullName = [
          student.first_name,
          student.last_name,
        ]
          .filter(Boolean)
          .join(" ");

        const details = [
          group?.name || null,
          branch?.name || null,
          student.guardian_name
            ? `Veli: ${student.guardian_name}`
            : null,
          student.guardian_phone ||
            student.phone ||
            null,
        ].filter(Boolean);

        return {
          id: student.id,

          type: "student",

          name:
            fullName ||
            "İsimsiz öğrenci",

          subtitle:
            details.join(" · "),

          studentNumber:
            student.student_number || null,

          phone:
            student.phone || null,

          guardianPhone:
            student.guardian_phone || null,

          guardianName:
            student.guardian_name || null,

          email:
            student.email || null,

          guardianEmail:
            student.guardian_email || null,

          swimmingLevel:
            student.swimming_level || null,

          status:
            student.status || null,

          groupName:
            group?.name || null,

          branchName:
            branch?.name || null,

          href:
            `/ogrenciler?ogrenci=${encodeURIComponent(
              student.id
            )}`,
        };
      }
    );

    return NextResponse.json(
      {
        results,
        count: results.length,
        query,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Genel arama API hatası:",
      error
    );

    return NextResponse.json(
      {
        results: [],
        error:
          "Arama işlemi gerçekleştirilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}

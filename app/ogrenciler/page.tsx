import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import StudentsClient, {
  type StudentListItem,
} from "./students-client";
import "../dashboard.css";

export const dynamic = "force-dynamic";

type BranchRow = {
  id: string;
  name: string;
};

type GroupRow = {
  id: string;
  branch_id: string | null;
  name: string;
  course_type: string | null;
};

type PackageRow = {
  id: string;
  name: string;
  lesson_count: number | null;
};

export default async function StudentsPage() {
  await requireProfile();

  const supabase = await createClient();

  const [
    { data: students, error: studentsError },
    { data: branches },
    { data: groups },
    { data: packages },
  ] = await Promise.all([
    supabase
      .from("students")
      .select(
        `
        id,
        first_name,
        last_name,
        status,
        swimming_level,
        branch_id,
        phone,
        preferred_group_id,
        preferred_package_id,
        created_at
        `
      )
      .order("created_at", { ascending: false })
      .limit(1000),

    supabase
      .from("branches")
      .select("id,name")
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("training_groups")
      .select("id,branch_id,name,course_type")
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("course_packages")
      .select("id,name,lesson_count")
      .eq("is_active", true)
      .order("lesson_count"),
  ]);

  if (studentsError) {
    console.error("Öğrenci listesi yüklenemedi:", studentsError);
  }

  const branchMap = new Map(
    ((branches || []) as BranchRow[]).map((branch) => [
      branch.id,
      branch.name,
    ])
  );

  const groupMap = new Map(
    ((groups || []) as GroupRow[]).map((group) => [
      group.id,
      group,
    ])
  );

  const packageMap = new Map(
    ((packages || []) as PackageRow[]).map((coursePackage) => [
      coursePackage.id,
      coursePackage,
    ])
  );

  const preparedStudents: StudentListItem[] = (students || []).map(
    (student) => {
      const selectedGroup = student.preferred_group_id
        ? groupMap.get(student.preferred_group_id)
        : undefined;

      const selectedPackage = student.preferred_package_id
        ? packageMap.get(student.preferred_package_id)
        : undefined;

      return {
        id: student.id,
        first_name: student.first_name || "",
        last_name: student.last_name || "",

        status: student.status || null,
        swimming_level: student.swimming_level || null,

        branch_id: student.branch_id || null,
        branch_name: student.branch_id
          ? branchMap.get(student.branch_id) || null
          : null,

        group_id: student.preferred_group_id || null,
        group_name: selectedGroup?.name || null,

        course_type: selectedGroup?.course_type || null,

        package_name: selectedPackage?.name || null,
        package_lesson_count:
          selectedPackage?.lesson_count ?? null,

        /*
         * Ders hakkı ve tarih altyapısını
         * sonraki aşamada gerçek tablolara bağlayacağız.
         */
        compensation_lessons: 0,
        used_lessons: 0,
        remaining_lessons:
          selectedPackage?.lesson_count ?? 0,

        start_date: null,
        end_date: null,

        phone: student.phone || null,
        guardian_phone: null,

        created_at: student.created_at || null,
      };
    }
  );

  return (
    <main className="operationPage">
      <header className="operationHeader">
        <div>
          <p>SPRİNTOS · ÖĞRENCİ YÖNETİMİ</p>

          <h1>Öğrenci Merkezi</h1>

          <span>
            Öğrencileri, şubeleri, grupları, seviyeleri ve ders
            haklarını tek ekrandan yönetin.
          </span>
        </div>
      </header>

      {studentsError ? (
        <section className="operationCard">
          <div className="tableEmpty">
            Öğrenci listesi şu anda yüklenemedi.
          </div>
        </section>
      ) : (
        <StudentsClient students={preparedStudents} />
      )}
    </main>
  );
}

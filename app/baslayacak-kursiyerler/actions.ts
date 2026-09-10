"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveAttendance } from "@/app/yoklama/actions";

export async function startFirstLesson(formData: FormData) {
  const studentId = String(formData.get("studentId") || "");
  const enrollmentId = String(formData.get("enrollmentId") || "") || null;
  const groupId = String(formData.get("groupId") || "");
  const scheduleId = String(formData.get("scheduleId") || "");
  const lessonDate = String(formData.get("lessonDate") || "");
  const branchId = String(formData.get("branchId") || "") || null;

  if (!studentId || !groupId || !scheduleId || !lessonDate) {
    redirect("/baslayacak-kursiyerler?firstLesson=missing");
  }

  const result = await saveAttendance({
    branchId,
    groupId,
    scheduleId,
    coachId: null,
    lessonDate,
    records: [
      {
        studentId,
        enrollmentId,
        status: "present",
        coachNote: "İlk ders Başlangıç Merkezi üzerinden başlatıldı.",
      },
    ],
  });

  if (!result.ok) {
    redirect(`/baslayacak-kursiyerler?firstLesson=error&message=${encodeURIComponent(result.message || "İşlem tamamlanamadı")}`);
  }

  revalidatePath("/baslayacak-kursiyerler");
  revalidatePath("/ogrenciler");
  revalidatePath(`/ogrenciler/${studentId}`);
  revalidatePath("/yoklama");
  redirect("/baslayacak-kursiyerler?firstLesson=success");
}

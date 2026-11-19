"use server";

import { requireProfile } from "@/lib/auth/profile";
import { guardianStudentAccess } from "@/lib/guardian/access";
import { documentAdmin } from "@/lib/payments/document-admin";
import { satisfactionTopics } from "@/lib/guardian/satisfaction";

export type SurveyResult = { sent: boolean; message: string };

export async function submitSatisfaction(id: string, studentId: string, _previous: SurveyResult, form: FormData): Promise<SurveyResult> {
  const profile = await requireProfile(["guardian"]);
  const org = profile.organization_id;
  const rating = form.get("rating");
  const topic = form.get("topic");
  const comment = form.get("comment");
  const problem = form.get("problem");
  if (!org || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ||
      typeof rating !== "string" || !/^[1-5]$/.test(rating) ||
      typeof topic !== "string" || !Object.hasOwn(satisfactionTopics, topic) ||
      (problem !== "yes" && problem !== "no") ||
      typeof comment !== "string" || comment.length > 1200 || (problem === "yes" && !comment.trim())) {
    return { sent: false, message: "Puanı, konuyu ve sorun durumunu belirtin. Sorun varsa en fazla 1.200 karakterle açıklayın." };
  }
  const db = documentAdmin();
  const scope = await guardianStudentAccess(db, profile.id, org);
  if (scope.error || !scope.studentIds.includes(studentId)) return { sent: false, message: "Anket erişimi doğrulanamadı." };
  const { data, error } = await db.rpc("submit_guardian_satisfaction_feedback", {
    p_id: id, p_org: org, p_rating: Number(rating), p_topic: topic, p_comment: comment.trim(),
    p_guardian: profile.id, p_student: studentId, p_problem: problem === "yes",
  });
  if (error || data !== true) return { sent: false, message: "Anket iletilemedi. Lütfen tekrar deneyin." };
  return { sent: true, message: "Teşekkür ederiz. Yanıtınız Yönetim Kurulu Başkanlığına iletildi." };
}

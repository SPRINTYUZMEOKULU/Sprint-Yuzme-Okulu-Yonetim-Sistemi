"use server";

import { requireProfile } from "@/lib/auth/profile";
import { guardianStudentAccess } from "@/lib/guardian/access";
import { documentAdmin } from "@/lib/payments/document-admin";
import { satisfactionTopics } from "@/lib/guardian/satisfaction";

export type SurveyResult = { sent: boolean; message: string };

export async function submitSatisfaction(id: string, _previous: SurveyResult, form: FormData): Promise<SurveyResult> {
  const profile = await requireProfile(["guardian"]);
  const org = profile.organization_id;
  const rating = form.get("rating");
  const topic = form.get("topic");
  const comment = form.get("comment");
  if (!org || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ||
      typeof rating !== "string" || !/^[1-5]$/.test(rating) ||
      typeof topic !== "string" || !Object.hasOwn(satisfactionTopics, topic) ||
      typeof comment !== "string" || comment.length > 1200) {
    return { sent: false, message: "Puan ve konu seçin. Yorum en fazla 1.200 karakter olabilir." };
  }
  const db = documentAdmin();
  const scope = await guardianStudentAccess(db, profile.id, org);
  if (scope.error || !scope.studentIds.length) return { sent: false, message: "Anket erişimi doğrulanamadı." };
  const { data, error } = await db.rpc("submit_guardian_satisfaction_survey", {
    p_id: id, p_org: org, p_rating: Number(rating), p_topic: topic, p_comment: comment.trim(),
  });
  if (error || data !== true) return { sent: false, message: "Anket iletilemedi. Lütfen tekrar deneyin." };
  return { sent: true, message: "Teşekkür ederiz. Yanıtınız Yönetim Kurulu Başkanlığına iletildi." };
}

import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { deliverPortalMessage, messageCenterRoles, messageDeliveryIdPattern } from "@/lib/messaging/deliver-portal-message";

export async function POST(request: Request) {
  const profile = await requireProfile([...messageCenterRoles]);
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 180) : "";
  const messages = body?.messages;
  if (!profile.organization_id || !title || !messageDeliveryIdPattern.test(body?.deliveryId ?? "") ||
    !Array.isArray(messages) || !messages.length || messages.length > 20 ||
    messages.some(item => typeof item?.studentId !== "string" || !messageDeliveryIdPattern.test(item.studentId) ||
      typeof item.message !== "string" || !item.message.trim() || item.message.length > 4000)) {
    return NextResponse.json({ message: "Geçerli alıcı ve mesaj bilgisi girin." }, { status: 400 });
  }

  const db = await createClient();
  const byStudent = new Map<string, string>(messages.map(item => [item.studentId, item.message.trim()]));
  const { data: students, error } = await db.from("students").select("id")
    .eq("organization_id", profile.organization_id).eq("status", "active").eq("is_deleted", false)
    .in("id", [...byStudent.keys()]);
  if (error) return NextResponse.json({ message: "Kursiyerler doğrulanamadı." }, { status: 500 });

  const totals = { saved: 0, push: 0, failed: 0, skipped: byStudent.size - (students?.length ?? 0) };
  for (const student of students ?? []) {
    try {
      const result = await deliverPortalMessage({
        organizationId: profile.organization_id, studentId: student.id, actorId: profile.id,
        deliveryId: body.deliveryId, title, message: byStudent.get(student.id)!,
      });
      totals.saved += result.saved;
      totals.push += result.push;
      totals.failed += result.failed;
      if (!result.saved && !result.failed) totals.skipped++;
    } catch {
      totals.failed++;
    }
  }
  return NextResponse.json(totals);
}

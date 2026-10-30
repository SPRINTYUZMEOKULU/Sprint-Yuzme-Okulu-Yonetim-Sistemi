import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
function phone(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  else if (digits.length === 10) digits = `90${digits}`;
  return /^\d{10,15}$/.test(digits) ? digits : "";
}
export async function POST(request: Request) {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff", "accounting", "coach"]);
  const body = await request.json().catch(() => null);
  if (!profile.organization_id || typeof body?.studentId !== "string")
    return NextResponse.json({ok:false,message:"Kursiyer seçilmedi."}, {status:400});
  const db = await createClient();
  const {data:student,error} = await db.from("students").select("id,phone,guardian_phone,is_deleted")
    .eq("organization_id",profile.organization_id).eq("id",body.studentId).maybeSingle();
  if (error || !student || student.is_deleted)
    return NextResponse.json({ok:false,message:"Güncel iletişim bilgisi doğrulanamadı. Mesaj açılmadı."}, {status:404});
  const current = [phone(student.guardian_phone), phone(student.phone)].filter(Boolean);
  const previous = phone(body.previousRecipient);
  const recipient = current.includes(previous) ? previous : current[0];
  if (!recipient) return NextResponse.json({ok:false,message:"Geçerli telefon bulunamadı. Kursiyerin iletişim bilgilerini düzenleyin."}, {status:409});
  return NextResponse.json({ok:true,recipient,changed:recipient!==previous}, {headers:{"Cache-Control":"no-store"}});
}

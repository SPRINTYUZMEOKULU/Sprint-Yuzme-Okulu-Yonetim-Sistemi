import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const managementRoles = new Set(["owner", "admin", "branch_manager"]);
const payTypes = new Set(["per_lesson", "hourly", "monthly", "monthly_plus_lesson"]);

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase sunucu değişkenleri eksik.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id || !managementRoles.has(String(profile.role))) return null;
  return { user, admin, organizationId: String(profile.organization_id) };
}

export async function GET() {
  try {
    const ctx = await context();
    if (!ctx) return NextResponse.json({ error: "Bu ekran için yönetici yetkisi gerekiyor." }, { status: 403 });
    const { data, error } = await ctx.admin
      .from("staff")
      .select("id, first_name, last_name, title, staff_type, is_active, pay_type, per_lesson_rate, hourly_rate, monthly_salary, payroll_active")
      .eq("organization_id", ctx.organizationId)
      .eq("is_active", true)
      .order("first_name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({
      rows: (data || []).map((row) => ({
        staffId: row.id,
        staffName: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "İsimsiz Personel",
        title: row.title || row.staff_type || "Personel",
        payType: row.pay_type || "per_lesson",
        perLessonRate: Number(row.per_lesson_rate || 0),
        hourlyRate: Number(row.hourly_rate || 0),
        monthlySalary: Number(row.monthly_salary || 0),
        payrollActive: row.payroll_active !== false,
      })),
    });
  } catch (error) {
    console.error("Personel ücret ayarları GET hatası:", error);
    return NextResponse.json({ error: "Personel ücret ayarları alınamadı." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await context();
    if (!ctx) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekiyor." }, { status: 403 });
    const body = await request.json();
    const staffId = String(body?.staffId || "");
    const payType = String(body?.payType || "per_lesson");
    if (!staffId || !payTypes.has(payType)) return NextResponse.json({ error: "Ücret modeli veya personel bilgisi geçersiz." }, { status: 400 });

    const safeAmount = (value: unknown) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
    const { data, error } = await ctx.admin
      .from("staff")
      .update({
        pay_type: payType,
        per_lesson_rate: safeAmount(body?.perLessonRate),
        hourly_rate: safeAmount(body?.hourlyRate),
        monthly_salary: safeAmount(body?.monthlySalary),
        payroll_active: Boolean(body?.payrollActive),
        updated_at: new Date().toISOString(),
      })
      .eq("id", staffId)
      .eq("organization_id", ctx.organizationId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Personel ücret ayarları POST hatası:", error);
    return NextResponse.json({ error: "Ücret ayarları kaydedilemedi." }, { status: 500 });
  }
}

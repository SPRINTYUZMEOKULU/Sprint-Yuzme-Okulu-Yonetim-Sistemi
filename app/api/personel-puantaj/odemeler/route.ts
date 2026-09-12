import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Role = "owner" | "admin" | "branch_manager" | "registration_staff" | "accounting" | "coach" | "guardian" | "pending";
const paymentRoles: Role[] = ["owner", "admin", "branch_manager", "accounting"];
const deleteRoles: Role[] = ["owner", "admin"];

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase sunucu değişkenleri eksik.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = adminClient();
  const { data: profile } = await admin.from("profiles").select("id, role, organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return null;
  return { user, role: String(profile.role) as Role, organizationId: String(profile.organization_id), admin };
}

function monthKey(input?: string | null) {
  if (input && /^\d{4}-\d{2}$/.test(input)) return input;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value || "2026";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  return `${y}-${m}`;
}

function minutes(time: string | null | undefined) {
  if (!time) return 0;
  const [h, m] = String(time).slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function computeAmount(person: any, lessonCount: number, totalMinutes: number) {
  const type = String(person.pay_type || "per_lesson");
  const perLesson = Number(person.per_lesson_rate || 0);
  const hourly = Number(person.hourly_rate || 0);
  const salary = Number(person.monthly_salary || 0);
  let amount = 0;
  if (type === "per_lesson") amount = lessonCount * perLesson;
  else if (type === "hourly") amount = (totalMinutes / 60) * hourly;
  else if (type === "monthly") amount = salary;
  else if (type === "monthly_plus_lesson") amount = salary + lessonCount * perLesson;
  return Math.round(amount * 100) / 100;
}

async function buildRows(ctx: NonNullable<Awaited<ReturnType<typeof getContext>>>, month: string) {
  const start = `${month}-01`;
  const [year, monthNo] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  const [{ data: staffRows }, { data: checkins }, { data: periods }] = await Promise.all([
    ctx.admin.from("staff").select("id, first_name, last_name, title, pay_type, per_lesson_rate, hourly_rate, monthly_salary, payroll_active").eq("organization_id", ctx.organizationId).eq("is_active", true).eq("payroll_active", true),
    ctx.admin.from("staff_checkins").select("staff_id, planned_start, planned_end, approval_status").eq("organization_id", ctx.organizationId).gte("lesson_date", start).lte("lesson_date", end).in("approval_status", ["auto_approved", "approved"]),
    ctx.admin.from("staff_payroll_periods").select("id, staff_id, period_month, pay_type, approved_lesson_count, approved_minutes, base_amount, adjustment_amount, total_amount, status, paid_amount, payment_method, paid_at, archived_at, payment_note, closed_at").eq("organization_id", ctx.organizationId).eq("period_month", start),
  ]);
  const periodMap = new Map((periods || []).map((p: any) => [String(p.staff_id), p]));
  return (staffRows || []).map((person: any) => {
    const mine = (checkins || []).filter((c: any) => String(c.staff_id) === String(person.id));
    const lessonCount = mine.length;
    const totalMinutes = mine.reduce((sum: number, c: any) => sum + Math.max(0, minutes(c.planned_end) - minutes(c.planned_start)), 0);
    const liveAmount = computeAmount(person, lessonCount, totalMinutes);
    const period: any = periodMap.get(String(person.id));
    const locked = period && ["awaiting_payment", "paid", "archived"].includes(String(period.status));
    const adjustment = Number(period?.adjustment_amount || 0);
    const total = locked ? Number(period.total_amount || 0) : Math.round((liveAmount + adjustment) * 100) / 100;
    return {
      staffId: person.id,
      staffName: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
      title: person.title || "Personel",
      payType: person.pay_type || "per_lesson",
      lessonCount: locked ? Number(period.approved_lesson_count || 0) : lessonCount,
      totalMinutes: locked ? Number(period.approved_minutes || 0) : totalMinutes,
      baseAmount: locked ? Number(period.base_amount || 0) : liveAmount,
      adjustmentAmount: adjustment,
      totalAmount: total,
      periodId: period?.id || null,
      status: period?.status || "draft",
      paidAmount: Number(period?.paid_amount || 0),
      paymentMethod: period?.payment_method || null,
      paidAt: period?.paid_at || null,
      archivedAt: period?.archived_at || null,
      paymentNote: period?.payment_note || null,
      closedAt: period?.closed_at || null,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getContext();
    if (!ctx || !paymentRoles.includes(ctx.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    const month = monthKey(request.nextUrl.searchParams.get("month"));
    const rows = await buildRows(ctx, month);
    const active = rows.filter((r: any) => r.status !== "archived");
    return NextResponse.json({
      month,
      canDeleteArchive: deleteRoles.includes(ctx.role),
      rows,
      summary: {
        total: active.reduce((s: number, r: any) => s + Number(r.totalAmount || 0), 0),
        paid: rows.reduce((s: number, r: any) => s + Number(r.paidAmount || 0), 0),
        pending: active.filter((r: any) => r.status === "awaiting_payment").reduce((s: number, r: any) => s + Number(r.totalAmount || 0), 0),
        archived: rows.filter((r: any) => r.status === "archived").reduce((s: number, r: any) => s + Number(r.paidAmount || r.totalAmount || 0), 0),
      },
    });
  } catch (error) {
    console.error("Personel ödeme GET hatası:", error);
    return NextResponse.json({ error: "Personel ödeme verileri alınamadı." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getContext();
    if (!ctx || !paymentRoles.includes(ctx.role)) return NextResponse.json({ error: "Bu işlem için ödeme yetkisi gerekiyor." }, { status: 403 });
    const body = await request.json();
    const action = String(body?.action || "");
    const staffId = String(body?.staffId || "");
    const month = monthKey(body?.month ? String(body.month) : null);
    if (!staffId) return NextResponse.json({ error: "Personel seçilmedi." }, { status: 400 });
    const rows = await buildRows(ctx, month);
    const row: any = rows.find((r: any) => String(r.staffId) === staffId);
    if (!row) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
    const periodMonth = `${month}-01`;
    const now = new Date().toISOString();

    if (action === "delete_archive") {
      if (!deleteRoles.includes(ctx.role)) return NextResponse.json({ error: "Arşiv kaydını yalnızca kurucu yönetici veya yönetici silebilir." }, { status: 403 });
      if (row.status !== "archived" || !row.periodId) return NextResponse.json({ error: "Yalnızca arşivlenmiş ödeme kaydı silinebilir." }, { status: 400 });
      const { error } = await ctx.admin.from("staff_payroll_periods").delete().eq("id", row.periodId).eq("organization_id", ctx.organizationId).eq("staff_id", staffId).eq("period_month", periodMonth).eq("status", "archived");
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "close_period") {
      if (["paid", "archived"].includes(row.status)) return NextResponse.json({ error: "Ödenmiş veya arşivlenmiş dönem değiştirilemez." }, { status: 400 });
      const adjustment = Number(body?.adjustmentAmount || 0);
      const total = Math.round((Number(row.baseAmount || 0) + adjustment) * 100) / 100;
      const payload = {
        organization_id: ctx.organizationId,
        staff_id: staffId,
        period_month: periodMonth,
        pay_type: row.payType,
        approved_lesson_count: row.lessonCount,
        approved_minutes: row.totalMinutes,
        base_amount: row.baseAmount,
        adjustment_amount: adjustment,
        total_amount: total,
        status: "awaiting_payment",
        closed_by: ctx.user.id,
        closed_at: now,
        note: body?.note ? String(body.note) : null,
        updated_at: now,
      };
      const { error } = await ctx.admin.from("staff_payroll_periods").upsert(payload, { onConflict: "staff_id,period_month" });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "mark_paid") {
      if (row.status !== "awaiting_payment") return NextResponse.json({ error: "Ödeme yapmadan önce hakedişi kesinleştirin." }, { status: 400 });
      const amount = Number(body?.paidAmount ?? row.totalAmount);
      if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Geçerli ödeme tutarı girin." }, { status: 400 });
      const { error } = await ctx.admin.from("staff_payroll_periods").update({
        status: "paid",
        paid_amount: amount,
        payment_method: body?.paymentMethod ? String(body.paymentMethod) : "bank_transfer",
        payment_note: body?.paymentNote ? String(body.paymentNote) : null,
        paid_by: ctx.user.id,
        paid_at: now,
        updated_at: now,
      }).eq("organization_id", ctx.organizationId).eq("staff_id", staffId).eq("period_month", periodMonth);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "archive") {
      if (row.status !== "paid") return NextResponse.json({ error: "Yalnızca ödenmiş hakediş arşivlenebilir." }, { status: 400 });
      const { error } = await ctx.admin.from("staff_payroll_periods").update({ status: "archived", archived_by: ctx.user.id, archived_at: now, updated_at: now }).eq("organization_id", ctx.organizationId).eq("staff_id", staffId).eq("period_month", periodMonth);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    console.error("Personel ödeme POST hatası:", error);
    return NextResponse.json({ error: "Personel ödeme işlemi tamamlanamadı." }, { status: 500 });
  }
}

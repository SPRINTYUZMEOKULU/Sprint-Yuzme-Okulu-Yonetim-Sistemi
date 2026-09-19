import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { requireProfile } from "@/lib/auth/profile";
import { filterEffectivelyActiveSchedules } from "@/lib/schedules/effective";

const ROLES = ["owner","admin","branch_manager","registration_staff","accounting","coach"] as const;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function monthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) return null;
  const start = `${year}-${String(m).padStart(2,"0")}-01`;
  const endDate = new Date(Date.UTC(year, m, 0));
  const end = `${year}-${String(m).padStart(2,"0")}-${String(endDate.getUTCDate()).padStart(2,"0")}`;
  return { year, month: m, start, end };
}

function weekdayIso(date: string) {
  const d = new Date(`${date}T12:00:00+03:00`).getDay();
  return d === 0 ? 7 : d;
}

const HOLIDAYS_2026 = [
  ["2026-01-01","Yılbaşı","holiday"],
  ["2026-03-19","Ramazan Bayramı Arefesi","holiday"],
  ["2026-03-20","Ramazan Bayramı 1. Gün","holiday"],
  ["2026-03-21","Ramazan Bayramı 2. Gün","holiday"],
  ["2026-03-22","Ramazan Bayramı 3. Gün","holiday"],
  ["2026-04-23","Ulusal Egemenlik ve Çocuk Bayramı","holiday"],
  ["2026-05-01","Emek ve Dayanışma Günü","holiday"],
  ["2026-05-19","Atatürk'ü Anma, Gençlik ve Spor Bayramı","holiday"],
  ["2026-05-26","Kurban Bayramı Arefesi","holiday"],
  ["2026-05-27","Kurban Bayramı 1. Gün","holiday"],
  ["2026-05-28","Kurban Bayramı 2. Gün","holiday"],
  ["2026-05-29","Kurban Bayramı 3. Gün","holiday"],
  ["2026-05-30","Kurban Bayramı 4. Gün","holiday"],
  ["2026-07-15","Demokrasi ve Millî Birlik Günü","holiday"],
  ["2026-08-30","Zafer Bayramı","holiday"],
  ["2026-10-28","Cumhuriyet Bayramı Arefesi","holiday"],
  ["2026-10-29","Cumhuriyet Bayramı","holiday"],
] as const;

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const organizationId = profile.organization_id;
    const now = new Date();
    const defaultMonth = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit"}).format(now).slice(0,7);
    const bounds = monthBounds(String(request.nextUrl.searchParams.get("month") || defaultMonth));
    if (!organizationId || !bounds) {
      return NextResponse.json({ ok:false, error:"Geçerli ay bilgisi bulunamadı." }, { status:400 });
    }

    const supabase = adminClient();
    const [branchesResult, groupsResult, schedulesResult, eventsResult, studentsResult, dueRemindersResult] = await Promise.all([
      supabase.from("branches").select("id,name,is_active").eq("organization_id", organizationId).eq("is_active", true),
      supabase.from("training_groups").select("id,branch_id,name,is_active").eq("organization_id", organizationId).eq("is_active", true),
      supabase.from("lesson_schedules").select("id,branch_id,group_id,weekday,start_time,end_time,is_active").eq("organization_id", organizationId).eq("is_active", true),
      supabase.from("calendar_events").select("*").eq("organization_id", organizationId).gte("event_date", bounds.start).lte("event_date", bounds.end).neq("status","cancelled").order("event_date").order("start_time"),
      supabase.from("students").select("id,first_name,last_name,birth_date,status").eq("organization_id", organizationId).eq("status","active"),
      supabase.from("calendar_events").select("id,title,description,event_date,reminder_at").eq("organization_id", organizationId).eq("status","active").is("reminder_sent_at", null).not("reminder_at","is",null).lte("reminder_at", new Date().toISOString()).limit(20),
    ]);

    for (const row of dueRemindersResult.data || []) {
      const { data: existing } = await supabase.from("system_notifications")
        .select("id").eq("organization_id", organizationId).eq("event_key","calendar_reminder")
        .contains("metadata",{ calendar_event_id: row.id }).limit(1);
      if (!existing?.length) {
        await supabase.from("system_notifications").insert({
          organization_id: organizationId,
          category: "general",
          event_key: "calendar_reminder",
          title: row.title,
          message: row.description || `${row.event_date} tarihli takvim hatırlatması.`,
          severity: "info",
          entity_type: "calendar_event",
          entity_id: row.id,
          is_read: false,
          target_path: "/",
          created_by: profile.id,
          metadata: { calendar_event_id: row.id, event_date: row.event_date },
        });
      }
      await supabase.from("calendar_events").update({ reminder_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id).eq("organization_id", organizationId);
    }

    const branches = branchesResult.data || [];
    const groups = groupsResult.data || [];
    const schedules = filterEffectivelyActiveSchedules(schedulesResult.data || [], branches, groups);
    const branchMap = new Map(branches.map((x:any)=>[x.id,x.name]));
    const groupMap = new Map(groups.map((x:any)=>[x.id,x.name]));
    const daysInMonth = Number(bounds.end.slice(-2));
    const days:any[] = [];

    for (let day=1; day<=daysInMonth; day++) {
      const date = `${bounds.year}-${String(bounds.month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const weekday = weekdayIso(date);
      const lessons = schedules.filter((s:any)=>Number(s.weekday)===weekday).map((s:any)=>({
        id:s.id, type:"lesson", title:groupMap.get(s.group_id || "") || "Ders", branchName:branchMap.get(s.branch_id || "") || "",
        startTime:String(s.start_time || "").slice(0,5), endTime:String(s.end_time || "").slice(0,5)
      }));
      const events = (eventsResult.data || []).filter((e:any)=>e.event_date===date).map((e:any)=>({
        id:e.id,type:e.event_type,title:e.title,description:e.description,startTime:e.start_time?String(e.start_time).slice(0,5):null,
        endTime:e.end_time?String(e.end_time).slice(0,5):null,reminderAt:e.reminder_at
      }));
      const birthdays = (studentsResult.data || []).filter((s:any)=>{
        if(!s.birth_date) return false;
        const md=String(s.birth_date).slice(5,10);
        return md===date.slice(5,10);
      }).map((s:any)=>({id:`birthday-${s.id}`,type:"birthday",title:`${s.first_name || ""} ${s.last_name || ""}`.trim()}));
      const holidays = HOLIDAYS_2026.filter(([d])=>d===date).map(([d,title,type])=>({id:`holiday-${d}`,type,title}));
      days.push({ date, lessons, events, birthdays, holidays });
    }

    return NextResponse.json({ ok:true, month:`${bounds.year}-${String(bounds.month).padStart(2,"0")}`, days });
  } catch (error:any) {
    return NextResponse.json({ ok:false, error:error?.message || "Takvim yüklenemedi." }, { status:500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const organizationId = profile.organization_id;
    const body = await request.json();
    const eventDate = String(body.eventDate || "");
    const title = String(body.title || "").trim().slice(0,160);
    const eventType = ["note","event","reminder","holiday","pool_closure"].includes(body.eventType) ? body.eventType : "note";
    if (!organizationId || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !title) {
      return NextResponse.json({ ok:false,error:"Tarih ve başlık zorunludur." }, { status:400 });
    }
    const supabase=adminClient();
    const reminderAt = body.reminderAt ? new Date(body.reminderAt).toISOString() : null;
    const { data,error } = await supabase.from("calendar_events").insert({
      organization_id: organizationId,
      event_type: eventType,
      title,
      description: String(body.description || "").trim().slice(0,1500) || null,
      event_date: eventDate,
      start_time: body.startTime || null,
      end_time: body.endTime || null,
      reminder_at: reminderAt,
      created_by: profile.id,
    }).select("*").single();
    if(error) throw error;
    return NextResponse.json({ok:true,event:data,message:"Takvim kaydı oluşturuldu."});
  } catch(error:any) {
    return NextResponse.json({ok:false,error:error?.message || "Takvim kaydı oluşturulamadı."},{status:500});
  }
}

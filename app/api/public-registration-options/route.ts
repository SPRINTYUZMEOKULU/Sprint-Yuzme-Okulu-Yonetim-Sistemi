import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Bağlantı ayarları eksik." }, { status: 500 });

    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: organization } = await supabase.from("organizations").select("id").eq("name", "Sprint Yüzme Okulu").single();
    if (!organization) return NextResponse.json({ error: "Kurum bulunamadı." }, { status: 404 });

    const [{ data: branches }, { data: groups }, { data: schedules }, { data: packages }, { data: levels }] = await Promise.all([
      supabase.from("branches").select("id,name").eq("organization_id", organization.id).eq("is_active", true).order("name"),
      supabase.from("training_groups").select("id,branch_id,level_id,name,capacity,course_type,description,sort_order").eq("organization_id", organization.id).eq("is_active", true).eq("public_registration", true).order("sort_order").order("name"),
      supabase.from("lesson_schedules").select("id,group_id,weekday,start_time,end_time").eq("organization_id", organization.id).eq("is_active", true).order("weekday").order("start_time"),
      supabase.from("course_packages").select("id,name,lesson_count,price").eq("organization_id", organization.id).eq("is_active", true).order("lesson_count"),
      supabase.from("swimming_levels").select("id,name,sort_order").eq("organization_id", organization.id).eq("is_active", true).order("sort_order")
    ]);

    return NextResponse.json({ branches: branches || [], groups: groups || [], schedules: schedules || [], packages: packages || [], levels: levels || [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Kayıt seçenekleri yüklenemedi." }, { status: 500 });
  }
}

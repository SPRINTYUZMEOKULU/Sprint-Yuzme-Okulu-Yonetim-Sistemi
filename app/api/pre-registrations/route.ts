import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Payload = Record<string, string | undefined>;

function clean(value: unknown, max = 250) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Payload;
    if (clean(body.website)) return NextResponse.json({ ok: true });

    const firstName = clean(body.firstName, 60);
    const lastName = clean(body.lastName, 60);
    const guardianName = clean(body.guardianName, 120);
    const phone = clean(body.phone, 20);
    const branchName = clean(body.branchName, 120);
    const branchId = clean(body.branchId, 60);
    const groupId = clean(body.groupId, 60);
    const packageId = clean(body.packageId, 60);

    if (!firstName || !lastName || !guardianName || !phone || !branchId || !groupId || !packageId) {
      return NextResponse.json({ error: "Zorunlu alanları eksiksiz doldurun." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Sunucu bağlantısı henüz yapılandırılmadı." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: organization } = await supabase
      .from("organizations").select("id").eq("name", "Sprint Yüzme Okulu").single();
    if (!organization) throw new Error("Kurum kaydı bulunamadı.");

    const { data: branch } = await supabase
      .from("branches").select("id,name")
      .eq("organization_id", organization.id).eq("id", branchId).single();
    if (!branch) throw new Error("Şube kaydı bulunamadı.");

    const { data: group } = await supabase.from("training_groups").select("id,name,branch_id,is_active,public_registration").eq("organization_id", organization.id).eq("id", groupId).single();
    if (!group || group.branch_id !== branch.id || !group.is_active || !group.public_registration) throw new Error("Seçilen grup artık ön kayda açık değil.");

    const { data: coursePackage } = await supabase.from("course_packages").select("id,name,is_active").eq("organization_id", organization.id).eq("id", packageId).single();
    if (!coursePackage || !coursePackage.is_active) throw new Error("Seçilen paket artık aktif değil.");

    const { data: guardian, error: guardianError } = await supabase
      .from("guardians")
      .insert({
        organization_id: organization.id,
        full_name: guardianName,
        phone,
        email: clean(body.email, 160) || null,
        relationship: "Veli",
        whatsapp_permission: body.whatsappPermission === "true"
      })
      .select("id").single();
    if (guardianError || !guardian) throw guardianError || new Error("Veli kaydı oluşturulamadı.");

    const { data: student, error: studentError } = await supabase
      .from("students")
      .insert({
        organization_id: organization.id,
        branch_id: branch.id,
        first_name: firstName,
        last_name: lastName,
        birth_date: clean(body.birthDate, 10) || null,
        status: "pre_registration",
        swimming_level: clean(body.swimmingLevel, 100) || null,
        preferred_days: clean(body.preferredDays, 100) || null,
        preferred_time: clean(body.preferredTime, 100) || null,
        registration_source: "web_form",
        registration_note: clean(body.note, 1000) || null,
        preferred_group_id: group.id,
        preferred_package_id: coursePackage.id
      })
      .select("id").single();

    if (studentError || !student) {
      await supabase.from("guardians").delete().eq("id", guardian.id);
      throw studentError || new Error("Öğrenci kaydı oluşturulamadı.");
    }

    const { error: relationError } = await supabase
  .from("guardian_students")
  .insert({
    guardian_id: guardian.id,
    student_id: student.id,
    relationship: "Veli",
    is_primary: true,
  });
    if (relationError) throw relationError;

    await supabase.from("alerts").insert({
      organization_id: organization.id,
      branch_id: branch.id,
      student_id: student.id,
      alert_type: "new_pre_registration",
      title: "Yeni ön kayıt geldi",
      description: `${firstName} ${lastName}, ${branch.name} / ${group.name} / ${coursePackage.name} tercihiyle ön kayıt oluşturdu.`,
      priority: "important",
      status: "open",
      action_label: "Öğrenciyi Gör",
      deduplication_key: `new-pre-registration-${student.id}`
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Ön kayıt alınamadı. Lütfen daha sonra tekrar deneyin." },
      { status: 500 }
    );
  }
}

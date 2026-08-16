import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Payload = Record<string, string | undefined>;

function clean(value: unknown, max = 250) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function getIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip") || null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Payload;

    // Bot tuzağı
    if (clean(body.website)) {
      return NextResponse.json({ ok: true });
    }

    const registrationFor =
      clean(body.registrationFor, 20) === "adult"
        ? "adult"
        : "child";

    const firstName = clean(body.firstName, 60);
    const lastName = clean(body.lastName, 60);

    const birthDate =
      clean(body.birthDate, 10) || null;

    const guardianName =
      registrationFor === "child"
        ? clean(body.guardianName, 120)
        : "";

    const phone = clean(body.phone, 20);

    const branchId = clean(body.branchId, 60);
    const groupId = clean(body.groupId, 60);
    const packageId = clean(body.packageId, 60);

    const courseType = clean(body.courseType, 100);

    const swimmingLevel =
      clean(body.swimmingLevel, 100) || null;

    const preferredDays =
      clean(body.preferredDays, 150) || null;

    const preferredTime =
      clean(body.preferredTime, 100) || null;

    const note =
      clean(body.note, 1000) || null;

    const contactRequest =
      clean(body.contactRequest, 100) || null;

    const rulesAccepted =
      body.rulesAccepted === "true";

    const whatsappPermission =
      body.whatsappPermission === "true";

    /*
     * TEMEL ZORUNLULUKLAR
     */

    if (!firstName || !lastName || !phone) {
      return NextResponse.json(
        {
          error:
            "Ad, soyad ve telefon bilgilerini eksiksiz doldurun.",
        },
        { status: 400 }
      );
    }

    if (
      registrationFor === "child" &&
      !guardianName
    ) {
      return NextResponse.json(
        {
          error:
            "Çocuk kaydında veli adı soyadı zorunludur.",
        },
        { status: 400 }
      );
    }

    if (!branchId || !groupId) {
      return NextResponse.json(
        {
          error:
            "Şube ve grup seçimini tamamlayın.",
        },
        { status: 400 }
      );
    }

    if (!rulesAccepted) {
      return NextResponse.json(
        {
          error:
            "Ön kayıt oluşturabilmek için Sprint Yüzme Okulu kurallarını okuyup kabul etmeniz gerekiyor.",
        },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Sunucu bağlantısı henüz yapılandırılmadı.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    /*
     * ORGANİZASYON
     */

    const {
      data: organization,
      error: organizationError,
    } = await supabase
      .from("organizations")
      .select("id")
      .eq("name", "Sprint Yüzme Okulu")
      .single();

    if (organizationError || !organization) {
      throw (
        organizationError ||
        new Error("Kurum kaydı bulunamadı.")
      );
    }

    /*
     * ŞUBE
     */

    const {
      data: branch,
      error: branchError,
    } = await supabase
      .from("branches")
      .select("id,name")
      .eq("organization_id", organization.id)
      .eq("id", branchId)
      .single();

    if (branchError || !branch) {
      throw (
        branchError ||
        new Error("Şube kaydı bulunamadı.")
      );
    }

    /*
     * GRUP
     */

    const {
      data: group,
      error: groupError,
    } = await supabase
      .from("training_groups")
      .select(
        "id,name,branch_id,is_active,public_registration,course_type"
      )
      .eq("organization_id", organization.id)
      .eq("id", groupId)
      .single();

    if (
      groupError ||
      !group ||
      group.branch_id !== branch.id ||
      !group.is_active ||
      !group.public_registration
    ) {
      return NextResponse.json(
        {
          error:
            "Seçilen grup artık ön kayda açık değil.",
        },
        { status: 400 }
      );
    }

    /*
     * PAKET OPSİYONEL
     */

    let coursePackage:
      | {
          id: string;
          name: string;
          lesson_count?: number;
        }
      | null = null;

    if (packageId) {
      const {
        data,
        error,
      } = await supabase
        .from("course_packages")
        .select("id,name,lesson_count,is_active")
        .eq("organization_id", organization.id)
        .eq("id", packageId)
        .single();

      if (
        error ||
        !data ||
        !data.is_active
      ) {
        return NextResponse.json(
          {
            error:
              "Seçilen paket artık aktif değil.",
          },
          { status: 400 }
        );
      }

      coursePackage = data;
    }

    /*
     * ÖĞRENCİYİ OLUŞTUR
     *
     * DİKKAT:
     * Telefon ve veli bilgilerini students tablosuna da
     * yazıyoruz. Böylece Öğrenci Dosyası doğrudan çekebilir.
     */

    const {
      data: student,
      error: studentError,
    } = await supabase
      .from("students")
      .insert({
        organization_id: organization.id,

        branch_id: branch.id,

        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,

        phone,

        guardian_name:
          registrationFor === "child"
            ? guardianName
            : null,

        guardian_phone:
          registrationFor === "child"
            ? phone
            : null,

        status: "pre_registration",

        swimming_level: swimmingLevel,

        preferred_days: preferredDays,
        preferred_time: preferredTime,

        registration_source: "web_form",

        registration_note: note,

        preferred_group_id: group.id,

        preferred_package_id:
          coursePackage?.id || null,
      })
      .select("id")
      .single();

    if (studentError || !student) {
      throw (
        studentError ||
        new Error(
          "Öğrenci kaydı oluşturulamadı."
        )
      );
    }

    /*
     * ÇOCUK KAYDIYSA AYRICA GUARDIAN KAYDI
     */

    let guardianId: string | null = null;

    if (registrationFor === "child") {
      const {
        data: guardian,
        error: guardianError,
      } = await supabase
        .from("guardians")
        .insert({
          organization_id: organization.id,

          full_name: guardianName,

          phone,

          relationship: "Veli",

          whatsapp_permission:
            whatsappPermission,
        })
        .select("id")
        .single();

      if (
        guardianError ||
        !guardian
      ) {
        /*
         * Öğrenci oluşturuldu ama veli oluşturulamadı.
         * Yarım kayıt bırakmıyoruz.
         */

        await supabase
          .from("students")
          .delete()
          .eq("id", student.id);

        throw (
          guardianError ||
          new Error(
            "Veli kaydı oluşturulamadı."
          )
        );
      }

      guardianId = guardian.id;

      const {
        error: relationError,
      } = await supabase
        .from("guardian_students")
        .insert({
          guardian_id: guardian.id,

          student_id: student.id,

          relationship: "Veli",

          is_primary: true,
        });

      if (relationError) {
        await supabase
          .from("guardians")
          .delete()
          .eq("id", guardian.id);

        await supabase
          .from("students")
          .delete()
          .eq("id", student.id);

        throw relationError;
      }
    }

    /*
     * ELEKTRONİK KABUL SNAPSHOT
     */

    const acceptedAt =
      new Date().toISOString();

    const ipAddress =
      getIp(request);

    const userAgent =
      request.headers.get("user-agent");

    const snapshot = {
      registration_for: registrationFor,

      student: {
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,
        phone,
      },

      guardian:
        registrationFor === "child"
          ? {
              full_name: guardianName,
              phone,
            }
          : null,

      course: {
        course_type:
          courseType ||
          group.course_type ||
          null,

        branch_id: branch.id,
        branch_name: branch.name,

        group_id: group.id,
        group_name: group.name,

        package_id:
          coursePackage?.id || null,

        package_name:
          coursePackage?.name || null,

        preferred_days: preferredDays,
        preferred_time: preferredTime,

        swimming_level:
          swimmingLevel,
      },

      contact_request:
        contactRequest,

      note,

      consents: {
        rules_accepted:
          rulesAccepted,

        whatsapp_permission:
          whatsappPermission,
      },
    };

    const {
      error: consentError,
    } = await supabase
      .from("registration_consents")
      .insert({
        organization_id:
          organization.id,

        student_id:
          student.id,

        registration_for:
          registrationFor,

        rules_accepted:
          rulesAccepted,

        whatsapp_permission:
          whatsappPermission,

        contact_request:
          contactRequest,

        rules_version:
          "SPRINT-KURALLAR-v1",

        form_version:
          "SPRINT-ONKAYIT-v1",

        accepted_at:
          acceptedAt,

        ip_address:
          ipAddress,

        user_agent:
          userAgent,

        form_snapshot:
          snapshot,
      });

    if (consentError) {
      console.error(
        "registration consent error:",
        consentError
      );

      /*
       * Kabul kaydı kritik olduğu için
       * ön kaydı başarılı saymıyoruz.
       */

      if (guardianId) {
        await supabase
          .from("guardian_students")
          .delete()
          .eq(
            "student_id",
            student.id
          );

        await supabase
          .from("guardians")
          .delete()
          .eq(
            "id",
            guardianId
          );
      }

      await supabase
        .from("students")
        .delete()
        .eq("id", student.id);

      throw new Error(
        `Elektronik kabul kaydı oluşturulamadı: ${consentError.message}`
      );
    }

    /*
     * YÖNETİM UYARISI
     */

    const requestText =
      contactRequest === "call_me"
        ? " · Aranmak istiyor"
        : contactRequest ===
            "whatsapp_info"
        ? " · WhatsApp bilgisi istiyor"
        : contactRequest ===
            "ready_to_start"
        ? " · Kayıt sonrası doğrudan başlamak istiyor"
        : contactRequest ===
            "need_information"
        ? " · Detaylı bilgi istiyor"
        : "";

    await supabase
      .from("alerts")
      .insert({
        organization_id:
          organization.id,

        branch_id:
          branch.id,

        student_id:
          student.id,

        alert_type:
          "new_pre_registration",

        title:
          registrationFor === "adult"
            ? "Yeni yetişkin ön kaydı geldi"
            : "Yeni çocuk ön kaydı geldi",

        description:
          `${firstName} ${lastName}, ` +
          `${branch.name} / ${group.name}` +
          `${
            coursePackage
              ? ` / ${coursePackage.name}`
              : ""
          } tercihiyle ön kayıt oluşturdu.` +
          requestText,

        priority:
          contactRequest ===
          "ready_to_start"
            ? "important"
            : "normal",

        status:
          "open",

        action_label:
          "Öğrenciyi Gör",

        deduplication_key:
          `new-pre-registration-${student.id}`,
      });

    /*
     * ÖĞRENCİ İŞLEM GEÇMİŞİ
     */

    await supabase
      .from("student_activity_logs")
      .insert({
        organization_id:
          organization.id,

        student_id:
          student.id,

        activity_type:
          "pre_registration_created",

        title:
          "Ön kayıt oluşturuldu",

        description:
          `${branch.name} / ${group.name} için web ön kaydı oluşturuldu.`,

        new_value:
          snapshot,

        source_type:
          "web_pre_registration",

        source_id:
          student.id,

        performed_at:
          acceptedAt,
      });

    return NextResponse.json({
      ok: true,

      studentId:
        student.id,

      registrationFor,

      acceptedAt,
    });
  } catch (error) {
    console.error(
      "pre-registration POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ön kayıt alınamadı. Lütfen daha sonra tekrar deneyin.",
      },
      { status: 500 }
    );
  }
}

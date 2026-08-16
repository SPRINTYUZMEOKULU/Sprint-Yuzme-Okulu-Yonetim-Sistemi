import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CustomResponseInput = {
  field_id?: unknown;
  field_key?: unknown;
  field_label?: unknown;
  value?: unknown;
};

type Payload = Record<string, unknown> & {
  customResponses?: unknown;
};

type FormField = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_visible: boolean;
  is_required: boolean;
  is_system: boolean;
  applies_to: "all" | "child" | "adult";
};

function clean(value: unknown, max = 250) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function getIp(request: Request) {
  const forwarded =
    request.headers.get("x-forwarded-for");

  if (forwarded) {
    return (
      forwarded.split(",")[0]?.trim() ||
      null
    );
  }

  return (
    request.headers.get("x-real-ip") ||
    null
  );
}

function cleanCustomValue(
  value: unknown
): string | string[] | boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().slice(0, 4000);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? item.trim().slice(0, 500)
          : ""
      )
      .filter(Boolean)
      .slice(0, 50);
  }

  return null;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as Payload;

    /*
     * BOT TUZAĞI
     */
    if (clean(body.website)) {
      return NextResponse.json({
        ok: true,
      });
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "Sunucu bağlantısı henüz yapılandırılmadı.",
        },
        {
          status: 500,
        }
      );
    }

    const supabase =
      createClient(
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
     * =====================================================
     * ORGANİZASYON
     * =====================================================
     */

    const {
      data: organization,
      error: organizationError,
    } = await supabase
      .from("organizations")
      .select("id")
      .eq(
        "name",
        "Sprint Yüzme Okulu"
      )
      .single();

    if (
      organizationError ||
      !organization
    ) {
      throw (
        organizationError ||
        new Error(
          "Kurum kaydı bulunamadı."
        )
      );
    }

    /*
     * =====================================================
     * CANLI FORM AYARLARI
     * =====================================================
     */

    const {
      data: rawFormFields,
      error: formFieldsError,
    } = await supabase
      .from("registration_form_fields")
      .select(
        `
        id,
        field_key,
        label,
        field_type,
        is_visible,
        is_required,
        is_system,
        applies_to
        `
      )
      .eq(
        "organization_id",
        organization.id
      );

    if (formFieldsError) {
      throw new Error(
        `Form ayarları okunamadı: ${formFieldsError.message}`
      );
    }

    const formFields =
      (rawFormFields || []) as FormField[];

    const registrationFor =
      clean(
        body.registrationFor,
        20
      ) === "adult"
        ? "adult"
        : "child";

    function applicable(
      field:
        | FormField
        | undefined
    ) {
      if (!field) {
        return false;
      }

      return (
        field.applies_to === "all" ||
        field.applies_to ===
          registrationFor
      );
    }

    function getField(
      key: string
    ) {
      return formFields.find(
        (field) =>
          field.field_key === key
      );
    }

    function visible(
      key: string,
      fallback = true
    ) {
      const field =
        getField(key);

      if (!field) {
        return fallback;
      }

      return (
        field.is_visible &&
        applicable(field)
      );
    }

    function required(
      key: string,
      fallback = false
    ) {
      const field =
        getField(key);

      if (!field) {
        return fallback;
      }

      return (
        field.is_visible &&
        field.is_required &&
        applicable(field)
      );
    }

    /*
     * =====================================================
     * FORM VERİLERİ
     * =====================================================
     */

    const firstName =
      clean(body.firstName, 60);

    const lastName =
      clean(body.lastName, 60);

    const birthDate =
      clean(body.birthDate, 10) ||
      null;

    const guardianName =
      registrationFor === "child"
        ? clean(
            body.guardianName,
            120
          )
        : "";

    const phone =
      clean(body.phone, 20);

    const branchId =
      clean(body.branchId, 60);

    const groupId =
      clean(body.groupId, 60);

    const packageId =
      clean(body.packageId, 60);

    const courseType =
      clean(body.courseType, 100);

    const swimmingLevel =
      clean(
        body.swimmingLevel,
        100
      ) || null;

    const preferredDays =
      clean(
        body.preferredDays,
        150
      ) || null;

    const preferredTime =
      clean(
        body.preferredTime,
        150
      ) || null;

    const note =
      clean(body.note, 1000) ||
      null;

    const contactRequest =
      clean(
        body.contactRequest,
        100
      ) || null;

    const healthDeclaration =
      body.healthDeclaration ===
      "true";

    const healthNote =
      clean(
        body.healthNote,
        1000
      ) || null;

    const rulesAccepted =
      body.rulesAccepted ===
      "true";

    const whatsappPermission =
      body.whatsappPermission ===
      "true";

    /*
     * =====================================================
     * DİNAMİK ZORUNLU ALAN KONTROLÜ
     * =====================================================
     */

    if (
      required(
        "first_name",
        true
      ) &&
      !firstName
    ) {
      return NextResponse.json(
        {
          error:
            "Öğrenci / katılımcı adı zorunludur.",
        },
        { status: 400 }
      );
    }

    if (
      required(
        "last_name",
        true
      ) &&
      !lastName
    ) {
      return NextResponse.json(
        {
          error:
            "Soyadı zorunludur.",
        },
        { status: 400 }
      );
    }

    if (
      required(
        "birth_date",
        true
      ) &&
      !birthDate
    ) {
      return NextResponse.json(
        {
          error:
            "Doğum tarihi zorunludur.",
        },
        { status: 400 }
      );
    }

    if (
      required(
        "phone",
        true
      ) &&
      !phone
    ) {
      return NextResponse.json(
        {
          error:
            "Telefon numarası zorunludur.",
        },
        { status: 400 }
      );
    }

    if (
      registrationFor ===
        "child" &&
      required(
        "guardian_name",
        true
      ) &&
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

    if (
      required(
        "course_type",
        true
      ) &&
      !courseType
    ) {
      return NextResponse.json(
        {
          error:
            "Kurs türünü seçin.",
        },
        { status: 400 }
      );
    }

    if (
      required(
        "branch",
        true
      ) &&
      !branchId
    ) {
      return NextResponse.json(
        {
          error:
            "Şube seçimini tamamlayın.",
        },
        { status: 400 }
      );
    }

    if (
      required(
        "group",
        true
      ) &&
      !groupId
    ) {
      return NextResponse.json(
        {
          error:
            "Grup seçimini tamamlayın.",
        },
        { status: 400 }
      );
    }

    if (
      required(
        "package",
        true
      ) &&
      !packageId
    ) {
      return NextResponse.json(
        {
          error:
            "Paket tercihini seçin.",
        },
        { status: 400 }
      );
    }

    if (
      required(
        "contact_request",
        true
      ) &&
      !contactRequest
    ) {
      return NextResponse.json(
        {
          error:
            "İletişim talebinizi seçin.",
        },
        { status: 400 }
      );
    }

    if (
      required(
        "health_declaration",
        true
      ) &&
      !healthDeclaration
    ) {
      return NextResponse.json(
        {
          error:
            "Sağlık beyanını onaylamanız gerekiyor.",
        },
        { status: 400 }
      );
    }

    if (
      required(
        "rules_accepted",
        true
      ) &&
      !rulesAccepted
    ) {
      return NextResponse.json(
        {
          error:
            "Sprint Yüzme Okulu kurallarını okuyup kabul etmeniz gerekiyor.",
        },
        { status: 400 }
      );
    }

    if (
      required(
        "whatsapp_permission",
        true
      ) &&
      !whatsappPermission
    ) {
      return NextResponse.json(
        {
          error:
            "WhatsApp bilgilendirme onayını vermeniz gerekiyor.",
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * ÖZEL ALAN CEVAPLARI
     * =====================================================
     */

    const rawCustomResponses =
      Array.isArray(
        body.customResponses
      )
        ? (body.customResponses as CustomResponseInput[])
        : [];

    const customFields =
      formFields.filter(
        (field) =>
          !field.is_system &&
          field.is_visible &&
          applicable(field)
      );

    const customResponses =
      customFields.map(
        (field) => {
          const incoming =
            rawCustomResponses.find(
              (item) =>
                clean(
                  item.field_id,
                  100
                ) === field.id
            );

          const value =
            cleanCustomValue(
              incoming?.value
            );

          return {
            field,
            value,
          };
        }
      );

    for (
      const item of
      customResponses
    ) {
      if (
        item.field.is_required
      ) {
        const value =
          item.value;

        const empty =
          value === null ||
          value === "" ||
          value === false ||
          (Array.isArray(
            value
          ) &&
            value.length === 0);

        if (empty) {
          return NextResponse.json(
            {
              error:
                `"${item.field.label}" alanını doldurmanız gerekiyor.`,
            },
            {
              status: 400,
            }
          );
        }
      }
    }

    /*
     * =====================================================
     * ŞUBE / GRUP / PAKET
     * =====================================================
     */

    let branch:
      | {
          id: string;
          name: string;
        }
      | null = null;

    if (branchId) {
      const {
        data,
        error,
      } = await supabase
        .from("branches")
        .select("id,name")
        .eq(
          "organization_id",
          organization.id
        )
        .eq("id", branchId)
        .single();

      if (
        error ||
        !data
      ) {
        return NextResponse.json(
          {
            error:
              "Şube kaydı bulunamadı.",
          },
          { status: 400 }
        );
      }

      branch = data;
    }

    let group:
      | {
          id: string;
          name: string;
          branch_id: string;
          is_active: boolean;
          public_registration: boolean;
          course_type: string | null;
        }
      | null = null;

    if (groupId) {
      const {
        data,
        error,
      } = await supabase
        .from(
          "training_groups"
        )
        .select(
          "id,name,branch_id,is_active,public_registration,course_type"
        )
        .eq(
          "organization_id",
          organization.id
        )
        .eq("id", groupId)
        .single();

      if (
        error ||
        !data ||
        !data.is_active ||
        !data.public_registration
      ) {
        return NextResponse.json(
          {
            error:
              "Seçilen grup artık ön kayda açık değil.",
          },
          { status: 400 }
        );
      }

      if (
        branch &&
        data.branch_id !==
          branch.id
      ) {
        return NextResponse.json(
          {
            error:
              "Seçilen grup ile şube eşleşmiyor.",
          },
          { status: 400 }
        );
      }

      group = data;
    }

    let coursePackage:
      | {
          id: string;
          name: string;
          lesson_count: number;
          price: number;
          is_active: boolean;
        }
      | null = null;

    if (packageId) {
      const {
        data,
        error,
      } = await supabase
        .from(
          "course_packages"
        )
        .select(
          "id,name,lesson_count,price,is_active"
        )
        .eq(
          "organization_id",
          organization.id
        )
        .eq(
          "id",
          packageId
        )
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

      coursePackage =
        data;
    }

    /*
     * =====================================================
     * ÖĞRENCİ
     * =====================================================
     */

    const {
      data: student,
      error: studentError,
    } = await supabase
      .from("students")
      .insert({
        organization_id:
          organization.id,

        branch_id:
          branch?.id ||
          null,

        first_name:
          firstName,

        last_name:
          lastName,

        birth_date:
          birthDate,

        phone:
          phone || null,

        guardian_name:
          registrationFor ===
            "child"
            ? guardianName ||
              null
            : null,

        guardian_phone:
          registrationFor ===
            "child"
            ? phone ||
              null
            : null,

        status:
          "pre_registration",

        swimming_level:
          swimmingLevel,

        preferred_days:
          preferredDays,

        preferred_time:
          preferredTime,

        registration_source:
          "web_form",

        registration_note:
          note,

        preferred_group_id:
          group?.id ||
          null,

        preferred_package_id:
          coursePackage?.id ||
          null,
      })
      .select("id")
      .single();

    if (
      studentError ||
      !student
    ) {
      throw (
        studentError ||
        new Error(
          "Öğrenci kaydı oluşturulamadı."
        )
      );
    }

    /*
     * =====================================================
     * VELİ
     * =====================================================
     */

    let guardianId:
      | string
      | null = null;

    if (
      registrationFor ===
        "child" &&
      guardianName
    ) {
      const {
        data: guardian,
        error: guardianError,
      } = await supabase
        .from("guardians")
        .insert({
          organization_id:
            organization.id,

          full_name:
            guardianName,

          phone:
            phone || null,

          relationship:
            "Veli",

          whatsapp_permission:
            whatsappPermission,
        })
        .select("id")
        .single();

      if (
        guardianError ||
        !guardian
      ) {
        await supabase
          .from("students")
          .delete()
          .eq(
            "id",
            student.id
          );

        throw (
          guardianError ||
          new Error(
            "Veli kaydı oluşturulamadı."
          )
        );
      }

      guardianId =
        guardian.id;

      const {
        error:
          relationError,
      } = await supabase
        .from(
          "guardian_students"
        )
        .insert({
          guardian_id:
            guardian.id,

          student_id:
            student.id,

          relationship:
            "Veli",

          is_primary:
            true,
        });

      if (relationError) {
        await supabase
          .from("guardians")
          .delete()
          .eq(
            "id",
            guardian.id
          );

        await supabase
          .from("students")
          .delete()
          .eq(
            "id",
            student.id
          );

        throw relationError;
      }
    }

    /*
     * =====================================================
     * ÖZEL ALAN CEVAPLARINI KAYDET
     * =====================================================
     */

    const responseRows =
      customResponses
        .filter(
          (item) =>
            item.value !==
            null
        )
        .map(
          (item) => ({
            organization_id:
              organization.id,

            student_id:
              student.id,

            field_id:
              item.field.id,

            field_key:
              item.field
                .field_key,

            field_label:
              item.field
                .label,

            response_value:
              item.value,
          })
        );

    if (
      responseRows.length
    ) {
      const {
        error:
          responseError,
      } = await supabase
        .from(
          "registration_form_responses"
        )
        .insert(
          responseRows
        );

      if (
        responseError
      ) {
        if (
          guardianId
        ) {
          await supabase
            .from(
              "guardian_students"
            )
            .delete()
            .eq(
              "student_id",
              student.id
            );

          await supabase
            .from(
              "guardians"
            )
            .delete()
            .eq(
              "id",
              guardianId
            );
        }

        await supabase
          .from("students")
          .delete()
          .eq(
            "id",
            student.id
          );

        throw new Error(
          `Özel form cevapları kaydedilemedi: ${responseError.message}`
        );
      }
    }

    /*
     * =====================================================
     * ELEKTRONİK KABUL
     * =====================================================
     */

    const acceptedAt =
      new Date().toISOString();

    const ipAddress =
      getIp(request);

    const userAgent =
      request.headers.get(
        "user-agent"
      );

    const snapshot = {
      registration_for:
        registrationFor,

      student: {
        first_name:
          firstName,

        last_name:
          lastName,

        birth_date:
          birthDate,

        phone:
          phone || null,
      },

      guardian:
        registrationFor ===
          "child"
          ? {
              full_name:
                guardianName ||
                null,

              phone:
                phone ||
                null,
            }
          : null,

      course: {
        course_type:
          courseType ||
          group?.course_type ||
          null,

        branch_id:
          branch?.id ||
          null,

        branch_name:
          branch?.name ||
          null,

        group_id:
          group?.id ||
          null,

        group_name:
          group?.name ||
          null,

        package_id:
          coursePackage?.id ||
          null,

        package_name:
          coursePackage?.name ||
          null,

        package_lesson_count:
          coursePackage?.lesson_count ||
          null,

        package_price:
          coursePackage?.price ??
          null,

        preferred_days:
          preferredDays,

        preferred_time:
          preferredTime,

        swimming_level:
          swimmingLevel,
      },

      contact_request:
        contactRequest,

      note,

      health: {
        declaration:
          healthDeclaration,

        note:
          healthNote,
      },

      custom_responses:
        customResponses.map(
          (item) => ({
            field_id:
              item.field.id,

            field_key:
              item.field
                .field_key,

            field_label:
              item.field
                .label,

            value:
              item.value,
          })
        ),

      consents: {
        health_declaration:
          healthDeclaration,

        rules_accepted:
          rulesAccepted,

        whatsapp_permission:
          whatsappPermission,
      },

      technical: {
        accepted_at:
          acceptedAt,

        ip_address:
          ipAddress,

        user_agent:
          userAgent,

        form_version:
          "SPRINT-ONKAYIT-v3",

        rules_version:
          "SPRINT-KURALLAR-v1",
      },
    };

    /*
     * =====================================================
     * ELEKTRONİK ONAY KAYDI
     * =====================================================
     */

    const {
      error:
        consentError,
    } = await supabase
      .from(
        "registration_consents"
      )
      .insert({
        organization_id:
          organization.id,

        student_id:
          student.id,

        registration_for:
          registrationFor,

        health_declaration:
          healthDeclaration,

        health_note:
          healthNote,

        rules_accepted:
          rulesAccepted,

        whatsapp_permission:
          whatsappPermission,

        contact_request:
          contactRequest,

        rules_version:
          "SPRINT-KURALLAR-v1",

        form_version:
          "SPRINT-ONKAYIT-v3",

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

      if (guardianId) {
        await supabase
          .from(
            "guardian_students"
          )
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
        .eq(
          "id",
          student.id
        );

      throw new Error(
        `Elektronik kabul kaydı oluşturulamadı: ${consentError.message}`
      );
    }

    /*
     * =====================================================
     * YÖNETİM UYARISI
     * =====================================================
     */

    const requestText =
      contactRequest ===
      "call_me"
        ? " · Aranmak istiyor"
        : contactRequest ===
            "ready_to_start"
          ? " · Onay sonrası kursa başlayacak"
          : "";

    const healthText =
      healthNote
        ? " · Sağlık notu mevcut"
        : "";

    const branchText =
      branch?.name ||
      "Şube belirtilmedi";

    const groupText =
      group?.name ||
      "Grup belirtilmedi";

    const packageText =
      coursePackage?.name ||
      "Paket belirtilmedi";

    await supabase
      .from("alerts")
      .insert({
        organization_id:
          organization.id,

        branch_id:
          branch?.id ||
          null,

        student_id:
          student.id,

        alert_type:
          "new_pre_registration",

        title:
          registrationFor ===
          "adult"
            ? "Yeni yetişkin ön kaydı geldi"
            : "Yeni çocuk ön kaydı geldi",

        description:
          `${firstName} ${lastName}, ` +
          `${branchText} / ${groupText} / ${packageText} ` +
          `tercihiyle ön kayıt oluşturdu.` +
          requestText +
          healthText,

        priority:
          healthNote ||
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
     * =====================================================
     * ÖĞRENCİ İŞLEM GEÇMİŞİ
     * =====================================================
     */

    await supabase
      .from(
        "student_activity_logs"
      )
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
          `${branchText} / ${groupText} / ${packageText} için web ön kaydı oluşturuldu.`,

        new_value: {
          registration_for:
            registrationFor,

          branch_id:
            branch?.id ||
            null,

          branch_name:
            branch?.name ||
            null,

          group_id:
            group?.id ||
            null,

          group_name:
            group?.name ||
            null,

          package_id:
            coursePackage?.id ||
            null,

          package_name:
            coursePackage?.name ||
            null,

          swimming_level:
            swimmingLevel,

          preferred_days:
            preferredDays,

          preferred_time:
            preferredTime,

          contact_request:
            contactRequest,

          health_declaration:
            healthDeclaration,

          health_note_provided:
            Boolean(
              healthNote
            ),

          rules_accepted:
            rulesAccepted,

          whatsapp_permission:
            whatsappPermission,

          custom_response_count:
            customResponses.length,

          accepted_at:
            acceptedAt,
        },

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

      healthDeclaration,

      customResponseCount:
        customResponses.length,

      message:
        "Ön kayıt başarıyla oluşturuldu.",
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
      {
        status: 500,
      }
    );
  }
}

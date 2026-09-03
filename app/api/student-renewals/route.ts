import { NextRequest, NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["owner", "admin", "branch_manager", "registration_staff"] as const;

function isoDate(value: unknown) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function errorText(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Bilinmeyen hata");
  }
  return String(error || "Bilinmeyen hata");
}

function fail(step: string, error: unknown, status = 500) {
  const detail = errorText(error);
  console.error(`student renewal ${step} error`, error);
  return NextResponse.json(
    { ok: false, error: `Kayıt yenileme tamamlanamadı: ${detail}`, step },
    { status },
  );
}

function calculateEndDate(startDate: string, lessonCount: number, weekdays: number[]) {
  const selected = new Set(weekdays);
  const cursor = new Date(`${startDate}T12:00:00`);
  let count = 0;
  let guard = 0;
  while (count < lessonCount && guard < 730) {
    if (selected.has(cursor.getDay())) count += 1;
    if (count < lessonCount) cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return cursor.toISOString().slice(0, 10);
}

function formatDateTR(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function cleanPhone(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;
  return digits;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function insertEnrollmentCompat(supabase: any, initialPayload: Record<string, unknown>) {
  const payload = { ...initialPayload };
  const removed: string[] = [];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await supabase
      .from("student_enrollments")
      .insert(payload)
      .select("id")
      .single();

    if (!result.error && result.data) return { ...result, removed };

    const message = errorText(result.error);
    const match = message.match(
      /Could not find the '([^']+)' column of 'student_enrollments' in the schema cache/i,
    );
    const missingColumn = match?.[1];

    if (!missingColumn || !(missingColumn in payload)) {
      return { ...result, removed };
    }

    delete payload[missingColumn];
    removed.push(missingColumn);
    console.warn(`student renewal compatibility: ${missingColumn} omitted`);
  }

  return { data: null, error: new Error("Uyumlu kayıt şeması bulunamadı."), removed };
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const organizationId = profile.organization_id;
    const studentId = String(request.nextUrl.searchParams.get("studentId") || "");

    if (!organizationId || !studentId) {
      return NextResponse.json({ ok: false, error: "Öğrenci bilgisi eksik." }, { status: 400 });
    }

    const supabase = await createClient();
    const [packagesResult, studentResult, enrollmentResult] = await Promise.all([
      supabase
        .from("course_packages")
        .select("id,name,lesson_count,price,is_active")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("lesson_count", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("students")
        .select("id,preferred_package_id")
        .eq("organization_id", organizationId)
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("student_enrollments")
        .select("id,package_id")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (packagesResult.error) return fail("packages", packagesResult.error);
    if (studentResult.error) return fail("student", studentResult.error);
    if (enrollmentResult.error) return fail("active-enrollment", enrollmentResult.error);
    if (!studentResult.data) {
      return NextResponse.json({ ok: false, error: "Öğrenci bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      packages: packagesResult.data || [],
      selectedPackageId:
        enrollmentResult.data?.package_id ||
        studentResult.data.preferred_package_id ||
        packagesResult.data?.[0]?.id ||
        "",
    });
  } catch (error) {
    return fail("load", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const body = await request.json();
    const organizationId = profile.organization_id;
    const studentId = String(body.studentId || "");
    const startDate = isoDate(body.startDate);
    const paymentDueDate = isoDate(body.paymentDueDate) || startDate;
    const rawCustomCount = body.customLessonCount;
    const customLessonCount =
      rawCustomCount === null || rawCustomCount === undefined || rawCustomCount === ""
        ? null
        : Math.floor(Number(rawCustomCount));

    if (!organizationId || !studentId || !startDate) {
      return NextResponse.json(
        { ok: false, error: "Öğrenci ve yeni dönem başlangıç tarihi zorunludur." },
        { status: 400 },
      );
    }

    if (
      customLessonCount !== null &&
      (!Number.isInteger(customLessonCount) || customLessonCount < 1 || customLessonCount > 100)
    ) {
      return NextResponse.json(
        { ok: false, error: "Özel ders sayısı 1 ile 100 arasında tam sayı olmalıdır." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const [studentResult, enrollmentResult] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id,first_name,last_name,phone,guardian_name,guardian_phone,branch_id,preferred_group_id,preferred_package_id",
        )
        .eq("organization_id", organizationId)
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("student_enrollments")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (studentResult.error) return fail("student", studentResult.error);
    if (enrollmentResult.error) return fail("active-enrollment", enrollmentResult.error);

    const student = studentResult.data;
    const activeEnrollment = enrollmentResult.data;
    if (!student) {
      return NextResponse.json({ ok: false, error: "Öğrenci bulunamadı." }, { status: 404 });
    }

    let packageId = String(
      body.packageId || activeEnrollment?.package_id || student.preferred_package_id || "",
    );
    const groupId = String(
      body.groupId || activeEnrollment?.group_id || student.preferred_group_id || "",
    );

    if (!packageId || !groupId) {
      return NextResponse.json(
        { ok: false, error: "Yenileme için paket ve grup bilgisi eksik." },
        { status: 400 },
      );
    }

    const [packageResult, groupResult, schedulesResult] = await Promise.all([
      supabase
        .from("course_packages")
        .select("id,name,lesson_count,price,is_active")
        .eq("organization_id", organizationId)
        .eq("id", packageId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("training_groups")
        .select("id,name,branch_id,course_type")
        .eq("organization_id", organizationId)
        .eq("id", groupId)
        .maybeSingle(),
      supabase
        .from("lesson_schedules")
        .select("id,weekday,start_time,end_time")
        .eq("organization_id", organizationId)
        .eq("group_id", groupId)
        .eq("is_active", true),
    ]);

    if (packageResult.error) return fail("package", packageResult.error);
    if (groupResult.error) return fail("group", groupResult.error);
    if (schedulesResult.error) return fail("schedule", schedulesResult.error);

    let selectedPackage = packageResult.data;
    const group = groupResult.data;
    if (!selectedPackage) {
      return NextResponse.json({ ok: false, error: "Seçilen aktif paket bulunamadı." }, { status: 400 });
    }
    if (!group) {
      return NextResponse.json({ ok: false, error: "Öğrencinin aktif grubu bulunamadı." }, { status: 400 });
    }

    if (
      customLessonCount !== null &&
      (customLessonCount === 8 || customLessonCount === 12) &&
      Number(selectedPackage.lesson_count) !== customLessonCount
    ) {
      const { data: matchingPackage, error: matchingPackageError } = await supabase
        .from("course_packages")
        .select("id,name,lesson_count,price,is_active")
        .eq("organization_id", organizationId)
        .eq("lesson_count", customLessonCount)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (matchingPackageError) return fail("standard-package-match", matchingPackageError);
      if (matchingPackage) {
        selectedPackage = matchingPackage;
        packageId = matchingPackage.id;
      }
    }

    const lessonCount = customLessonCount ?? Math.floor(Number(selectedPackage.lesson_count));
    if (!Number.isInteger(lessonCount) || lessonCount < 1 || lessonCount > 100) {
      return NextResponse.json({ ok: false, error: "Yenileme ders sayısı geçersiz." }, { status: 400 });
    }

    const branchId = String(group.branch_id || student.branch_id || "");
    if (!branchId) {
      return NextResponse.json({ ok: false, error: "Yenileme için şube bilgisi eksik." }, { status: 400 });
    }

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("id", branchId)
      .maybeSingle();
    if (branchError) return fail("branch", branchError);

    const weekdays = Array.from(
      new Set(
        (schedulesResult.data || [])
          .map((row) => Number(row.weekday))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
      ),
    ).sort((a, b) => a - b);

    if (!weekdays.length) {
      return NextResponse.json(
        { ok: false, error: "Seçilen grubun aktif ders programı bulunamadı." },
        { status: 400 },
      );
    }

    const customNeedsApproval = customLessonCount !== null && lessonCount !== 8 && lessonCount !== 12;
    let approvalToConsume: any = null;

    if (customNeedsApproval) {
      const { data: approvalRows, error: approvalLookupError } = await supabase
        .from("approval_requests")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .eq("request_type", "registration_custom_lesson_count")
        .contains("new_values", { total_lessons: lessonCount })
        .order("created_at", { ascending: false })
        .limit(20);

      if (approvalLookupError) return fail("approval-lookup", approvalLookupError);

      const matchingRows = (approvalRows || []).filter((row: any) => {
        const meta = objectValue(row.metadata);
        const next = objectValue(row.new_values);
        return (
          meta.source === "student_renewal_center" &&
          next.start_date === startDate &&
          next.package_id === packageId &&
          next.group_id === groupId &&
          next.payment_due_date === paymentDueDate
        );
      });

      approvalToConsume = matchingRows.find((row: any) => {
        const meta = objectValue(row.metadata);
        return row.status === "approved" && !meta.consumed_at;
      });

      if (!approvalToConsume) {
        const pending = matchingRows.find((row: any) => row.status === "pending");
        if (pending) {
          return NextResponse.json(
            {
              ok: false,
              approvalRequired: true,
              approvalRequestId: pending.id,
              message: `${lessonCount} derslik kayıt yenileme talebi zaten yönetici onayında. Onaylandıktan sonra aynı bilgilerle yenilemeyi tekrar çalıştırın.`,
            },
            { status: 202 },
          );
        }

        const now = new Date().toISOString();
        const { data: createdApproval, error: createApprovalError } = await supabase
          .from("approval_requests")
          .insert({
            organization_id: organizationId,
            request_type: "registration_custom_lesson_count",
            request_label: "Kayıt Yenileme · Standart Dışı Ders Sayısı",
            module: "enrollment",
            priority: "high",
            student_id: studentId,
            branch_id: branchId,
            group_id: groupId,
            entity_type: "student",
            entity_id: studentId,
            requested_by: profile.id,
            reason: `${lessonCount} derslik standart dışı kayıt yenileme talebi.`,
            old_values: {
              enrollment_id: activeEnrollment?.id || null,
              total_lessons: activeEnrollment?.total_lessons || null,
            },
            new_values: {
              total_lessons: lessonCount,
              package_id: packageId,
              group_id: groupId,
              branch_id: branchId,
              start_date: startDate,
              payment_due_date: paymentDueDate,
            },
            metadata: {
              source: "student_renewal_center",
              note: String(body.note || "").trim().slice(0, 1000) || null,
            },
            status: "pending",
            requested_at: now,
            created_at: now,
          })
          .select("id")
          .single();

        if (createApprovalError) return fail("approval-create", createApprovalError);

        await supabase.from("system_notifications").insert({
          organization_id: organizationId,
          category: "approvals",
          event_key: "renewal_custom_lesson_count_requested",
          title: "Standart dışı kayıt yenileme onayı",
          message: `${student.first_name || ""} ${student.last_name || ""} için ${lessonCount} derslik yenileme onayı bekliyor.`.trim(),
          severity: "warning",
          entity_type: "approval_request",
          entity_id: createdApproval?.id || null,
          target_path: "/onay-merkezi",
          created_by: profile.id,
          is_read: false,
        });

        return NextResponse.json(
          {
            ok: false,
            approvalRequired: true,
            approvalRequestId: createdApproval?.id || null,
            message: `${lessonCount} derslik yenileme standart paket dışıdır. Talep Onay Merkezi'ne gönderildi. Yönetici onayından sonra aynı bilgilerle yenilemeyi tekrar çalıştırın.`,
          },
          { status: 202 },
        );
      }
    }

    const plannedEndDate = calculateEndDate(startDate, lessonCount, weekdays);
    const now = new Date().toISOString();

    const insertResult = await insertEnrollmentCompat(supabase, {
      organization_id: organizationId,
      student_id: studentId,
      package_id: packageId,
      group_id: groupId,
      branch_id: branchId,
      start_date: startDate,
      planned_end_date: plannedEndDate,
      payment_due_date: paymentDueDate,
      lesson_weekdays: weekdays,
      weekly_frequency: weekdays.length,
      total_lessons: lessonCount,
      used_lessons: 0,
      status: "renewal_pending",
      created_at: now,
      updated_at: now,
    });

    if (insertResult.error || !insertResult.data) {
      return fail("new-enrollment", insertResult.error || "Yeni kayıt oluşturulamadı.");
    }
    const newEnrollment = insertResult.data;

    if (activeEnrollment?.id) {
      const { error: closeError } = await supabase
        .from("student_enrollments")
        .update({ status: "completed", updated_at: now })
        .eq("organization_id", organizationId)
        .eq("id", activeEnrollment.id);
      if (closeError) {
        await supabase.from("student_enrollments").delete().eq("id", newEnrollment.id);
        return fail("close-previous-enrollment", closeError);
      }
    }

    const { error: activateError } = await supabase
      .from("student_enrollments")
      .update({ status: "active", updated_at: now })
      .eq("organization_id", organizationId)
      .eq("id", newEnrollment.id);
    if (activateError) return fail("activate-new-enrollment", activateError);

    if (approvalToConsume?.id) {
      const existingMeta = objectValue(approvalToConsume.metadata);
      await supabase
        .from("approval_requests")
        .update({
          metadata: {
            ...existingMeta,
            consumed_at: now,
            consumed_enrollment_id: newEnrollment.id,
          },
        })
        .eq("organization_id", organizationId)
        .eq("id", approvalToConsume.id);
    }

    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const recipient = cleanPhone(student.guardian_phone || student.phone);
    const packageText = customNeedsApproval
      ? `Özel ${lessonCount} Ders (referans: ${selectedPackage.name})`
      : `${selectedPackage.name} (${lessonCount} ders)`;
    const renewalMessage =
      `Merhaba${student.guardian_name ? ` ${student.guardian_name}` : ""},\n\n` +
      `${studentName} öğrencimizin Sprint Yüzme Okulu kaydı başarıyla yenilenmiştir.\n\n` +
      `*Yeni Dönem Bilgileri*\n` +
      `Şube: ${branch?.name || "-"}\n` +
      `Grup: ${group.name || "-"}\n` +
      `Paket: ${packageText}\n` +
      `Ders Sayısı: ${lessonCount}\n` +
      `Başlangıç: ${formatDateTR(startDate)}\n` +
      `Planlanan Bitiş: ${formatDateTR(plannedEndDate)}\n` +
      `Ödeme Vadesi: ${formatDateTR(paymentDueDate || startDate)}\n\n` +
      `Yeni döneminizin sağlıklı ve başarılı geçmesini dileriz.\n` +
      `*Sprint Yüzme Okulu*`;

    const optionalWrites = await Promise.all([
      supabase.from("student_renewal_events").insert({
        organization_id: organizationId,
        student_id: studentId,
        previous_enrollment_id: activeEnrollment?.id || null,
        new_enrollment_id: newEnrollment.id,
        renewal_status: "completed",
        note: String(body.note || "").trim().slice(0, 1000) || null,
        created_by: profile.id,
      }),
      supabase
        .from("students")
        .update({
          status: "active",
          branch_id: branchId,
          preferred_group_id: groupId,
          preferred_package_id: packageId,
          updated_at: now,
        })
        .eq("organization_id", organizationId)
        .eq("id", studentId),
      supabase.from("student_activity_logs").insert({
        organization_id: organizationId,
        student_id: studentId,
        activity_type: "registration_renewed",
        title: "Kayıt yenilendi",
        description: `${lessonCount} derslik yeni dönem ${startDate} tarihinde başlayacak. Planlanan bitiş: ${plannedEndDate}.`,
        source_type: "student_renewal",
        source_id: newEnrollment.id,
        new_value: {
          enrollment_id: newEnrollment.id,
          package_id: packageId,
          lesson_count: lessonCount,
          custom_approval_id: approvalToConsume?.id || null,
        },
        performed_at: now,
      }),
      supabase.from("system_notifications").insert({
        organization_id: organizationId,
        category: "registration",
        event_key: "student_registration_renewed",
        title: "Öğrenci kaydı yenilendi",
        message: `${studentName} için ${lessonCount} derslik yeni dönem oluşturuldu.`,
        severity: "success",
        entity_type: "student",
        entity_id: studentId,
        is_read: false,
        target_path: `/ogrenciler/${studentId}`,
        created_by: profile.id,
        metadata: { enrollment_id: newEnrollment.id },
      }),
      supabase.from("message_logs").insert({
        organization_id: organizationId,
        student_id: studentId,
        template_key: "registration_renewed",
        channel: "whatsapp",
        recipient: recipient || null,
        subject: "Kayıt Yenileme Bilgilendirmesi",
        message_body: renewalMessage,
        status: "prepared",
        prepared_by: profile.id,
        metadata: {
          source: "student_renewal_center",
          enrollment_id: newEnrollment.id,
          package_id: packageId,
          lesson_count: lessonCount,
        },
      }),
      supabase.from("student_contact_logs").insert({
        organization_id: organizationId,
        student_id: studentId,
        contact_type: "renewal",
        channel: "whatsapp",
        recipient_phone: recipient || null,
        message_text: renewalMessage,
        status: "prepared",
        created_by: profile.id,
        metadata: { source: "student_renewal_center", enrollment_id: newEnrollment.id },
      }),
    ]);

    optionalWrites.forEach((result, index) => {
      if (result.error) console.error(`student renewal optional write ${index} error`, result.error);
    });

    const whatsappUrl = recipient
      ? `https://wa.me/${recipient}?text=${encodeURIComponent(renewalMessage)}`
      : null;

    return NextResponse.json({
      ok: true,
      message: `Kayıt yenilendi. Yeni bitiş tarihi: ${formatDateTR(plannedEndDate)}.`,
      enrollmentId: newEnrollment.id,
      packageName: selectedPackage.name,
      lessonCount,
      plannedEndDate,
      renewalMessage,
      whatsappUrl,
      recipientFound: Boolean(recipient),
      compatibilityColumnsOmitted: insertResult.removed,
    });
  } catch (error) {
    return fail("unexpected", error);
  }
}

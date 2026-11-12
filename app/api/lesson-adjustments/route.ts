import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { attendanceOperationsDb, validUuid } from "@/lib/attendance/operations-db";
import { publishEventNotification } from "@/lib/notifications/publish-event";
import { revalidateStudentSurfaces } from "@/lib/students/revalidate";
async function actorProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id,organization_id,role,is_active").eq("id",user.id).maybeSingle();
  return data?.is_active && data.organization_id && ["owner","admin","branch_manager","registration_staff","accounting","coach"].includes(data.role) ? data : null;
}

type RequestType =
  | "individual_compensation"
  | "bulk_compensation"
  | "lesson_count_change";

type RequestBody = {
  request_type?: RequestType;

  student_id?: string | null;
  branch_id?: string | null;
  group_id?: string | null;

  lesson_count?: number;

  reason?: string;
  description?: string;
};

function clean(value: unknown, max = 500) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function validLessonCount(value: unknown) {
  const count = Number(value);

  return (
    Number.isInteger(count) &&
    count > 0 &&
    count <= 100
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const profile = await actorProfile(supabase);
    if (!profile) return NextResponse.json({ok:false,error:"Yetkili oturum bulunamadı."},{status:403});
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ok:false,error:"Geçersiz istek."},{status:403});
    const body = (await request.json()) as RequestBody;

    const requestType = body.request_type;
    const studentId = clean(body.student_id, 60);
    const branchId = clean(body.branch_id, 60);
    const groupId = clean(body.group_id, 60);

    const reason = clean(body.reason, 250);
    const description = clean(body.description, 1000);

    const lessonCount = Number(body.lesson_count);

    if (
      requestType !== "individual_compensation" &&
      requestType !== "bulk_compensation" &&
      requestType !== "lesson_count_change"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Geçersiz işlem türü.",
        },
        { status: 400 }
      );
    }

    if (!validLessonCount(lessonCount)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ders sayısı 1 ile 100 arasında olmalıdır.",
        },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        {
          ok: false,
          error: "İşlem gerekçesi zorunludur.",
        },
        { status: 400 }
      );
    }

    if (
      (requestType === "individual_compensation" ||
        requestType === "lesson_count_change") &&
      !studentId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Öğrenci seçilmelidir.",
        },
        { status: 400 }
      );
    }

    if (
      requestType === "bulk_compensation" &&
      !branchId &&
      !groupId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Toplu telafi için şube veya grup seçilmelidir.",
        },
        { status: 400 }
      );
    }

    if (studentId && !validUuid(studentId) || branchId && !validUuid(branchId) || groupId && !validUuid(groupId)) {
      return NextResponse.json({ok:false,error:"Geçersiz öğrenci, şube veya grup."},{status:400});
    }
    if (requestType === "individual_compensation") {
      const {data,error} = await attendanceOperationsDb().rpc("request_individual_compensation",{p_actor:profile.id,p_student:studentId,p_count:lessonCount,p_reason:reason,p_description:description});
      if(error || !data?.ok) return NextResponse.json({ok:false,error:error?.message||"Telafi talebi oluşturulamadı."},{status:400});
      if(!data.duplicate) await publishEventNotification({organization_id:profile.organization_id,category:"approvals",notification_type:"individual_compensation_requested",
        include_requester:profile.id,title:"Bireysel telafi onayı bekliyor",body:`${lessonCount} ders · ${reason}`,student_id:studentId,source_type:"lesson_adjustment",source_id:data.request.id,
        target_path:`/onay-merkezi?requestId=${data.request.id}`,created_by:profile.id,push_requested:true});
      revalidateStudentSurfaces(studentId);
      return NextResponse.json({...data,message:data.duplicate?"Bu kursiyerin bekleyen bireysel telafi talebi var. Onay Merkezi’nden takip edebilirsiniz.":"Bireysel telafi yönetici onayına gönderildi. Onaydan sonra tarihli ders planı oluşturulacak."});
    }
    // Legacy bulk/count requests stay in their existing flow, scoped to the actor's institution.
    for (const [table,id] of [["students",studentId],["branches",branchId],["training_groups",groupId]]) {
      if(!id) continue;
      const {data,error}=await supabase.from(table).select("id").eq("organization_id",profile.organization_id).eq("id",id).maybeSingle();
      if(error||!data)return NextResponse.json({ok:false,error:"İlgili kayıt bu kurumda bulunamadı."},{status:404});
    }
    const { data, error } = await supabase
      .from("lesson_adjustment_requests")
      .insert({
        organization_id: profile.organization_id,
        requested_by: profile.id,

        request_type: requestType,

        student_id:
          requestType === "lesson_count_change"
            ? studentId
            : null,

        branch_id: branchId || null,
        group_id: groupId || null,

        lesson_count: lessonCount,

        reason,
        description: description || null,

        status: "pending",
      })
      .select("id,status,request_type,lesson_count")
      .single();

    if (error) {
      console.error(
        "lesson adjustment insert error:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Talep oluşturulamadı.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        requestType === "bulk_compensation"
          ? "Toplu telafi yönetici onayına gönderildi."
          : "Ders sayısı değişikliği yönetici onayına gönderildi.",
      request: data,
    });
  } catch (error) {
    console.error(
      "lesson-adjustments POST error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Beklenmeyen bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const profile = await actorProfile(supabase);
    if (!profile) return NextResponse.json({ok:false,error:"Yetkili oturum bulunamadı."},{status:403});
    const { data, error } = await supabase
      .from("lesson_adjustment_requests")
      .select("*")
      .eq("organization_id",profile.organization_id)
      .order("requested_at", {
        ascending: false,
      })
      .limit(250);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      requests: data ?? [],
    });
  } catch (error) {
    console.error(
      "lesson-adjustments GET error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Talepler alınamadı.",
      },
      { status: 500 }
    );
  }
}

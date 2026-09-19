import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const staffRoles = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
] as const;

function text(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function reminderIso(value: unknown) {
  const raw = text(value, 40);
  if (!raw) return null;
  const parsed = new Date(raw.length === 16 ? `${raw}:00+03:00` : raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function ensureStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  studentId: string,
) {
  const { data } = await supabase
    .from("students")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", studentId)
    .eq("is_deleted", false)
    .maybeSingle();
  return Boolean(data?.id);
}

async function replaceReminder(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  studentId: string;
  noteId: string;
  profileId: string;
  body: string;
  reminderAt: string | null;
}) {
  const { supabase, organizationId, studentId, noteId, profileId, body, reminderAt } = args;

  await supabase
    .from("student_activity_logs")
    .delete()
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .eq("activity_type", "student_note_reminder")
    .eq("source_type", "student_note")
    .eq("source_id", noteId);

  if (!reminderAt) return;

  const { error } = await supabase.from("student_activity_logs").insert({
    organization_id: organizationId,
    student_id: studentId,
    activity_type: "student_note_reminder",
    title: "Öğrenci notu hatırlatması",
    description: body,
    source_type: "student_note",
    source_id: noteId,
    performed_by: profileId,
    performed_at: new Date().toISOString(),
    reminder_at: reminderAt,
    reminder_completed: false,
  });

  if (error) throw new Error(error.message);
}

export async function GET(request: NextRequest) {
  const profile = await requireProfile([...staffRoles]);
  const organizationId = profile.organization_id;
  const studentId = text(request.nextUrl.searchParams.get("studentId"), 100);

  if (!organizationId || !studentId) {
    return NextResponse.json({ error: "Öğrenci bilgisi eksik." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!(await ensureStudent(supabase, organizationId, studentId))) {
    return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
  }

  const [{ data: notes, error: notesError }, { data: reminders, error: reminderError }] =
    await Promise.all([
      supabase
        .from("student_notes")
        .select("id,note_type,body,is_guardian_visible,created_at,author_id")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("student_activity_logs")
        .select("id,source_id,reminder_at,reminder_completed")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .eq("activity_type", "student_note_reminder")
        .eq("source_type", "student_note"),
    ]);

  if (notesError || reminderError) {
    return NextResponse.json(
      { error: notesError?.message || reminderError?.message || "Notlar yüklenemedi." },
      { status: 500 },
    );
  }

  const reminderMap = new Map(
    (reminders || []).map((item: any) => [String(item.source_id || ""), item]),
  );

  return NextResponse.json({
    notes: (notes || []).map((note: any) => {
      const reminder = reminderMap.get(String(note.id));
      return {
        ...note,
        reminder_at: reminder?.reminder_at || null,
        reminder_completed: Boolean(reminder?.reminder_completed),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const profile = await requireProfile([...staffRoles]);
  const organizationId = profile.organization_id;
  const payload = await request.json().catch(() => ({}));
  const studentId = text(payload.student_id, 100);
  const body = text(payload.body, 4000);
  const noteType = text(payload.note_type, 50) || "general";
  const reminderAt = reminderIso(payload.reminder_at);

  if (!organizationId || !studentId || !body) {
    return NextResponse.json({ error: "Not alanı zorunludur." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!(await ensureStudent(supabase, organizationId, studentId))) {
    return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
  }

  const { data: note, error } = await supabase
    .from("student_notes")
    .insert({
      organization_id: organizationId,
      student_id: studentId,
      author_id: profile.id,
      note_type: noteType,
      body,
      is_guardian_visible: false,
    })
    .select("id,note_type,body,is_guardian_visible,created_at,author_id")
    .single();

  if (error || !note) {
    return NextResponse.json({ error: error?.message || "Not kaydedilemedi." }, { status: 500 });
  }

  try {
    await replaceReminder({
      supabase,
      organizationId,
      studentId,
      noteId: note.id,
      profileId: profile.id,
      body,
      reminderAt,
    });
  } catch (reminderError: any) {
    return NextResponse.json({ error: reminderError?.message || "Hatırlatma kaydedilemedi." }, { status: 500 });
  }

  await supabase.from("student_timeline_events").insert({
    organization_id: organizationId,
    student_id: studentId,
    event_type: "note_added",
    title: "Yeni not eklendi",
    description: body,
    created_by: profile.id,
  });

  return NextResponse.json({ ok: true, note: { ...note, reminder_at: reminderAt } });
}

export async function PATCH(request: NextRequest) {
  const profile = await requireProfile([...staffRoles]);
  const organizationId = profile.organization_id;
  const payload = await request.json().catch(() => ({}));
  const studentId = text(payload.student_id, 100);
  const noteId = text(payload.id, 100);
  const body = text(payload.body, 4000);
  const noteType = text(payload.note_type, 50) || "general";
  const reminderAt = reminderIso(payload.reminder_at);

  if (!organizationId || !studentId || !noteId || !body) {
    return NextResponse.json({ error: "Not bilgisi eksik." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: note, error } = await supabase
    .from("student_notes")
    .update({ body, note_type: noteType })
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .eq("id", noteId)
    .select("id,note_type,body,is_guardian_visible,created_at,author_id")
    .single();

  if (error || !note) {
    return NextResponse.json({ error: error?.message || "Not güncellenemedi." }, { status: 500 });
  }

  try {
    await replaceReminder({
      supabase,
      organizationId,
      studentId,
      noteId,
      profileId: profile.id,
      body,
      reminderAt,
    });
  } catch (reminderError: any) {
    return NextResponse.json({ error: reminderError?.message || "Hatırlatma güncellenemedi." }, { status: 500 });
  }

  await supabase.from("student_timeline_events").insert({
    organization_id: organizationId,
    student_id: studentId,
    event_type: "note_updated",
    title: "Öğrenci notu güncellendi",
    description: body,
    created_by: profile.id,
  });

  return NextResponse.json({ ok: true, note: { ...note, reminder_at: reminderAt } });
}

export async function DELETE(request: NextRequest) {
  const profile = await requireProfile([...staffRoles]);
  const organizationId = profile.organization_id;
  const payload = await request.json().catch(() => ({}));
  const studentId = text(payload.student_id, 100);
  const noteId = text(payload.id, 100);

  if (!organizationId || !studentId || !noteId) {
    return NextResponse.json({ error: "Silinecek not bulunamadı." }, { status: 400 });
  }

  const supabase = await createClient();

  await supabase
    .from("student_activity_logs")
    .delete()
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .eq("activity_type", "student_note_reminder")
    .eq("source_type", "student_note")
    .eq("source_id", noteId);

  const { error } = await supabase
    .from("student_notes")
    .delete()
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .eq("id", noteId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("student_timeline_events").insert({
    organization_id: organizationId,
    student_id: studentId,
    event_type: "note_deleted",
    title: "Öğrenci notu silindi",
    created_by: profile.id,
  });

  return NextResponse.json({ ok: true });
}

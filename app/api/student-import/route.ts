import { NextRequest, NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
] as const;

type ImportRow = Record<string, unknown>;

function clean(value: unknown, max = 250) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[\s_-]+/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function valueOf(row: ImportRow, ...names: string[]) {
  const wanted = new Set(names.map(normalizeKey));
  const entry = Object.entries(row).find(([key]) => wanted.has(normalizeKey(key)));
  return entry?.[1];
}

function parseCsvLine(line: string, separator: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === separator && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): ImportRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const separator = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ";" : ",";
  const headers = parseCsvLine(lines[0], separator);
  return lines.slice(1).map((line) =>
    Object.fromEntries(parseCsvLine(line, separator).map((value, index) => [headers[index] || `alan_${index + 1}`, value])),
  );
}

function isoDate(value: unknown) {
  const text = clean(value, 20);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : null;
}

export async function GET() {
  const profile = await requireProfile([...ALLOWED_ROLES]);
  if (!profile.organization_id) {
    return NextResponse.json({ error: "Organizasyon bilgisi bulunamadı." }, { status: 400 });
  }

  const template = "Ad;Soyad;Doğum Tarihi;Telefon;Veli Adı;Veli Telefonu;Veli E-posta;Şube;Grup;Seviye;Not\n";
  return new NextResponse(`\uFEFF${template}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sprintos-ogrenci-ice-aktarma-sablonu.csv"',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile([...ALLOWED_ROLES]);
    const organizationId = profile.organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: "Organizasyon bilgisi bulunamadı." }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") || "";
    let rows: ImportRow[] = [];
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "CSV dosyası seçilmedi." }, { status: 400 });
      }
      rows = parseCsv(await file.text());
    } else {
      const body = await request.json();
      rows = Array.isArray(body) ? body : Array.isArray(body.rows) ? body.rows : [];
    }

    if (!rows.length) {
      return NextResponse.json({ error: "Dosyada aktarılacak öğrenci bulunamadı." }, { status: 400 });
    }
    if (rows.length > 1000) {
      return NextResponse.json({ error: "Tek işlemde en fazla 1000 öğrenci aktarabilirsiniz." }, { status: 400 });
    }

    const supabase = await createClient();
    const [{ data: branches }, { data: groups }] = await Promise.all([
      supabase.from("branches").select("id,name").eq("organization_id", organizationId),
      supabase.from("groups").select("id,name,branch_id").eq("organization_id", organizationId),
    ]);
    const branchMap = new Map((branches || []).map((item) => [normalizeKey(item.name), item.id]));
    const groupMap = new Map((groups || []).map((item) => [normalizeKey(item.name), item]));

    const errors: Array<{ row: number; message: string }> = [];
    const payload = rows.flatMap((row, index) => {
      const firstName = clean(valueOf(row, "Ad", "Öğrenci Adı", "first_name"), 100);
      const lastName = clean(valueOf(row, "Soyad", "Öğrenci Soyadı", "last_name"), 100);
      if (!firstName || !lastName) {
        errors.push({ row: index + 2, message: "Ad ve soyad zorunludur." });
        return [];
      }
      const branchName = clean(valueOf(row, "Şube", "branch"));
      const groupName = clean(valueOf(row, "Grup", "group"));
      const branchId = branchName ? branchMap.get(normalizeKey(branchName)) || null : null;
      const group = groupName ? groupMap.get(normalizeKey(groupName)) : null;
      if (branchName && !branchId) errors.push({ row: index + 2, message: `Şube bulunamadı: ${branchName}` });
      if (groupName && !group) errors.push({ row: index + 2, message: `Grup bulunamadı: ${groupName}` });
      return [{
        organization_id: organizationId,
        branch_id: branchId || group?.branch_id || null,
        preferred_group_id: group?.id || null,
        first_name: firstName,
        last_name: lastName,
        birth_date: isoDate(valueOf(row, "Doğum Tarihi", "birth_date")),
        phone: clean(valueOf(row, "Telefon", "Öğrenci Telefonu", "phone"), 30),
        guardian_name: clean(valueOf(row, "Veli Adı", "guardian_name"), 200),
        guardian_phone: clean(valueOf(row, "Veli Telefonu", "guardian_phone"), 30),
        guardian_email: clean(valueOf(row, "Veli E-posta", "Veli Email", "guardian_email"), 200),
        swimming_level: clean(valueOf(row, "Seviye", "swimming_level"), 100),
        registration_note: clean(valueOf(row, "Not", "Açıklama", "registration_note"), 1000),
        registration_source: "excel_import",
        status: "active",
      }];
    });

    if (!payload.length) {
      return NextResponse.json({ error: "Geçerli öğrenci satırı bulunamadı.", errors }, { status: 400 });
    }

    const { data, error } = await supabase.from("students").insert(payload).select("id");
    if (error) {
      return NextResponse.json({ error: `Öğrenciler kaydedilemedi: ${error.message}`, errors }, { status: 500 });
    }

    return NextResponse.json({ success: true, imported: data?.length || 0, warnings: errors });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "İçe aktarma sırasında beklenmeyen hata oluştu." },
      { status: 500 },
    );
  }
}

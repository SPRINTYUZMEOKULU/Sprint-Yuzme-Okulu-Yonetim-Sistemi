import { prepareGuardianAccountBatch } from "@/app/veliler/ogrenciden-olustur/bulk-account-actions";

export const maxDuration = 30;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Geçersiz istek." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.studentIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 ||
    !ids.every(id => typeof id === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))) {
    return Response.json({ error: "Kursiyer seçimi geçersiz." }, { status: 400 });
  }

  const results = await prepareGuardianAccountBatch(ids, body.resetExisting === true);
  return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
}

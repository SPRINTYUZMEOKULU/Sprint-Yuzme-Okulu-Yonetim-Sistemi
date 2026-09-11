import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { getPermissionSnapshot } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await requireProfile();
    const snapshot = await getPermissionSnapshot({
      userId: profile.id,
      organizationId: profile.organization_id,
      baseRole: profile.base_role,
    });
    return NextResponse.json({ ok: true, ...snapshot }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, isSuperUser: false, permissions: {} }, { status: 401 });
  }
}

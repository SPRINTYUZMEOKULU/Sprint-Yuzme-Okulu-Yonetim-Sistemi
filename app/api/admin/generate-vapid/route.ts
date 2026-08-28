import { NextResponse } from "next/server";
import { generateKeyPairSync } from "node:crypto";
import { requireProfile } from "@/lib/auth/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded =
    padding === 0 ? normalized : normalized + "=".repeat(4 - padding);

  return Buffer.from(padded, "base64");
}

export async function GET() {
  await requireProfile(["owner"]);

  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });

  const publicJwk = publicKey.export({ format: "jwk" });
  const privateJwk = privateKey.export({ format: "jwk" });

  if (!publicJwk.x || !publicJwk.y || !privateJwk.d) {
    return NextResponse.json(
      { error: "VAPID anahtarları üretilemedi." },
      { status: 500 }
    );
  }

  const x = base64UrlToBuffer(publicJwk.x);
  const y = base64UrlToBuffer(publicJwk.y);

  const uncompressedPublicKey = Buffer.concat([
    Buffer.from([0x04]),
    x,
    y,
  ]);

  const vapidPublicKey = uncompressedPublicKey.toString("base64url");
  const vapidPrivateKey = privateJwk.d;

  return NextResponse.json(
    {
      ok: true,
      warning:
        "Bu anahtarları yalnızca Vercel Environment Variables alanına kaydedin. Bu endpoint'i işlem tamamlanınca silin.",
      variables: {
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapidPublicKey,
        VAPID_PRIVATE_KEY: vapidPrivateKey,
        VAPID_SUBJECT: "mailto:info@sprintyuzmekursu.com",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

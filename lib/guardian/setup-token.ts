import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from "node:crypto";

export const setupLinkLifetimeMs = 60 * 60 * 1000;

function encryptionKey() {
    return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
        .update("sprintos-guardian-password-setup-v1")
        .digest();
}

export function sealSetupToken(recoveryToken: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const payload = JSON.stringify({ recoveryToken, expiresAt: Date.now() + setupLinkLifetimeMs });
    const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function openSetupToken(value: string): string | null {
    if (!/^[\w-]{40,512}$/.test(value)) return null;
    try {
        const bytes = Buffer.from(value, "base64url");
        const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
        decipher.setAuthTag(bytes.subarray(12, 28));
        const { recoveryToken, expiresAt } = JSON.parse(
            Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"),
        );
        return typeof recoveryToken === "string" && expiresAt > Date.now() ? recoveryToken : null;
    } catch {
        return null;
    }
}

export const shortSetupCodePattern = /^[A-Za-z0-9_-]{22}$/;

export function newShortSetupCode() {
    return randomBytes(16).toString("base64url");
}

export function hashShortSetupCode(code: string) {
    return createHash("sha256").update(code).digest("hex");
}

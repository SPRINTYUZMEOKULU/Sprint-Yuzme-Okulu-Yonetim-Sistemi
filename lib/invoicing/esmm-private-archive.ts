import "server-only";
import { createHash } from "node:crypto";
import { XMLValidator } from "fast-xml-parser";
import { documentAdmin } from "@/lib/payments/document-admin";

const BUCKET = "sprint-esmm-private";
const MAX_BYTES = 3 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ArchiveInput = {
  organizationId: string;
  ledgerId: string;
  ettn: string;
  pdf: Uint8Array;
  xml: Uint8Array;
};

function sha256(data: Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}
function assertFile(bytes: Uint8Array, kind: "pdf" | "xml") {
  if (!(bytes instanceof Uint8Array) || bytes.length < 16 || bytes.length > MAX_BYTES)
    throw new Error("e-SMM arşiv dosyası eksik veya boyut sınırını aşıyor.");
  if (kind === "pdf" && !Buffer.from(bytes.subarray(0, 5)).equals(Buffer.from("%PDF-")))
    throw new Error("Sağlayıcının PDF içeriği doğrulanamadı.");
  if (kind === "xml") {
    const text = Buffer.from(bytes).toString("utf8").trim();
    if (!text.startsWith("<") || /<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true)
      throw new Error("Sağlayıcının XML içeriği doğrulanamadı.");
  }
}

async function uploadOnce(path: string, bytes: Uint8Array, contentType: string) {
  const storage = documentAdmin().storage.from(BUCKET);
  const expectedHash = sha256(bytes);
  const result = await storage.upload(path, Buffer.from(bytes), { contentType, upsert: false, cacheControl: "0" });
  if (result.error) {
    // A retry after an interrupted first upload is permitted only when the
    // existing private object has precisely the same content hash.
    const existing = await storage.download(path);
    if (existing.error || !existing.data) throw new Error("Özel e-SMM arşivine yazılamadı.");
    const foundBytes = new Uint8Array(await existing.data.arrayBuffer());
    if (sha256(foundBytes) !== expectedHash) throw new Error("Arşiv dosyası aynı kimlikte farklı içerik taşıyor.");
  }
  return expectedHash;
}

/**
 * Future provider integration ONLY. No public route or sender calls this.
 * Must be invoked after SearchESMM returns the matching ETTN and verified PDF/XML.
 * Returns private object paths; never public URLs or signed links.
 */
export async function archiveVerifiedEsmm(input: ArchiveInput) {
  if (![input.organizationId,input.ledgerId,input.ettn].every(x=>uuid.test(x)))
    throw new Error("Arşiv kimlikleri doğrulanamadı.");
  assertFile(input.pdf, "pdf");
  assertFile(input.xml, "xml");
  const db = documentAdmin();
  const { data: ledger, error } = await db.from("esmm_provider_ledger")
    .select("id,ettn,state,pdf_storage_path,xml_storage_path,pdf_sha256,xml_sha256")
    .eq("organization_id",input.organizationId).eq("id",input.ledgerId).maybeSingle();
  if (error || !ledger || ledger.ettn !== input.ettn ||
      !["provider_confirmed","gib_accepted"].includes(ledger.state))
    throw new Error("Doğrulanmış sağlayıcı ETTN kaydı bulunamadı.");
  const prefix = `${input.organizationId}/${input.ledgerId}/${input.ettn}`;
  const pdfPath = `${prefix}/receipt.pdf`;
  const xmlPath = `${prefix}/receipt.xml`;
  const pdfHash = sha256(input.pdf);
  const xmlHash = sha256(input.xml);
  if (ledger.pdf_storage_path || ledger.xml_storage_path) {
    if (ledger.pdf_storage_path !== pdfPath || ledger.xml_storage_path !== xmlPath ||
      ledger.pdf_sha256 !== pdfHash || ledger.xml_sha256 !== xmlHash)
      throw new Error("Arşivlenmiş belge farklı; üzerine yazılamaz.");
    return { pdfPath, xmlPath, pdfHash, xmlHash, alreadyArchived:true };
  }
  await uploadOnce(pdfPath,input.pdf,"application/pdf");
  await uploadOnce(xmlPath,input.xml,"application/xml");
  const { data: saved, error: updateError } = await db.from("esmm_provider_ledger")
    .update({pdf_storage_path:pdfPath,pdf_sha256:pdfHash,xml_storage_path:xmlPath,xml_sha256:xmlHash})
    .eq("organization_id",input.organizationId).eq("id",input.ledgerId).eq("ettn",input.ettn)
    .is("pdf_storage_path",null).is("xml_storage_path",null)
    .select("id").maybeSingle();
  if (updateError || !saved) throw new Error("Arşiv kaydı eşzamanlı olarak değişti. Yeniden doğrulayınız.");
  return {pdfPath,xmlPath,pdfHash,xmlHash,alreadyArchived:false};
}

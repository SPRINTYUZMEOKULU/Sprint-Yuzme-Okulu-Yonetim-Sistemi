import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { MAX_BANK_ROWS, PAYMENT_IBAN, normalizeBankName, validateBankRow } from "@/lib/payments/bank-import";

export const runtime = "nodejs";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function POST(request: Request) {
  const profile = await requireProfile(["owner", "admin", "accounting"]);
  if (!profile.organization_id) return NextResponse.json({ message:"Kurum bulunamadı." }, { status:403 });
  const text = await request.text();
  if (Buffer.byteLength(text) > 512000) return NextResponse.json({message:"Dosyayı en fazla 500 hareketlik parçalara ayırınız."},{status:413});
  let body;
  try { body = JSON.parse(text); } catch { return NextResponse.json({message:"Geçersiz dosya verisi."},{status:400}); }
  if (body?.incomingConfirmed !== true || body?.accountIban !== PAYMENT_IBAN || !/^[a-f0-9]{64}$/.test(body?.fileHash || "") || typeof body?.sheet !== "string" || body.sheet.length > 100 || typeof body?.fileName !== "string" || body.fileName.length > 200 || !Array.isArray(body.rows) || !body.rows.length || body.rows.length > MAX_BANK_ROWS || !body.rows.every(validateBankRow)) return NextResponse.json({message:"Gelen ödeme sütununu, hesap onayını ve satır bilgilerini kontrol ediniz."},{status:400});
  const db = documentAdmin();
  const {data: activeProfile,error: activeError} = await db.from("profiles").select("id").eq("id",profile.id).eq("organization_id",profile.organization_id).eq("is_active",true).maybeSingle();
  if(activeError||!activeProfile)return NextResponse.json({message:"Aktif kullanıcı hesabı gerekli."},{status:403});
  const entries = body.rows.map((row: import("@/lib/payments/bank-import").BankImportRow) => ({
    organization_id: profile.organization_id, account_iban: PAYMENT_IBAN,
    row_key: row.reference.trim() ? hash([PAYMENT_IBAN,"reference",row.reference.trim().toLocaleUpperCase("tr-TR")]) : hash([body.fileHash,body.sheet,row.sourceRow]),
    content_key: hash([PAYMENT_IBAN,row.occurredAt,Math.round(row.amount*100),normalizeBankName(row.senderName),normalizeBankName(row.description)]),
    source_file: body.fileName, source_file_hash: body.fileHash, source_sheet: body.sheet, source_row: row.sourceRow,
    occurred_at: row.occurredAt, sender_name: row.senderName.trim(), amount: row.amount, description: row.description.trim(), transaction_reference: row.reference.trim() || null,
    imported_by: profile.id,
  }));
  const seen = new Map<string,string>();
  for (const entry of entries) {
    if (seen.has(entry.row_key) && seen.get(entry.row_key) !== entry.content_key) return NextResponse.json({message:"Aynı işlem numarası farklı bilgilerle iki kez bulunuyor. Dosyayı kontrol ediniz."},{status:409});
    seen.set(entry.row_key,entry.content_key);
  }
  const keys=[...seen.keys()];
  const lookups=await Promise.all(Array.from({length:Math.ceil(keys.length/50)},(_,i)=>db.from("invoice_bank_entries").select("row_key,content_key").eq("organization_id",profile.organization_id).in("row_key",keys.slice(i*50,i*50+50))));
  const existing=lookups.flatMap(result=>result.data||[]);
  if(lookups.some(result=>result.error))return NextResponse.json({message:"Mükerrer kayıt kontrolü tamamlanamadı. Hiçbir hareket eklenmedi."},{status:500});
  if(existing?.some(row=>seen.get(row.row_key)!==row.content_key))return NextResponse.json({message:"Daha önce yüklenen bir işlem numarası bu dosyada farklı bilgiler içeriyor. Kontrol edilmeden eklenemez."},{status:409});
  // Ignore only a known reference or the exact file/sheet/row. Similar rows without a
  // bank reference are kept for manual review instead of silently dropping payments.
  const { data, error } = await db.from("invoice_bank_entries").upsert(entries, {onConflict:"organization_id,row_key", ignoreDuplicates:true}).select("id");
  if (error) return NextResponse.json({message:"Banka hareketleri kaydedilemedi. Kontrol altyapısının kurulu olduğundan emin olunuz."},{status:500});
  return NextResponse.json({saved:data?.length || 0, skipped:entries.length-(data?.length || 0), message:"Hareketler kontrol kuyruğuna kaydedildi. Ödeme veya fatura oluşturulmadı."});
}

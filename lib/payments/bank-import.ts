export const PAYMENT_IBAN = "TR140001500158007357481506";
export const MAX_BANK_ROWS = 500;
export type BankImportRow = { sourceRow: number; occurredAt: string; senderName: string; amount: number; description: string; reference: string };

// VakıfBank exports include an account summary before the actual header row.
// A positive amount alone is insufficient: only A (alacak) transfer rows qualify.
export function detectVakifBankStatement(grid: string[][]) {
  const header = grid.findIndex(cells => cells[0]?.trim() === "HESAP NO" && cells[6]?.trim() === "TUTAR" && cells[15]?.trim() === "B/A" && cells[16]?.trim() === "AÇIKLAMA");
  if (header < 0) return null;
  const ibanRow = grid.slice(0, header).find(cells => cells[0]?.trim() === "IBAN");
  const iban = String(ibanRow?.[1] || "").replace(/\s/g, "").toUpperCase();
  return { header: header + 1, iban, validAccount: iban === PAYMENT_IBAN };
}

export function parseVakifBankTransfer(cells: string[], sourceRow: number): { row: BankImportRow | null; error: string } {
  const amount = parseBankAmount(cells[6]);
  if (cells[15]?.trim().toUpperCase() !== "A" || amount === null || amount <= 0) return { row: null, error: "Hesaba giriş değil" };
  const operation = normalizeBankName(cells[5] || "");
  if (!["gelen fast anlik odeme", "alinan havale", "gelen eft"].includes(operation)) return { row: null, error: "Havale/EFT dışında işlem · kontrol gerekli" };
  const description = String(cells[16] || "").trim();
  // Restrict extraction to explicit bank sentence boundaries. Ambiguous names
  // stay outside the queue; the payer is never assumed to be the recipient.
  const havale = /nolu\s+(.+?)\s+hesabından\s+TR\d{2}/iu.exec(description);
  const fast = /A\.Ş\.?\s+(.+?)\s+hesabından\s+/iu.exec(description) || /Bankası\s+(.+?)\s+hesabından\s+/iu.exec(description);
  const senderName = (havale?.[1] || fast?.[1] || "").trim();
  const occurredAt = parseBankDate(cells[2]);
  const reference = String(cells[9] || "").trim();
  if (!occurredAt) return { row: null, error: "Tarih okunamadı" };
  if (!senderName || senderName.length > 200) return { row: null, error: "Gönderen adı ayrıştırılamadı · manuel kontrol gerekli" };
  if (!reference) return { row: null, error: "İşlem numarası eksik · manuel kontrol gerekli" };
  const row = { sourceRow, amount, occurredAt, senderName, description, reference };
  return validateBankRow(row) ? { row, error: "" } : { row: null, error: "Hareket bilgileri doğrulanamadı" };
}

export function normalizeBankName(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g,"i").replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseBankAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  let text = String(value ?? "").trim().replace(/(?:TRY|TL|₺)/gi, "").replace(/\s/g, "");
  if (!text) return null;
  if (/^\(.+\)$/.test(text)) text = `-${text.slice(1,-1)}`;
  if (!/^[+-]?[\d.,]+$/.test(text)) return null;
  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      if (!/^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{1,2}$/.test(text)) return null;
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{1,2}$/.test(text)) return null;
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    if (!/^[+-]?\d+,\d{1,2}$/.test(text)) return null;
    text = text.replace(",", ".");
  } else if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  else if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && Math.abs(amount) < 1e10 ? Math.round(amount * 100) / 100 : null;
}

// The bank file is Turkish local time; do not interpret it in the browser's timezone.
export function parseBankDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const tr = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (!tr && !iso) return null;
  const parts = tr ? [tr[3], tr[2], tr[1], tr[4] || "00", tr[5] || "00", tr[6] || "00"] : [iso![1], iso![2], iso![3], iso![4] || "00", iso![5] || "00", iso![6] || "00"];
  const [year, month, day, hour, minute, second] = parts.map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year,month,0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  return new Date(`${parts[0]}-${parts[1].padStart(2,"0")}-${parts[2].padStart(2,"0")}T${parts[3].padStart(2,"0")}:${parts[4].padStart(2,"0")}:${parts[5].padStart(2,"0")}+03:00`).toISOString();
}

export function validateBankRow(value: unknown): value is BankImportRow {
  if (!value || typeof value !== "object") return false;
  const row = value as BankImportRow;
  return Number.isInteger(row.sourceRow) && row.sourceRow > 0 && row.sourceRow <= 100000 &&
    typeof row.senderName === "string" && row.senderName.trim().length >= 2 && row.senderName.length <= 200 &&
    typeof row.amount === "number" && Number.isFinite(row.amount) && row.amount > 0 && row.amount < 1e10 && Math.abs(row.amount * 100 - Math.round(row.amount * 100)) < 0.001 &&
    typeof row.occurredAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.occurredAt) && Number.isFinite(Date.parse(row.occurredAt)) &&
    typeof row.description === "string" && row.description.length <= 1000 && typeof row.reference === "string" && row.reference.length <= 160;
}

export function suggestBankStudents(sender: string, description: string, students: {id:string;first_name:string;last_name:string;guardian_name:string|null}[]) {
  const name = normalizeBankName(sender);
  const words = ` ${normalizeBankName(description)} `;
  return students.filter(student => {
    const full = normalizeBankName(`${student.first_name} ${student.last_name}`);
    const guardian = normalizeBankName(student.guardian_name || "");
    return (full.length > 4 && (name === full || words.includes(` ${full} `))) || (guardian.length > 4 && guardian === name);
  }).map(student => student.id);
}

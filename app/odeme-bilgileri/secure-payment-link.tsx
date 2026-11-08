"use client";

import { useMemo, useState } from "react";

type PhoneCandidate = { phone: string; label: string; source: string };
type PreparedLink = { url: string; message: string; recipient: string; expiresAt?: string };

function normalizePhone(value?: string | null) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(2);
  if (digits.startsWith("90") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return "";
}
function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return NaN;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 && value <= 10000000 ? value : NaN;
}

export default function SecurePaymentLink({ studentId, studentName, phoneCandidates = [] }: {
  studentId: string; studentName?: string; phoneCandidates?: PhoneCandidate[];
}) {
  const phones = useMemo(() => {
    const seen = new Set<string>();
    return phoneCandidates.filter(x => {
      const normalized = normalizePhone(x.phone);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [phoneCandidates]);
  const [phone, setPhone] = useState(() => normalizePhone(phones[0]?.phone));
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [prepared, setPrepared] = useState<PreparedLink | null>(null);

  async function prepare() {
    if (!studentId) return setStatus("Önce kursiyer seçiniz.");
    const parsedAmount = parseAmount(amount);
    if (Number.isNaN(parsedAmount)) return setStatus("Tutarı 1.500 veya 1.500,50 biçiminde giriniz.");
    setBusy(true);
    setStatus("Güvenli bağlantı oluşturuluyor…");
    setPrepared(null);
    try {
      const response = await fetch("/api/payment-document-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, expectedAmount: parsedAmount }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data?.url !== "string" || !data.url.startsWith("https://"))
        throw new Error(data?.message || "Bağlantı oluşturulamadı.");
      const message = `🏊 *SPRİNT YÜZME OKULU*\n_Güvenli Ödeme ve Belge Bilgileri_\n\nSayın Veli / Kursiyer,\n\n${studentName ? `*${studentName.replace(/[\\*_~`]/g, "")}* için ` : ""}ödeme bilgilerinize güvenli bağlantımızdan ulaşabilirsiniz.\n\n🔗 *Ödeme ve Belge Bilgileri*\n${data.url}\n\n📋 _Önce belge bilgilerinizi tamamlayınız. Ardından VakıfBank IBAN ve QR ödeme bilgileri görüntülenecektir._\n\n☎️ Bilgi Hattı: 0551 896 83 19\n\n_SPRINT Yüzme Okulu · Resmî bilgilendirme_`;
      setPrepared({ url: data.url, message, recipient: phone, expiresAt: data.expiresAt });
      setStatus("Güvenli bağlantı hazır. WhatsApp'ta paylaşmak için aşağıdaki düğmeye dokunun. Gönderimi WhatsApp içinde onaylayın.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bağlantı oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} kopyalandı. İstediğiniz kişiye yapıştırabilirsiniz.`);
    } catch {
      setStatus("Otomatik kopyalama başarısız. Bağlantıya uzun basarak kopyalayabilirsiniz.");
    }
  }
  const whatsappUrl = prepared?.recipient
    ? `https://wa.me/${prepared.recipient}?text=${encodeURIComponent(prepared.message)}`
    : "";

  return <section style={{ marginTop: 16, padding: 18, border: "1px solid #b9d8ef", borderRadius: 16, background: "#f4faff" }}>
    <div style={{ fontSize: 11, fontWeight: 900, color: "#0a5da8", letterSpacing: ".08em" }}>GÜVENLİ IBAN ÖDEME AKIŞI</div>
    <h3 style={{ margin: "6px 0 5px", color: "#0c3159" }}>Kursiyere Ödeme Bağlantısı Hazırla</h3>
    <p style={{ fontSize: 12, color: "#58758f", lineHeight: 1.6 }}>
      Önce kursiyer ve tutarı kontrol edin. Güvenli bağlantı oluşturulduktan sonra WhatsApp'ta gönderimi siz onaylarsınız.
    </p>
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800, color: "#173a59" }}>
        WhatsApp alıcısı
        {phones.length > 0 ? <select value={phone} disabled={busy} onChange={e => { setPhone(e.target.value); setPrepared(null); }} style={{ padding: 12, borderRadius: 11, border: "1px solid #cbdbe8" }}>
          {phones.map(x => <option key={normalizePhone(x.phone)} value={normalizePhone(x.phone)}>{x.label} · {x.phone}</option>)}
        </select> : <span style={{ color: "#a53b35" }}>Kayıtlı geçerli telefon yok. Bağlantıyı oluşturup manuel kopyalayabilirsiniz.</span>}
      </label>
      <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800, color: "#173a59" }}>
        Ödenecek tutar (isteğe bağlı)
        <input value={amount} disabled={busy} onChange={e => { setAmount(e.target.value); setPrepared(null); }} inputMode="decimal" placeholder="Örn. 4.000,00" style={{ padding: 12, borderRadius: 11, border: "1px solid #cbdbe8" }} />
      </label>
      <button type="button" onClick={prepare} disabled={busy} style={{ minHeight: 48, padding: 14, border: 0, borderRadius: 12, background: "#0a5da8", color: "#fff", fontWeight: 900, cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Bağlantı hazırlanıyor…" : "Güvenli Ödeme Bağlantısı Oluştur"}
      </button>
    </div>
    {status ? <p role="status" aria-live="polite" style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: "#244e74" }}>{status}</p> : null}
    {prepared ? <div style={{ marginTop: 12, display: "grid", gap: 10, padding: 14, borderRadius: 12, background: "#fff", border: "1px solid #c8e1d4" }}>
      <b style={{ color: "#22613a" }}>Bağlantı hazır · WhatsApp'ta gönderim bekliyor</b>
      <input readOnly aria-label="Güvenli ödeme bağlantısı" value={prepared.url} onFocus={e => e.currentTarget.select()} style={{ minWidth: 0, padding: 10, border: "1px solid #d9e5ed", borderRadius: 8 }} />
      {prepared.expiresAt ? <small style={{ color: "#61788d" }}>Son geçerlilik: {new Date(prepared.expiresAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</small> : null}
      {whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ padding: 14, borderRadius: 10, background: "#16743d", color: "white", fontWeight: 900, textAlign: "center", textDecoration: "none" }}>WhatsApp'ta Aç ve Gönder</a> : null}
      <button type="button" onClick={() => copy(prepared.url, "Bağlantı")} style={{ padding: 12, borderRadius: 10, border: "1px solid #a7c4d9", color: "#17456b", background: "#fff", fontWeight: 800 }}>Bağlantıyı Kopyala</button>
      <button type="button" onClick={() => copy(prepared.message, "Hazır mesaj")} style={{ padding: 12, borderRadius: 10, border: "1px solid #a7c4d9", color: "#17456b", background: "#fff", fontWeight: 800 }}>Mesaj Metnini Kopyala</button>
      <small style={{ color: "#63778a" }}>WhatsApp'ın açılması mesajın iletildiği anlamına gelmez. Gönderimi WhatsApp içinde tamamlayın.</small>
    </div> : null}
  </section>;
}

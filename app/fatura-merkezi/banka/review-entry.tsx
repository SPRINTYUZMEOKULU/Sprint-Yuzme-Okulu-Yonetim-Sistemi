"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startBankDocument, excludeBankEntry, attachExistingBankDocument } from "./actions";

type Student = { id: string; name: string };
type ExistingRequest = {
  id: string; studentId: string; amount: number; status: string; recipientName: string;
};

export default function ReviewEntry({
  entryId, amount, students, suggested, similar, existingRequests
}: {
  entryId: string; amount: number; students: Student[]; suggested: string[];
  similar: boolean; existingRequests: ExistingRequest[];
}) {
  const [student, setStudent] = useState("");
  const [search, setSearch] = useState("");
  const [requestId, setRequestId] = useState("");
  const [duplicateNote, setDuplicateNote] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const filtered = students.filter(s => suggested.includes(s.id) ||
    !search || s.name.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")));
  const matched = existingRequests.filter(r =>
    r.studentId === student && Math.round(r.amount * 100) === Math.round(amount * 100));
  const confirmedDuplicate = !similar || duplicateNote.trim().length >= 10;

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    start(async () => {
      try {
        const result = await action();
        setMessage(result.message);
        if (result.ok) router.refresh();
      } catch {
        setMessage("İşlem tamamlanamadı. Kontrol edip tekrar deneyiniz.");
      }
    });
  }

  return <div>
    <p>İsim önerisi otomatik onay değildir. Göndereni, tutarı ve kursiyeri bankadan doğrulayınız.</p>
    <label>Kursiyer ara
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ad soyad" />
    </label>
    <label>Kursiyer seç
      <select value={student} onChange={e => { setStudent(e.target.value); setRequestId(""); setMessage(""); }} disabled={pending}>
        <option value="">Seçiniz</option>
        {filtered.map(s => <option key={s.id} value={s.id}>{suggested.includes(s.id) ? "Öneri: " : ""}{s.name}</option>)}
      </select>
    </label>
    {similar ? <label>
      Benzer banka hareketleri var: ayrı bir işlem olduğunu doğrulayan gerekçeyi yazın (en az 10 karakter).
      <textarea value={duplicateNote} onChange={e => setDuplicateNote(e.target.value)} maxLength={500}
        placeholder="Banka referansı / işlem tarihi karşılaştırması" />
    </label> : null}

    {student && matched.length ? <div className="invoice-warning" style={{ display: "grid", gap: 10, padding: 12, borderRadius: 10 }}>
      <strong>Aynı kursiyer ve tutar için {matched.length} açık güvenli belge talebi var.</strong>
      <p style={{ margin: 0 }}>Yeni talep açmak yerine kontrol ettiğiniz mevcut talebi seçiniz. Banka bağlantısı fatura veya kesin tahsilat oluşturmaz.</p>
      <label>Mevcut belge talebini seç
        <select value={requestId} onChange={e => setRequestId(e.target.value)} disabled={pending}>
          <option value="">Talep seçiniz</option>
          {matched.map(r => <option key={r.id} value={r.id}>
            {r.recipientName || "Belge bilgileri bekleniyor"} · {r.status === "waiting_payment" ? "Ödeme kontrolü" : "Bilgi bekleniyor"} · {r.id.slice(0, 8)}
          </option>)}
        </select>
      </label>
      <button className="primary" disabled={pending || !requestId || !confirmedDuplicate}
        onClick={() => run(() => attachExistingBankDocument(entryId, requestId, duplicateNote))}>
        {pending ? "Kaydediliyor…" : "Mevcut Talebe Bağla · Yönetici Onayı"}
      </button>
    </div> : null}

    {student && !matched.length ? <button className="primary" disabled={pending || !confirmedDuplicate}
      onClick={() => run(() => startBankDocument(entryId, student, duplicateNote))}>
      {pending ? "Kaydediliyor…" : "Kursiyeri Onayla · Yeni Belge Talebi Başlat"}
    </button> : null}

    <details>
      <summary>Bu hareket kurs ücreti değil / mükerrer</summary>
      <label>Kontrol gerekçesi
        <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} />
      </label>
      <button disabled={pending || note.trim().length < 5}
        onClick={() => run(() => excludeBankEntry(entryId, note))}>Gerekçeyle Kapsam Dışında Bırak</button>
    </details>
    <p role="status" aria-live="polite">{message}</p>
  </div>;
}

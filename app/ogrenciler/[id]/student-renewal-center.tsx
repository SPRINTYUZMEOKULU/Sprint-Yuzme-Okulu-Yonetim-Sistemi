"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentRenewalCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [lessonCount, setLessonCount] = useState("12");
  const [startDate, setStartDate] = useState(today());
  const [paymentDueDate, setPaymentDueDate] = useState(today());
  const [note, setNote] = useState("");

  const studentId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const match = window.location.pathname.match(/\/ogrenciler\/([^/]+)/);
    return match?.[1] || "";
  }, []);

  useEffect(() => {
    const ensureButton = () => {
      const actions = document.querySelector<HTMLElement>(".fileCommandActions");
      if (!actions || actions.querySelector("[data-renewal-button='1']")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.renewalButton = "1";
      button.className = "renewalQuickButton";
      button.innerHTML = '<span aria-hidden="true">↻</span> Kayıt Yenile';
      button.addEventListener("click", () => {
        setMessage("");
        setOpen(true);
      });
      const payment = actions.querySelector("button");
      if (payment?.nextSibling) actions.insertBefore(button, payment.nextSibling);
      else actions.appendChild(button);
    };

    ensureButton();
    const observer = new MutationObserver(ensureButton);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function submitRenewal() {
    if (!studentId || submitting) return;
    const count = Number(lessonCount);
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      setMessage("Ders sayısı 1 ile 200 arasında olmalıdır.");
      return;
    }
    if (!startDate) {
      setMessage("Yeni dönem başlangıç tarihi zorunludur.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/student-renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonCount: count,
          startDate,
          paymentDueDate: paymentDueDate || startDate,
          note: note.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setMessage(data.error || "Kayıt yenileme tamamlanamadı.");
        return;
      }
      setMessage(data.message || "Kayıt başarıyla yenilendi.");
      router.refresh();
      window.setTimeout(() => setOpen(false), 1100);
    } catch {
      setMessage("Kayıt yenileme sırasında bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return <style jsx global>{`.renewalQuickButton{background:#f3efff!important;border-color:#d7c8f5!important;color:#6843a8!important}.renewalQuickButton span{font-size:17px;font-weight:900}`}</style>;

  return (
    <>
      <div className="renewalOverlay" onClick={() => setOpen(false)}>
        <aside className="renewalPanel" onClick={(event) => event.stopPropagation()}>
          <header>
            <div><span>KAYIT VE PROGRAM</span><h2>Kayıt Yenileme Merkezi</h2><p>Mevcut şube, grup ve paket üzerinden yeni dönemi güvenli biçimde başlatın.</p></div>
            <button type="button" onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="renewalBody">
            <div className="renewalInfo"><strong>Mevcut kayıt geçmişi korunur</strong><p>Eski dönem tamamlandı olarak işaretlenir, yeni dönem ayrı kayıt olarak açılır. Yoklama, ödeme ve işlem geçmişi silinmez.</p></div>
            <div className="renewalGrid">
              <label><span>Yeni Paket Ders Sayısı</span><input type="number" min="1" max="200" value={lessonCount} onChange={(e) => setLessonCount(e.target.value)} /></label>
              <label><span>Yeni Dönem Başlangıcı</span><input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!paymentDueDate) setPaymentDueDate(e.target.value); }} /></label>
              <label><span>Ödeme Vade Tarihi</span><input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} /></label>
              <label className="full"><span>Yenileme Notu</span><textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. 12 derslik yeni dönem, aynı grup ve program ile devam." /></label>
            </div>
            <div className="renewalWarning"><strong>Kontrol:</strong> Yenileme mevcut aktif kaydın şube, grup ve paket bilgilerini kullanır. Grup değişecekse önce “Grup / Şube Değiştir” işlemini uygulayın.</div>
            {message && <div className="renewalMessage">{message}</div>}
          </div>
          <footer><button type="button" className="ghost" onClick={() => setOpen(false)}>Vazgeç</button><button type="button" className="primary" disabled={submitting} onClick={submitRenewal}>{submitting ? "Yenileniyor…" : "✓ Kaydı Yenile"}</button></footer>
        </aside>
      </div>
      <style jsx global>{`.renewalQuickButton{background:#f3efff!important;border-color:#d7c8f5!important;color:#6843a8!important}.renewalQuickButton span{font-size:17px;font-weight:900}`}</style>
      <style jsx>{`
        .renewalOverlay{position:fixed;inset:0;z-index:1510;display:flex;justify-content:flex-end;background:rgba(4,20,38,.64);backdrop-filter:blur(7px)}.renewalPanel{width:min(620px,98vw);height:100%;display:flex;flex-direction:column;background:#f5f8fc;box-shadow:-24px 0 70px rgba(0,0,0,.28)}header{display:flex;justify-content:space-between;gap:18px;padding:24px;background:linear-gradient(135deg,#2f1f59,#6843a8);color:#fff}header span{display:block;color:#f6c55f;font-size:10px;font-weight:900;letter-spacing:.12em}header h2{margin:5px 0 3px;font-size:25px}header p{margin:0;color:#e9e1fa;font-size:13px}header button{width:40px;height:40px;border:1px solid rgba(255,255,255,.3);border-radius:11px;background:rgba(255,255,255,.1);color:#fff;font-size:25px;cursor:pointer}.renewalBody{flex:1;overflow:auto;padding:22px}.renewalInfo,.renewalWarning,.renewalMessage{padding:14px 15px;border-radius:13px;margin-bottom:16px}.renewalInfo{background:#f2edff;border:1px solid #ded1fb;color:#52368a}.renewalInfo p{margin:5px 0 0;color:#706286;font-size:12px;line-height:1.5}.renewalGrid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.renewalGrid label{display:grid;gap:6px}.renewalGrid .full{grid-column:1/-1}.renewalGrid span{font-size:11px;font-weight:850;color:#4f647a}.renewalGrid input,.renewalGrid textarea{width:100%;box-sizing:border-box;border:1px solid #cfdbe8;border-radius:10px;padding:11px 12px;background:#fff;color:#142f4a;font:inherit}.renewalWarning{margin-top:16px;background:#fff8e8;border:1px solid #f2d79b;color:#805b14;font-size:12px;line-height:1.5}.renewalMessage{background:#eefaf4;border:1px solid #c8e3d3;color:#17643d;font-weight:800}footer{display:flex;justify-content:flex-end;gap:9px;padding:16px 20px;border-top:1px solid #dbe4ee;background:#fff}footer button{min-height:43px;padding:0 16px;border-radius:11px;font-weight:900;cursor:pointer}.ghost{border:1px solid #d2dce7;background:#fff;color:#49647e}.primary{border:0;background:#6843a8;color:#fff}.primary:disabled{opacity:.55;cursor:not-allowed}@media(max-width:640px){.renewalGrid{grid-template-columns:1fr}.renewalGrid .full{grid-column:auto}header{padding:19px}footer{flex-direction:column-reverse}}
      `}</style>
    </>
  );
}

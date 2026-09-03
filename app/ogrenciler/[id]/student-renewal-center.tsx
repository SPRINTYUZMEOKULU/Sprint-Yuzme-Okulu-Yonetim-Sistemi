"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PackageOption = {
  id: string;
  name: string;
  lesson_count: number;
  price: number | string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number | string | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function StudentRenewalCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "approval" | "">("");
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [packageId, setPackageId] = useState("");
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customLessonCount, setCustomLessonCount] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [paymentDueDate, setPaymentDueDate] = useState(today());
  const [note, setNote] = useState("");

  const studentId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const match = window.location.pathname.match(/\/ogrenciler\/([^/]+)/);
    return match?.[1] || "";
  }, []);

  const selectedPackage = packages.find((item) => item.id === packageId) || null;
  const customCount = Number(customLessonCount);
  const customNeedsApproval =
    customEnabled && Number.isInteger(customCount) && customCount > 0 && customCount !== 8 && customCount !== 12;

  async function openCenter() {
    if (!studentId) return;
    setOpen(true);
    setLoading(true);
    setMessage("");
    setMessageKind("");
    setCustomEnabled(false);
    setCustomLessonCount("");
    try {
      const response = await fetch(
        `/api/student-renewals?studentId=${encodeURIComponent(studentId)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setMessage(data.error || "Yenileme bilgileri yüklenemedi.");
        setMessageKind("error");
        return;
      }
      setPackages(data.packages || []);
      setPackageId(data.selectedPackageId || data.packages?.[0]?.id || "");
    } catch {
      setMessage("Yenileme bilgileri yüklenirken bağlantı hatası oluştu.");
      setMessageKind("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ensureButton = () => {
      const actions = document.querySelector<HTMLElement>(".fileCommandActions");
      if (!actions || actions.querySelector("[data-renewal-button='1']")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.renewalButton = "1";
      button.className = "renewalQuickButton";
      button.innerHTML = '<span aria-hidden="true">↻</span> Kayıt Yenile';
      button.addEventListener("click", () => void openCenter());
      const payment = actions.querySelector("button");
      if (payment?.nextSibling) actions.insertBefore(button, payment.nextSibling);
      else actions.appendChild(button);
    };

    ensureButton();
    const observer = new MutationObserver(ensureButton);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [studentId]);

  async function submitRenewal() {
    if (!studentId || submitting || loading) return;
    if (!packageId) {
      setMessage("Yeni dönem için paket seçmelisiniz.");
      setMessageKind("error");
      return;
    }
    if (!startDate) {
      setMessage("Yeni dönem başlangıç tarihi zorunludur.");
      setMessageKind("error");
      return;
    }
    if (customEnabled && (!Number.isInteger(customCount) || customCount < 1 || customCount > 100)) {
      setMessage("Özel ders sayısı 1 ile 100 arasında tam sayı olmalıdır.");
      setMessageKind("error");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setMessageKind("");
    try {
      const response = await fetch("/api/student-renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          packageId,
          customLessonCount: customEnabled ? customCount : null,
          startDate,
          paymentDueDate: paymentDueDate || startDate,
          note: note.trim(),
        }),
      });
      const data = await response.json();

      if (data.approvalRequired) {
        setMessage(data.message || "Standart dışı ders sayısı yönetici onayına gönderildi.");
        setMessageKind("approval");
        router.refresh();
        return;
      }

      if (!response.ok || !data.ok) {
        setMessage(data.error || "Kayıt yenileme tamamlanamadı.");
        setMessageKind("error");
        return;
      }

      const suffix = data.recipientFound
        ? " Kayıt yenileme WhatsApp mesajı hazırlandı ve açılıyor."
        : " Veli/öğrenci telefonu bulunamadığı için WhatsApp açılamadı; mesaj kaydı oluşturuldu.";
      setMessage(`${data.message || "Kayıt başarıyla yenilendi."}${suffix}`);
      setMessageKind("success");
      router.refresh();

      if (data.whatsappUrl) {
        window.setTimeout(() => {
          window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
        }, 250);
      }
    } catch {
      setMessage("Kayıt yenileme sırasında bağlantı hatası oluştu.");
      setMessageKind("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <style jsx global>{`
        .renewalQuickButton{background:#f3efff!important;border-color:#d7c8f5!important;color:#6843a8!important}
        .renewalQuickButton span{font-size:17px;font-weight:900}
      `}</style>
    );
  }

  return (
    <>
      <div className="renewalOverlay" onClick={() => setOpen(false)}>
        <aside className="renewalPanel" onClick={(event) => event.stopPropagation()}>
          <header>
            <div>
              <span>KAYIT VE PROGRAM</span>
              <h2>Kayıt Yenileme Merkezi</h2>
              <p>Standart 8/12 ders paketini seçin veya yönetici onayıyla özel ders sayısı talep edin.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="renewalBody">
            <div className="renewalInfo">
              <strong>Mevcut kayıt geçmişi korunur</strong>
              <p>Eski dönem tamamlandı olarak işaretlenir, yeni dönem ayrı kayıt olarak açılır. Yoklama, ödeme ve işlem geçmişi silinmez.</p>
            </div>

            {loading ? (
              <div className="renewalLoading">Paket ve kayıt bilgileri yükleniyor…</div>
            ) : (
              <div className="renewalGrid">
                <label className="full">
                  <span>Yeni Dönem Paketi</span>
                  <select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                    <option value="">Paket seçin</option>
                    {packages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.lesson_count} ders · {money(item.price)}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedPackage && (
                  <div className="packageSummary full">
                    <strong>{selectedPackage.name}</strong>
                    <span>{selectedPackage.lesson_count} ders</span>
                    <span>{money(selectedPackage.price)}</span>
                  </div>
                )}

                <label className="full customToggle">
                  <input
                    type="checkbox"
                    checked={customEnabled}
                    onChange={(e) => {
                      setCustomEnabled(e.target.checked);
                      if (!e.target.checked) setCustomLessonCount("");
                    }}
                  />
                  <span>Özel ders sayısı ile yenile</span>
                </label>

                {customEnabled && (
                  <label className="full">
                    <span>Özel Ders Sayısı</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={customLessonCount}
                      onChange={(e) => setCustomLessonCount(e.target.value)}
                      placeholder="Örn. 3"
                    />
                    <small>
                      8 ve 12 ders standarttır. Bunların dışındaki ders sayıları doğrudan yenilenmez; Onay Merkezi'ne yönetici onayı için gönderilir.
                    </small>
                  </label>
                )}

                {customNeedsApproval && (
                  <div className="approvalNotice full">
                    <strong>Yönetici onayı gerekli</strong>
                    <span>{customCount} derslik yenileme önce Onay Merkezi'ne gönderilecek. Onaylandıktan sonra aynı bilgilerle yenilemeyi tekrar çalıştırabilirsiniz.</span>
                  </div>
                )}

                <label>
                  <span>Yeni Dönem Başlangıcı</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (!paymentDueDate) setPaymentDueDate(e.target.value);
                    }}
                  />
                </label>
                <label>
                  <span>Ödeme Vade Tarihi</span>
                  <input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} />
                </label>
                <label className="full">
                  <span>Yenileme Notu</span>
                  <textarea
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Örn. Aynı grup ve program ile yeni döneme devam."
                  />
                </label>
              </div>
            )}

            <div className="renewalWarning">
              <strong>Kontrol:</strong> Şube ve grup mevcut aktif kayıttan korunur. Grup değişecekse önce “Grup / Şube Değiştir” işlemini uygulayın.
            </div>

            <div className="renewalAutoMessage">
              <strong>WhatsApp bilgilendirmesi otomatik hazırlanır</strong>
              <p>Kayıt başarıyla yenilendiğinde ders sayısı, yeni paket, başlangıç, bitiş ve ödeme vadesini içeren veli mesajı kaydedilir ve WhatsApp gönderim ekranı otomatik açılır.</p>
            </div>

            {message && (
              <div className={`renewalMessage ${messageKind || "success"}`}>
                {message}
              </div>
            )}
          </div>

          <footer>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>Vazgeç</button>
            <button
              type="button"
              className="primary"
              disabled={submitting || loading || !packageId}
              onClick={submitRenewal}
            >
              {submitting
                ? "İşleniyor…"
                : customNeedsApproval
                  ? "✓ Yönetici Onayına Gönder"
                  : "✓ Kaydı Yenile ve Mesajı Hazırla"}
            </button>
          </footer>
        </aside>
      </div>

      <style jsx global>{`
        .renewalQuickButton{background:#f3efff!important;border-color:#d7c8f5!important;color:#6843a8!important}
        .renewalQuickButton span{font-size:17px;font-weight:900}
      `}</style>
      <style jsx>{`
        .renewalOverlay{position:fixed;inset:0;z-index:1510;display:flex;justify-content:flex-end;background:rgba(4,20,38,.64);backdrop-filter:blur(7px)}
        .renewalPanel{width:min(650px,98vw);height:100%;display:flex;flex-direction:column;background:#f5f8fc;box-shadow:-24px 0 70px rgba(0,0,0,.28)}
        header{display:flex;justify-content:space-between;gap:18px;padding:24px;background:linear-gradient(135deg,#2f1f59,#6843a8);color:#fff}
        header span{display:block;color:#f6c55f;font-size:10px;font-weight:900;letter-spacing:.12em}
        header h2{margin:5px 0 3px;font-size:25px} header p{margin:0;color:#e9e1fa;font-size:13px}
        header button{width:40px;height:40px;border:1px solid rgba(255,255,255,.3);border-radius:11px;background:rgba(255,255,255,.1);color:#fff;font-size:25px;cursor:pointer}
        .renewalBody{flex:1;overflow:auto;padding:22px}
        .renewalInfo,.renewalWarning,.renewalMessage,.renewalAutoMessage,.renewalLoading{padding:14px 15px;border-radius:13px;margin-bottom:16px}
        .renewalInfo{background:#f2edff;border:1px solid #ded1fb;color:#52368a}.renewalInfo p,.renewalAutoMessage p{margin:5px 0 0;font-size:12px;line-height:1.5}.renewalInfo p{color:#706286}
        .renewalGrid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.renewalGrid label{display:grid;gap:6px}.renewalGrid .full{grid-column:1/-1}.renewalGrid label>span{font-size:11px;font-weight:850;color:#4f647a}
        .renewalGrid input,.renewalGrid textarea,.renewalGrid select{width:100%;box-sizing:border-box;border:1px solid #cfdbe8;border-radius:10px;padding:11px 12px;background:#fff;color:#142f4a;font:inherit}.renewalGrid small{color:#718397;line-height:1.45}
        .packageSummary{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;border:1px solid #dcd3f3;border-radius:12px;background:#faf8ff;color:#5d428f}.packageSummary strong{margin-right:auto;color:#3f286f}.packageSummary span{font-size:12px;font-weight:850}
        .customToggle{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;justify-content:flex-start;padding:12px 14px;border:1px dashed #b8a5e2;border-radius:12px;background:#fbf9ff}.customToggle input{width:18px!important;height:18px}.customToggle span{font-size:13px!important;color:#4c347d!important}
        .approvalNotice{display:grid;gap:4px;padding:13px 14px;border:1px solid #f0c87c;border-radius:12px;background:#fff7df;color:#80580c}.approvalNotice span{font-size:12px;line-height:1.45}
        .renewalWarning{margin-top:16px;background:#fff8e8;border:1px solid #f2d79b;color:#805b14;font-size:12px;line-height:1.5}.renewalAutoMessage{background:#edf8ff;border:1px solid #cde7f8;color:#245d7b}.renewalAutoMessage strong{color:#075a88}
        .renewalMessage.success{background:#eefaf4;border:1px solid #c8e3d3;color:#17643d;font-weight:800}.renewalMessage.error{background:#fff0f0;border:1px solid #efc3c3;color:#a22727;font-weight:800;white-space:pre-wrap}.renewalMessage.approval{background:#fff7df;border:1px solid #f0c87c;color:#78520a;font-weight:800}
        .renewalLoading{background:#fff;border:1px solid #dbe4ee;color:#60778f;text-align:center}
        footer{display:flex;justify-content:flex-end;gap:9px;padding:16px 20px;border-top:1px solid #dbe4ee;background:#fff}footer button{min-height:43px;padding:0 16px;border-radius:11px;font-weight:900;cursor:pointer}.ghost{border:1px solid #d2dce7;background:#fff;color:#49647e}.primary{border:0;background:#6843a8;color:#fff}.primary:disabled{opacity:.55;cursor:not-allowed}
        @media(max-width:640px){.renewalGrid{grid-template-columns:1fr}.renewalGrid .full{grid-column:auto}header{padding:19px}footer{flex-direction:column-reverse}.packageSummary strong{width:100%}}
      `}</style>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createStudentPayment } from "../../odemeler/actions";

type PaymentRow = {
  id: string;
  enrollmentId: string | null;
  amount: number;
  method: string;
  description: string | null;
  receivedAt: string | null;
  status: string | null;
};

type CenterData = {
  student: { id: string; first_name?: string | null; last_name?: string | null };
  enrollment: null | {
    id: string;
    paymentDueDate: string | null;
    packageName: string | null;
    totalAmount: number;
    totalReceived: number;
    remainingPayment: number;
  };
  payments: PaymentRow[];
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  card: "Kart",
  bank_transfer: "Banka Havalesi",
  eft: "EFT",
  other: "Diğer",
};

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function StudentPaymentCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<CenterData | null>(null);
  const [amountValue, setAmountValue] = useState("");
  const [method, setMethod] = useState<"cash" | "card" | "bank_transfer" | "eft" | "other">("cash");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "">("");

  const studentId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const match = window.location.pathname.match(/\/ogrenciler\/([^/]+)/);
    return match?.[1] || "";
  }, []);

  async function load() {
    if (!studentId) return;
    setLoading(true);
    setMessage("");
    setMessageKind("");
    try {
      const response = await fetch(`/api/student-payment-center?studentId=${encodeURIComponent(studentId)}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setMessage(payload.error || "Ödeme bilgileri alınamadı.");
        setMessageKind("error");
        return;
      }
      setData(payload);
      const remaining = Number(payload.enrollment?.remainingPayment || 0);
      if (remaining > 0) setAmountValue(String(remaining));
    } catch {
      setMessage("Ödeme bilgileri yüklenirken bağlantı hatası oluştu.");
      setMessageKind("error");
    } finally {
      setLoading(false);
    }
  }

  async function openCenter() {
    setOpen(true);
    await load();
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      const alert = target.closest<HTMLAnchorElement>(".smartAlertGrid a[href='#odeme']");
      const paymentButton = target.closest<HTMLButtonElement>(".fileCommandActions button.payment");
      const commandButton = target.closest<HTMLButtonElement>(".fileCommandActions button");
      const commandText = commandButton?.textContent?.replace(/\s+/g, " ").trim() || "";
      const paymentHistoryButton = commandButton && commandText.includes("Ödeme Geçmişi");

      if (!alert && !paymentButton && !paymentHistoryButton) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof (event as any).stopImmediatePropagation === "function") {
        (event as any).stopImmediatePropagation();
      }
      void openCenter();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [studentId]);

  async function submitPayment() {
    if (!data?.enrollment?.id || submitting) {
      if (!data?.enrollment?.id) {
        setMessage("Ödeme alınabilmesi için öğrencinin aktif kayıt/paketi bulunmalıdır.");
        setMessageKind("error");
      }
      return;
    }

    const parsed = Number(amountValue.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setMessage("Geçerli bir ödeme tutarı giriniz.");
      setMessageKind("error");
      return;
    }

    if (data.enrollment.remainingPayment > 0 && parsed > data.enrollment.remainingPayment) {
      setMessage(`Girilen tutar kalan borçtan fazla olamaz. Kalan: ${money(data.enrollment.remainingPayment)}`);
      setMessageKind("error");
      return;
    }

    setSubmitting(true);
    setMessage("Ödeme kaydediliyor…");
    setMessageKind("");
    try {
      const result = await createStudentPayment({
        studentId,
        enrollmentId: data.enrollment.id,
        amount: parsed,
        paymentMethod: method,
        description: description.trim() || null,
      });

      setMessage(result.message);
      setMessageKind(result.ok ? "success" : "error");
      if (result.ok) {
        setDescription("");
        setAmountValue("");
        await load();
        router.refresh();
      }
    } catch {
      setMessage("Ödeme kaydedilirken bağlantı hatası oluştu.");
      setMessageKind("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const fullName = data
    ? `${data.student.first_name || ""} ${data.student.last_name || ""}`.trim()
    : "Öğrenci";

  return (
    <div className="studentPaymentOverlay" onClick={() => setOpen(false)}>
      <aside className="studentPaymentPanel" onClick={(event) => event.stopPropagation()}>
        <header className="studentPaymentHeader">
          <div>
            <span>FİNANS · ÖĞRENCİ DOSYASI</span>
            <h2>Ödeme İşlem Merkezi</h2>
            <p>{fullName} için tahsilat, borç ve ödeme geçmişini tek ekrandan yönetin.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Ödeme merkezini kapat">×</button>
        </header>

        <div className="studentPaymentBody">
          {loading ? <div className="paymentLoading">Ödeme bilgileri yükleniyor…</div> : null}

          {data?.enrollment ? (
            <>
              <section className="paymentSummaryGrid">
                <article><span>Paket Tutarı</span><strong>{money(data.enrollment.totalAmount)}</strong></article>
                <article><span>Toplam Tahsilat</span><strong>{money(data.enrollment.totalReceived)}</strong></article>
                <article className={data.enrollment.remainingPayment > 0 ? "debt" : "paid"}><span>Kalan Borç</span><strong>{money(data.enrollment.remainingPayment)}</strong></article>
                <article><span>Ödeme Vadesi</span><strong>{data.enrollment.paymentDueDate || "—"}</strong></article>
              </section>

              <section className="paymentReceiveCard">
                <div className="paymentSectionTitle">
                  <div><span>YENİ TAHSİLAT</span><h3>Ödeme Al</h3></div>
                  {data.enrollment.packageName ? <b>{data.enrollment.packageName}</b> : null}
                </div>
                <div className="paymentFormGrid">
                  <label>
                    <span>Tutar</span>
                    <input value={amountValue} onChange={(e) => setAmountValue(e.target.value)} inputMode="decimal" placeholder="Örn. 2.000" />
                  </label>
                  <label>
                    <span>Ödeme Yöntemi</span>
                    <select value={method} onChange={(e) => setMethod(e.target.value as any)}>
                      <option value="cash">Nakit</option>
                      <option value="card">Kart</option>
                      <option value="bank_transfer">Banka Havalesi</option>
                      <option value="eft">EFT</option>
                      <option value="other">Diğer</option>
                    </select>
                  </label>
                  <label className="full">
                    <span>Açıklama</span>
                    <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İsteğe bağlı ödeme notu" />
                  </label>
                </div>
                <button className="receiveButton" type="button" disabled={submitting} onClick={submitPayment}>
                  {submitting ? "Ödeme kaydediliyor…" : "✓ Ödemeyi Kaydet"}
                </button>
              </section>
            </>
          ) : !loading ? (
            <div className="paymentEmpty">Bu öğrenci için aktif kayıt bulunmadığından ödeme alınamaz.</div>
          ) : null}

          {message ? <div className={`paymentMessage ${messageKind}`}>{message}</div> : null}

          <section className="paymentHistoryCard">
            <div className="paymentSectionTitle">
              <div><span>TAHSİLAT GEÇMİŞİ</span><h3>Geçmiş Ödemeler</h3></div>
              <b>{data?.payments?.length || 0} kayıt</b>
            </div>
            <div className="paymentHistoryList">
              {(data?.payments || []).map((payment) => (
                <article key={payment.id}>
                  <div>
                    <strong>{money(payment.amount)}</strong>
                    <span>{METHOD_LABELS[payment.method] || payment.method}</span>
                  </div>
                  <div className="paymentHistoryMeta">
                    <span>{dateTime(payment.receivedAt)}</span>
                    {payment.description ? <small>{payment.description}</small> : null}
                  </div>
                </article>
              ))}
              {!loading && !(data?.payments || []).length ? (
                <div className="paymentEmpty">Henüz ödeme hareketi bulunmuyor.</div>
              ) : null}
            </div>
          </section>
        </div>

        <style jsx>{`
          .studentPaymentOverlay{position:fixed;inset:0;z-index:1600;display:flex;justify-content:flex-end;background:rgba(6,24,42,.62);backdrop-filter:blur(6px)}
          .studentPaymentPanel{width:min(720px,100vw);height:100%;display:flex;flex-direction:column;background:#f4f7fb;box-shadow:-24px 0 70px rgba(0,0,0,.25)}
          .studentPaymentHeader{display:flex;justify-content:space-between;gap:18px;padding:24px;background:linear-gradient(135deg,#073d2c,#0f8c58);color:#fff}.studentPaymentHeader span,.paymentSectionTitle span{font-size:10px;font-weight:950;letter-spacing:.13em;color:#f5b54c}.studentPaymentHeader h2{margin:5px 0 3px;font-size:27px}.studentPaymentHeader p{margin:0;color:#dff5ea;font-size:13px}.studentPaymentHeader button{width:42px;height:42px;border:1px solid rgba(255,255,255,.3);border-radius:12px;background:rgba(255,255,255,.1);color:#fff;font-size:25px;cursor:pointer}
          .studentPaymentBody{flex:1;overflow:auto;padding:20px}.paymentSummaryGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.paymentSummaryGrid article{padding:14px;border:1px solid #dce6ef;border-radius:15px;background:#fff}.paymentSummaryGrid span{display:block;color:#75869a;font-size:10px;font-weight:850}.paymentSummaryGrid strong{display:block;margin-top:5px;color:#123e68;font-size:17px}.paymentSummaryGrid .debt{border-color:#f3c8c8;background:#fff8f8}.paymentSummaryGrid .debt strong{color:#b22929}.paymentSummaryGrid .paid{border-color:#bfe3cf;background:#f3fbf7}.paymentSummaryGrid .paid strong{color:#17623b}
          .paymentReceiveCard,.paymentHistoryCard{padding:17px;border:1px solid #dce6ef;border-radius:17px;background:#fff;margin-bottom:16px}.paymentSectionTitle{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.paymentSectionTitle h3{margin:3px 0 0;color:#123e68;font-size:19px}.paymentSectionTitle b{padding:7px 9px;border-radius:999px;background:#edf5fb;color:#326180;font-size:10px}.paymentFormGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.paymentFormGrid label{display:grid;gap:6px}.paymentFormGrid label.full{grid-column:1/-1}.paymentFormGrid label>span{font-size:11px;font-weight:850;color:#50677e}.paymentFormGrid input,.paymentFormGrid select{width:100%;box-sizing:border-box;min-height:44px;border:1px solid #cedae6;border-radius:11px;padding:10px 12px;background:#fff;color:#153650;font:inherit}.receiveButton{width:100%;min-height:47px;margin-top:13px;border:0;border-radius:12px;background:#0c8a55;color:#fff;font-weight:950;cursor:pointer}.receiveButton:disabled{opacity:.6}
          .paymentHistoryList{display:grid;gap:8px}.paymentHistoryList article{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px;border:1px solid #e2e9f0;border-radius:12px;background:#fbfdff}.paymentHistoryList article>div:first-child{display:grid;gap:3px}.paymentHistoryList strong{color:#123e68;font-size:15px}.paymentHistoryList span,.paymentHistoryList small{color:#718397;font-size:11px}.paymentHistoryMeta{text-align:right;display:grid;gap:3px;max-width:60%}.paymentLoading,.paymentEmpty,.paymentMessage{padding:14px;border-radius:12px;margin-bottom:14px}.paymentLoading,.paymentEmpty{background:#fff;border:1px solid #dce6ef;color:#61788f;text-align:center}.paymentMessage.success{background:#edf9f2;border:1px solid #bfe3cf;color:#17623b}.paymentMessage.error{background:#fff1f1;border:1px solid #efcaca;color:#a12b2b}.paymentMessage:not(.success):not(.error){background:#eef5fb;border:1px solid #d6e5f1;color:#345b77}
          @media(max-width:680px){.studentPaymentHeader{padding:19px 16px}.studentPaymentHeader h2{font-size:23px}.studentPaymentBody{padding:14px}.paymentSummaryGrid{grid-template-columns:1fr 1fr}.paymentFormGrid{grid-template-columns:1fr}.paymentFormGrid label.full{grid-column:auto}.paymentHistoryList article{align-items:flex-start;flex-direction:column}.paymentHistoryMeta{text-align:left;max-width:none}.receiveButton{min-height:50px}}
        `}</style>
      </aside>
    </div>
  );
}

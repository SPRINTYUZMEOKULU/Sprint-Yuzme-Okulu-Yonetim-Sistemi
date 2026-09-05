"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createStudentPayment } from "../../odemeler/actions";
import { saveStudentPaymentPlan } from "./payment-plan-actions";

type Tab = "collect" | "plan" | "history";
type PaymentRow = {
  id: string;
  enrollmentId: string | null;
  amount: number;
  method: string;
  description: string | null;
  receivedAt: string | null;
  status: string | null;
};
type Installment = {
  id?: string;
  sequence_no: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: string;
};
type CenterData = {
  student: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  enrollment: null | {
    id: string;
    paymentDueDate: string | null;
    packageName: string | null;
    totalAmount: number;
    totalReceived: number;
    remainingPayment: number;
  };
  payments: PaymentRow[];
  paymentPlan: null | {
    id: string;
    total_amount: number;
    installment_count: number;
    status: string;
    note: string | null;
  };
  installments: Installment[];
  planSchemaReady: boolean;
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  card: "Kart",
  bank_transfer: "Banka Havalesi",
  eft: "EFT",
  other: "Diğer",
};
const money = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Istanbul",
      }).format(new Date(value))
    : "—";
const today = () => new Date().toISOString().slice(0, 10);
function addMonth(value: string, index: number) {
  const d = new Date(`${value}T12:00:00`);
  d.setMonth(d.getMonth() + index);
  return d.toISOString().slice(0, 10);
}
function equalInstallments(
  total: number,
  count: number,
  firstDate: string,
): Installment[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  let rest = cents - base * count;
  return Array.from({ length: count }, (_, i) => {
    const part = base + (rest-- > 0 ? 1 : 0);
    return {
      sequence_no: i + 1,
      due_date: addMonth(firstDate, i),
      amount: part / 100,
      paid_amount: 0,
      status: "pending",
    };
  });
}

export default function StudentPaymentCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("collect"),
    [data, setData] = useState<CenterData | null>(null);
  const [amountValue, setAmountValue] = useState(""),
    [method, setMethod] = useState<
      "cash" | "card" | "bank_transfer" | "eft" | "other"
    >("cash"),
    [description, setDescription] = useState(""),
    [installmentId, setInstallmentId] = useState("");
  const [installmentCount, setInstallmentCount] = useState(2),
    [firstDueDate, setFirstDueDate] = useState(today()),
    [planNote, setPlanNote] = useState(""),
    [planRows, setPlanRows] = useState<Installment[]>([]);
  const [message, setMessage] = useState(""),
    [messageKind, setMessageKind] = useState<"success" | "error" | "">("");
  const studentId = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : window.location.pathname.match(/\/ogrenciler\/([^/]+)/)?.[1] || "",
    [],
  );

  async function load() {
    if (!studentId) return;
    setLoading(true);
    setMessage("");
    setMessageKind("");
    try {
      const response = await fetch(
        `/api/student-payment-center?studentId=${encodeURIComponent(studentId)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setMessage(payload.error || "Ödeme bilgileri alınamadı.");
        setMessageKind("error");
        return;
      }
      setData(payload);
      const remaining = Number(payload.enrollment?.remainingPayment || 0);
      if (remaining > 0) setAmountValue(String(remaining));
      if (payload.installments?.length) {
        setPlanRows(payload.installments);
        setInstallmentCount(payload.installments.length);
        setFirstDueDate(payload.installments[0].due_date);
        setPlanNote(payload.paymentPlan?.note || "");
      } else if (remaining > 0) {
        const start = payload.enrollment?.paymentDueDate || today();
        setFirstDueDate(start);
        setPlanRows(equalInstallments(remaining, 2, start));
      }
    } catch {
      setMessage("Ödeme bilgileri yüklenirken bağlantı hatası oluştu.");
      setMessageKind("error");
    } finally {
      setLoading(false);
    }
  }
  async function openCenter(nextTab: Tab = "collect") {
    setTab(nextTab);
    setOpen(true);
    await load();
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "payment",
    );
    if (
      requested === "plan" ||
      requested === "collect" ||
      requested === "history"
    )
      void openCenter(requested);
  }, [studentId]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      const alert = target.closest<HTMLAnchorElement>(
        ".smartAlertGrid a[href='#odeme']",
      );
      const button = target.closest<HTMLButtonElement>(
        ".fileCommandActions button",
      );
      const text = button?.textContent?.replace(/\s+/g, " ").trim() || "";
      if (
        !alert &&
        !button?.classList.contains("payment") &&
        !text.includes("Ödeme Geçmişi")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      (event as any).stopImmediatePropagation?.();
      void openCenter(text.includes("Geçmişi") ? "history" : "collect");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [studentId]);

  async function submitPayment() {
    if (!data?.enrollment?.id || submitting) return;
    const parsed = Number(amountValue.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setMessage("Geçerli bir ödeme tutarı giriniz.");
      setMessageKind("error");
      return;
    }
    if (
      data.enrollment.remainingPayment > 0 &&
      parsed > data.enrollment.remainingPayment
    ) {
      setMessage(
        `Girilen tutar kalan borçtan fazla olamaz. Kalan: ${money(data.enrollment.remainingPayment)}`,
      );
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
        installmentId: installmentId || null,
      });
      setMessage(result.message);
      setMessageKind(result.ok ? "success" : "error");
      if (result.ok) {
        setDescription("");
        setInstallmentId("");
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
  function rebuildPlan() {
    if (!data?.enrollment) return;
    setPlanRows(
      equalInstallments(
        Number(data.enrollment.remainingPayment || 0),
        Math.max(1, Math.min(24, installmentCount)),
        firstDueDate || today(),
      ),
    );
  }
  async function savePlan() {
    if (!data?.enrollment?.id || submitting) return;
    setSubmitting(true);
    setMessage("Ödeme planı kaydediliyor…");
    setMessageKind("");
    const result = await saveStudentPaymentPlan({
      studentId,
      enrollmentId: data.enrollment.id,
      totalAmount: planRows.reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0,
      ),
      note: planNote,
      installments: planRows.map((row) => ({
        dueDate: row.due_date,
        amount: Number(row.amount),
      })),
    });
    setMessage(result.message);
    setMessageKind(result.ok ? "success" : "error");
    if (result.ok) {
      await load();
      router.refresh();
    }
    setSubmitting(false);
  }
  if (!open) return null;
  const fullName = data
    ? `${data.student.first_name || ""} ${data.student.last_name || ""}`.trim()
    : "Öğrenci";
  const pendingInstallments = (data?.installments || []).filter(
    (row) => row.status !== "paid" && row.status !== "cancelled",
  );

  return (
    <div className="studentPaymentOverlay" onClick={() => setOpen(false)}>
      <aside
        className="studentPaymentPanel"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="studentPaymentHeader">
          <div>
            <span>SPRİNTOS · ÖĞRENCİ FİNANS DOSYASI</span>
            <h2>Ödeme İşlem Merkezi</h2>
            <p>{fullName} · Tahsilat, plan, vade ve geçmiş tek ekranda</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Kapat"
          >
            ×
          </button>
        </header>
        <div className="studentPaymentBody">
          {loading ? (
            <div className="paymentLoading">Finans bilgileri hazırlanıyor…</div>
          ) : null}
          {data?.enrollment ? (
            <>
              <section className="paymentSummaryGrid">
                <article>
                  <span>Paket Tutarı</span>
                  <strong>{money(data.enrollment.totalAmount)}</strong>
                </article>
                <article>
                  <span>Toplam Tahsilat</span>
                  <strong>{money(data.enrollment.totalReceived)}</strong>
                </article>
                <article
                  className={
                    data.enrollment.remainingPayment > 0 ? "debt" : "paid"
                  }
                >
                  <span>Kalan Borç</span>
                  <strong>{money(data.enrollment.remainingPayment)}</strong>
                </article>
                <article>
                  <span>Sonraki Vade</span>
                  <strong>
                    {pendingInstallments[0]?.due_date ||
                      data.enrollment.paymentDueDate ||
                      "—"}
                  </strong>
                </article>
              </section>
              <nav className="paymentTabs" aria-label="Ödeme işlemleri">
                <button
                  className={tab === "collect" ? "active" : ""}
                  onClick={() => setTab("collect")}
                >
                  <b>₺</b>
                  <span>
                    Ödeme Al<small>Yeni tahsilat işle</small>
                  </span>
                </button>
                <button
                  className={tab === "plan" ? "active" : ""}
                  onClick={() => setTab("plan")}
                >
                  <b>▦</b>
                  <span>
                    Ödeme Planı Yap<small>Taksit ve vade oluştur</small>
                  </span>
                </button>
                <button
                  className={tab === "history" ? "active" : ""}
                  onClick={() => setTab("history")}
                >
                  <b>↻</b>
                  <span>
                    Geçmiş<small>Tüm hareketleri gör</small>
                  </span>
                </button>
              </nav>
              {message ? (
                <div className={`paymentMessage ${messageKind}`}>{message}</div>
              ) : null}
              {tab === "collect" ? (
                <section className="paymentCard">
                  <div className="paymentSectionTitle">
                    <div>
                      <span>YENİ TAHSİLAT</span>
                      <h3>Ödemeyi öğrenci dosyasına işle</h3>
                    </div>
                    <b>{data.enrollment.packageName || "Aktif Paket"}</b>
                  </div>
                  <div className="paymentFormGrid">
                    {pendingInstallments.length ? (
                      <label className="full">
                        <span>İlgili Taksit</span>
                        <select
                          value={installmentId}
                          onChange={(event) => {
                            setInstallmentId(event.target.value);
                            const row = pendingInstallments.find(
                              (item) => item.id === event.target.value,
                            );
                            if (row)
                              setAmountValue(
                                String(
                                  Math.max(
                                    0,
                                    Number(row.amount) -
                                      Number(row.paid_amount),
                                  ),
                                ),
                              );
                          }}
                        >
                          <option value="">Genel paket ödemesi</option>
                          {pendingInstallments.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.sequence_no}. Taksit · {row.due_date} · Kalan{" "}
                              {money(
                                Number(row.amount) - Number(row.paid_amount),
                              )}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label>
                      <span>Alınan Tutar</span>
                      <input
                        value={amountValue}
                        onChange={(event) => setAmountValue(event.target.value)}
                        inputMode="decimal"
                        placeholder="Örn. 2.000"
                      />
                    </label>
                    <label>
                      <span>Ödeme Yöntemi</span>
                      <select
                        value={method}
                        onChange={(event) =>
                          setMethod(event.target.value as any)
                        }
                      >
                        <option value="cash">Nakit</option>
                        <option value="card">Kart</option>
                        <option value="bank_transfer">Banka Havalesi</option>
                        <option value="eft">EFT</option>
                        <option value="other">Diğer</option>
                      </select>
                    </label>
                    <label className="full">
                      <span>Ödeme Notu</span>
                      <input
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="İsteğe bağlı açıklama"
                      />
                    </label>
                  </div>
                  <button
                    className="primaryPaymentButton"
                    disabled={
                      submitting || data.enrollment.remainingPayment <= 0
                    }
                    onClick={submitPayment}
                  >
                    {submitting
                      ? "Ödeme kaydediliyor…"
                      : "✓ Ödemeyi Al ve Kasaya İşle"}
                    <small>Nakit tahsilat kasa teslim onayına düşer</small>
                  </button>
                </section>
              ) : null}
              {tab === "plan" ? (
                <section className="paymentCard">
                  {!data.planSchemaReady ? (
                    <div className="paymentMessage error">
                      Ödeme planı sistemi için 016 numaralı SQL kurulumu
                      gereklidir.
                    </div>
                  ) : null}
                  <div className="paymentSectionTitle">
                    <div>
                      <span>VADE VE TAKSİT PLANI</span>
                      <h3>Profesyonel ödeme planı hazırla</h3>
                    </div>
                    <b>
                      {data.paymentPlan?.status === "active"
                        ? "Aktif Plan"
                        : "Yeni Plan"}
                    </b>
                  </div>
                  <div className="planControls">
                    <label>
                      <span>Taksit Sayısı</span>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={installmentCount}
                        onChange={(event) =>
                          setInstallmentCount(Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>İlk Vade Tarihi</span>
                      <input
                        type="date"
                        value={firstDueDate}
                        onChange={(event) =>
                          setFirstDueDate(event.target.value)
                        }
                      />
                    </label>
                    <button type="button" onClick={rebuildPlan}>
                      Taksitleri Otomatik Hesapla
                    </button>
                  </div>
                  <div className="installmentList">
                    {planRows.map((row, index) => (
                      <article key={index}>
                        <b>{index + 1}</b>
                        <label>
                          <span>Vade</span>
                          <input
                            type="date"
                            value={row.due_date}
                            onChange={(event) =>
                              setPlanRows((rows) =>
                                rows.map((item, i) =>
                                  i === index
                                    ? { ...item, due_date: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>Tutar</span>
                          <input
                            inputMode="decimal"
                            value={row.amount}
                            onChange={(event) =>
                              setPlanRows((rows) =>
                                rows.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        amount: Number(event.target.value),
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                        <em className={row.status}>
                          {row.status === "paid"
                            ? "Ödendi"
                            : row.status === "partial"
                              ? "Kısmi"
                              : "Bekliyor"}
                        </em>
                      </article>
                    ))}
                  </div>
                  <label className="planNote">
                    <span>Plan Notu</span>
                    <textarea
                      rows={3}
                      value={planNote}
                      onChange={(event) => setPlanNote(event.target.value)}
                      placeholder="Veliyle görüşülen ödeme planı notu"
                    />
                  </label>
                  <div className="planTotal">
                    <span>Plan Toplamı</span>
                    <strong>
                      {money(
                        planRows.reduce(
                          (sum, row) => sum + Number(row.amount || 0),
                          0,
                        ),
                      )}
                    </strong>
                  </div>
                  <button
                    className="primaryPaymentButton plan"
                    disabled={
                      submitting || !data.planSchemaReady || !planRows.length
                    }
                    onClick={savePlan}
                  >
                    {submitting
                      ? "Plan kaydediliyor…"
                      : "✓ Ödeme Planını Kaydet"}
                    <small>Vadeler bildirim ve veli ekranına bağlanır</small>
                  </button>
                </section>
              ) : null}
              {tab === "history" ? (
                <section className="paymentCard">
                  <div className="paymentSectionTitle">
                    <div>
                      <span>TAHSİLAT GEÇMİŞİ</span>
                      <h3>Geçmiş ödemeler</h3>
                    </div>
                    <b>{data.payments.length} kayıt</b>
                  </div>
                  <div className="paymentHistoryList">
                    {data.payments.map((payment) => (
                      <article key={payment.id}>
                        <div>
                          <strong>{money(payment.amount)}</strong>
                          <span>
                            {METHOD_LABELS[payment.method] || payment.method}
                          </span>
                        </div>
                        <div className="paymentHistoryMeta">
                          <span>{dateTime(payment.receivedAt)}</span>
                          {payment.description ? (
                            <small>{payment.description}</small>
                          ) : null}
                        </div>
                      </article>
                    ))}
                    {!data.payments.length ? (
                      <div className="paymentEmpty">
                        Henüz ödeme hareketi bulunmuyor.
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </>
          ) : !loading ? (
            <div className="paymentEmpty">
              Bu öğrenci için aktif kayıt bulunmadığından ödeme alınamaz.
            </div>
          ) : null}
        </div>
        <style jsx>{`
          .studentPaymentOverlay {
            position: fixed;
            inset: 0;
            z-index: 1600;
            display: flex;
            justify-content: flex-end;
            background: #06182aa8;
            backdrop-filter: blur(8px);
          }
          .studentPaymentPanel {
            width: min(780px, 100vw);
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #f4f7fb;
            box-shadow: -24px 0 70px #0004;
          }
          .studentPaymentHeader {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            padding: 24px;
            background: linear-gradient(135deg, #082f49, #075985 55%, #0e7490);
            color: #fff;
          }
          .studentPaymentHeader span,
          .paymentSectionTitle span {
            font-size: 10px;
            font-weight: 950;
            letter-spacing: 0.13em;
            color: #fbbf24;
          }
          .studentPaymentHeader h2 {
            margin: 5px 0 3px;
            font-size: 28px;
          }
          .studentPaymentHeader p {
            margin: 0;
            color: #dff6ff;
          }
          .studentPaymentHeader button {
            width: 44px;
            height: 44px;
            border: 1px solid #ffffff55;
            border-radius: 13px;
            background: #ffffff12;
            color: #fff;
            font-size: 26px;
          }
          .studentPaymentBody {
            flex: 1;
            overflow: auto;
            padding: 20px;
          }
          .paymentSummaryGrid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }
          .paymentSummaryGrid article {
            padding: 14px;
            border: 1px solid #dbe6f0;
            border-radius: 15px;
            background: #fff;
          }
          .paymentSummaryGrid span {
            display: block;
            color: #75869a;
            font-size: 10px;
            font-weight: 850;
          }
          .paymentSummaryGrid strong {
            display: block;
            margin-top: 5px;
            color: #123e68;
            font-size: 16px;
          }
          .paymentSummaryGrid .debt {
            border-color: #f2c4c4;
            background: #fff8f8;
          }
          .paymentSummaryGrid .debt strong {
            color: #b22929;
          }
          .paymentSummaryGrid .paid strong {
            color: #16804d;
          }
          .paymentTabs {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 9px;
            margin-bottom: 16px;
          }
          .paymentTabs button {
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 68px;
            padding: 11px;
            border: 1px solid #d7e2ec;
            border-radius: 15px;
            background: #fff;
            color: #40566d;
            text-align: left;
          }
          .paymentTabs button > b {
            width: 36px;
            height: 36px;
            display: grid;
            place-items: center;
            border-radius: 11px;
            background: #edf4fb;
            color: #1769e8;
            font-size: 20px;
          }
          .paymentTabs button > span {
            display: grid;
            font-weight: 900;
          }
          .paymentTabs small {
            font-size: 9px;
            font-weight: 600;
            color: #8290a0;
          }
          .paymentTabs button.active {
            border-color: #1d7be3;
            background: linear-gradient(135deg, #1769e8, #0e7bbc);
            color: #fff;
            box-shadow: 0 10px 25px #1769e833;
          }
          .paymentTabs button.active b {
            background: #ffffff26;
            color: #fff;
          }
          .paymentTabs button.active small {
            color: #dcedff;
          }
          .paymentCard {
            padding: 18px;
            border: 1px solid #dbe6f0;
            border-radius: 18px;
            background: #fff;
          }
          .paymentSectionTitle {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 15px;
          }
          .paymentSectionTitle h3 {
            margin: 3px 0;
            color: #123e68;
          }
          .paymentSectionTitle > b {
            padding: 7px 10px;
            border-radius: 999px;
            background: #edf5fb;
            color: #326180;
            font-size: 10px;
          }
          .paymentFormGrid,
          .planControls {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .paymentFormGrid label,
          .planControls label,
          .planNote {
            display: grid;
            gap: 6px;
          }
          .paymentFormGrid .full {
            grid-column: 1/-1;
          }
          .paymentFormGrid span,
          .planControls span,
          .planNote span,
          .installmentList label span {
            color: #50677e;
            font-size: 11px;
            font-weight: 850;
          }
          .paymentFormGrid input,
          .paymentFormGrid select,
          .planControls input,
          .planNote textarea,
          .installmentList input {
            width: 100%;
            box-sizing: border-box;
            min-height: 44px;
            padding: 10px 12px;
            border: 1px solid #cedae6;
            border-radius: 11px;
            background: #fff;
            color: #153650;
            font: inherit;
          }
          .primaryPaymentButton {
            width: 100%;
            min-height: 58px;
            display: grid;
            place-items: center;
            margin-top: 14px;
            padding: 9px;
            border: 0;
            border-radius: 14px;
            background: linear-gradient(135deg, #059669, #087f5b);
            color: #fff;
            font-size: 15px;
            font-weight: 950;
            box-shadow: 0 11px 25px #05966933;
          }
          .primaryPaymentButton.plan {
            background: linear-gradient(135deg, #1769e8, #0e7bbc);
            box-shadow: 0 11px 25px #1769e833;
          }
          .primaryPaymentButton small {
            font-size: 9px;
            font-weight: 650;
            opacity: 0.85;
          }
          .primaryPaymentButton:disabled {
            opacity: 0.55;
          }
          .planControls button {
            grid-column: 1/-1;
            min-height: 42px;
            border: 1px solid #bcd5ee;
            border-radius: 11px;
            background: #edf6ff;
            color: #1769e8;
            font-weight: 900;
          }
          .installmentList {
            display: grid;
            gap: 8px;
            margin: 14px 0;
          }
          .installmentList article {
            display: grid;
            grid-template-columns: 34px 1fr 1fr auto;
            gap: 9px;
            align-items: end;
            padding: 10px;
            border: 1px solid #e2eaf2;
            border-radius: 13px;
            background: #f9fbfd;
          }
          .installmentList article > b {
            width: 31px;
            height: 31px;
            display: grid;
            place-items: center;
            border-radius: 9px;
            background: #eaf3ff;
            color: #1769e8;
          }
          .installmentList label {
            display: grid;
            gap: 4px;
          }
          .installmentList em {
            padding: 6px 8px;
            border-radius: 999px;
            background: #fff3d8;
            color: #8a5c05;
            font-size: 9px;
            font-style: normal;
            font-weight: 900;
          }
          .installmentList em.paid {
            background: #e9f8ef;
            color: #176a40;
          }
          .planTotal {
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
            padding: 13px;
            border-radius: 12px;
            background: #eef6ff;
            color: #174b7a;
          }
          .planTotal strong {
            font-size: 18px;
          }
          .paymentHistoryList {
            display: grid;
            gap: 8px;
          }
          .paymentHistoryList article {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            padding: 12px;
            border: 1px solid #e2e9f0;
            border-radius: 12px;
            background: #fbfdff;
          }
          .paymentHistoryList article > div {
            display: grid;
            gap: 3px;
          }
          .paymentHistoryMeta {
            text-align: right;
          }
          .paymentHistoryList span,
          .paymentHistoryList small {
            color: #718397;
            font-size: 11px;
          }
          .paymentLoading,
          .paymentEmpty,
          .paymentMessage {
            padding: 14px;
            border-radius: 12px;
            margin-bottom: 14px;
          }
          .paymentLoading,
          .paymentEmpty {
            background: #fff;
            border: 1px solid #dce6ef;
            color: #61788f;
            text-align: center;
          }
          .paymentMessage.success {
            background: #edf9f2;
            border: 1px solid #bfe3cf;
            color: #17623b;
          }
          .paymentMessage.error {
            background: #fff1f1;
            border: 1px solid #efcaca;
            color: #a12b2b;
          }
          .paymentMessage:not(.success):not(.error) {
            background: #eef5fb;
            color: #345b77;
          }
          @media (max-width: 680px) {
            .studentPaymentHeader {
              padding: 18px 16px;
            }
            .studentPaymentHeader h2 {
              font-size: 23px;
            }
            .studentPaymentBody {
              padding: 13px;
            }
            .paymentSummaryGrid {
              grid-template-columns: 1fr 1fr;
            }
            .paymentTabs {
              grid-template-columns: 1fr;
            }
            .paymentTabs button {
              min-height: 58px;
            }
            .paymentFormGrid,
            .planControls {
              grid-template-columns: 1fr;
            }
            .paymentFormGrid .full {
              grid-column: auto;
            }
            .installmentList article {
              grid-template-columns: 32px 1fr 1fr;
            }
            .installmentList em {
              grid-column: 2/-1;
              justify-self: start;
            }
            .paymentHistoryList article {
              flex-direction: column;
            }
            .paymentHistoryMeta {
              text-align: left;
            }
          }
        `}</style>
      </aside>
    </div>
  );
}

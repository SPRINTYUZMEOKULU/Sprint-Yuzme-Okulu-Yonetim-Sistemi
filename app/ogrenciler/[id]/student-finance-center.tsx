"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createStudentPayment } from "../../odemeler/actions";
import { saveStudentPaymentPlan } from "./payment-plan-actions";

type PaymentMethod = "cash" | "card" | "bank_transfer" | "eft" | "other";
type Tab = "summary" | "debt" | "plan" | "history";

type PaymentRow = {
  id: string;
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
  paymentPlan: null | {
    id: string;
    total_amount: number;
    installment_count: number;
    status: string;
    note: string | null;
  };
  installments: Installment[];
};

type Obligation = {
  id: string;
  enrollment_id?: string | null;
  obligation_type?: string | null;
  title: string;
  description?: string | null;
  amount: number;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  due_date: string;
  status: string;
  is_overdue?: boolean | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const today = () => new Date().toISOString().slice(0, 10);

function addMonth(value: string, index: number) {
  const d = new Date(`${value}T12:00:00`);
  d.setMonth(d.getMonth() + index);
  return d.toISOString().slice(0, 10);
}

function splitInstallments(total: number, count: number, firstDate: string): Installment[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  let rest = cents - base * count;
  return Array.from({ length: count }, (_, i) => ({
    sequence_no: i + 1,
    due_date: addMonth(firstDate, i),
    amount: (base + (rest-- > 0 ? 1 : 0)) / 100,
    paid_amount: 0,
    status: "pending",
  }));
}

const methodLabels: Record<string, string> = {
  cash: "Nakit",
  card: "Kart",
  bank_transfer: "Banka Havalesi",
  eft: "EFT",
  other: "Diğer",
};

export default function StudentFinanceCenter() {
  const router = useRouter();
  const studentId = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : window.location.pathname.match(/\/ogrenciler\/([^/]+)/)?.[1] || "",
    [],
  );

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("summary");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [data, setData] = useState<CenterData | null>(null);
  const [obligations, setObligations] = useState<Obligation[]>([]);

  const [amountValue, setAmountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentDescription, setPaymentDescription] = useState("");

  const [debtTitle, setDebtTitle] = useState("Ek borç");
  const [debtType, setDebtType] = useState("other");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDueDate, setDebtDueDate] = useState(today());
  const [debtDescription, setDebtDescription] = useState("");

  const [planCount, setPlanCount] = useState(2);
  const [planFirstDate, setPlanFirstDate] = useState(today());
  const [planRows, setPlanRows] = useState<Installment[]>([]);
  const [planNote, setPlanNote] = useState("");

  async function load() {
    if (!studentId) return;
    setLoading(true);
    setMessage("");
    setError(false);
    try {
      const [financeResponse, obligationsResponse] = await Promise.all([
        fetch(`/api/student-payment-center?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
        fetch(`/api/student-obligations?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
      ]);
      const finance = await financeResponse.json();
      const debtPayload = await obligationsResponse.json();
      if (!financeResponse.ok || !finance.ok) throw new Error(finance.error || "Finans bilgileri alınamadı.");
      setData(finance);
      setObligations(debtPayload.obligations || []);
      const remaining = Number(finance.enrollment?.remainingPayment || 0);
      if (remaining > 0) setAmountValue(String(remaining));
      const first = finance.enrollment?.paymentDueDate || today();
      setPlanFirstDate(first);
      if (finance.installments?.length) {
        setPlanRows(finance.installments);
        setPlanCount(finance.installments.length);
        setPlanNote(finance.paymentPlan?.note || "");
      } else if (remaining > 0) {
        setPlanRows(splitInstallments(remaining, 2, first));
      }
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Finans bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function show(nextTab: Tab = "summary") {
    setTab(nextTab);
    setOpen(true);
    await load();
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("payment");
    if (requested === "collect") void show("summary");
    if (requested === "plan") void show("plan");
    if (requested === "history") void show("history");
  }, [studentId]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      const button = target.closest<HTMLElement>(".fileCommandActions button, .fileCommandActions a");
      const alert = target.closest<HTMLElement>(".smartAlertGrid a[href='#odeme'], .smartAlertGrid button");
      const text = (button?.textContent || alert?.textContent || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
      if (!button && !alert) return;
      if (!text.includes("ödeme") && !text.includes("vade")) return;
      event.preventDefault();
      event.stopPropagation();
      (event as any).stopImmediatePropagation?.();
      void show(text.includes("geçmiş") ? "history" : "summary");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [studentId]);

  async function collectPackagePayment() {
    if (!data?.enrollment?.id || busy) return;
    const amount = Number(amountValue.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(true);
      setMessage("Geçerli bir ödeme tutarı giriniz.");
      return;
    }
    if (amount > Number(data.enrollment.remainingPayment || 0)) {
      setError(true);
      setMessage(`Tutar kalan paket borcundan fazla olamaz: ${money(data.enrollment.remainingPayment)}`);
      return;
    }
    setBusy(true);
    const result = await createStudentPayment({
      studentId,
      enrollmentId: data.enrollment.id,
      amount,
      paymentMethod,
      description: paymentDescription.trim() || "Paket borcu tahsilatı",
      installmentId: null,
    });
    setBusy(false);
    setError(!result.ok);
    setMessage(result.message);
    if (result.ok) {
      setPaymentDescription("");
      await load();
      router.refresh();
    }
  }

  async function createDebt() {
    if (busy) return;
    const amount = Number(debtAmount.replace(/\./g, "").replace(",", "."));
    if (!debtTitle.trim() || !Number.isFinite(amount) || amount <= 0 || !debtDueDate) {
      setError(true);
      setMessage("Borç açıklaması, tutar ve vade tarihi zorunludur.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/student-obligations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        studentId,
        enrollmentId: data?.enrollment?.id || null,
        obligationType: debtType,
        title: debtTitle,
        description: debtDescription,
        amount,
        dueDate: debtDueDate,
        reminderDays: 3,
      }),
    });
    const payload = await response.json();
    setBusy(false);
    setError(!response.ok);
    setMessage(payload.message || payload.error || "İşlem tamamlanamadı.");
    if (response.ok) {
      setDebtAmount("");
      setDebtDescription("");
      setTab("summary");
      await load();
      router.refresh();
    }
  }

  async function collectDebt(row: Obligation) {
    if (busy) return;
    const remaining = Math.max(0, Number(row.remaining_amount ?? Number(row.amount) - Number(row.paid_amount || 0)));
    const raw = window.prompt(`${row.title} için alınan tutar`, String(remaining));
    if (!raw) return;
    const paidAmount = Number(raw.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount > remaining) {
      setError(true);
      setMessage(`Geçerli bir tutar giriniz. Azami ${money(remaining)}.`);
      return;
    }
    setBusy(true);
    const response = await fetch("/api/student-obligations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ obligationId: row.id, paidAmount, paymentMethod }),
    });
    const payload = await response.json();
    setBusy(false);
    setError(!response.ok);
    setMessage(payload.message || payload.error || "Tahsilat tamamlanamadı.");
    if (response.ok) {
      await load();
      router.refresh();
    }
  }

  function rebuildPlan() {
    const remaining = Number(data?.enrollment?.remainingPayment || 0);
    const count = Math.max(1, Math.min(24, Number(planCount || 1)));
    setPlanRows(splitInstallments(remaining, count, planFirstDate || today()));
  }

  async function savePlan() {
    if (!data?.enrollment?.id || busy || !planRows.length) return;
    setBusy(true);
    const result = await saveStudentPaymentPlan({
      studentId,
      enrollmentId: data.enrollment.id,
      totalAmount: planRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      note: planNote,
      installments: planRows.map((row) => ({ dueDate: row.due_date, amount: Number(row.amount) })),
    });
    setBusy(false);
    setError(!result.ok);
    setMessage(result.message);
    if (result.ok) {
      await load();
      router.refresh();
    }
  }

  if (!open) return null;

  const fullName = data ? `${data.student.first_name || ""} ${data.student.last_name || ""}`.trim() : "Öğrenci";
  const packageRemaining = Number(data?.enrollment?.remainingPayment || 0);
  const openDebts = obligations.filter((item) => !["paid", "cancelled"].includes(item.status));
  const extraRemaining = openDebts.reduce(
    (sum, item) => sum + Math.max(0, Number(item.remaining_amount ?? Number(item.amount) - Number(item.paid_amount || 0))),
    0,
  );
  const totalDebt = packageRemaining + extraRemaining;

  return (
    <div className="sfcOverlay" onMouseDown={() => setOpen(false)}>
      <section className="sfcPanel" onMouseDown={(e) => e.stopPropagation()}>
        <header className="sfcHeader">
          <div>
            <span>SPRİNTOS · ÖĞRENCİ FİNANS DOSYASI</span>
            <h2>Ödeme & Vade</h2>
            <p>{fullName} · Paket, borçlandırma, vade, taksit ve tahsilat tek merkezde</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Kapat">×</button>
        </header>

        <div className="sfcBody">
          {loading ? <div className="sfcLoading">Finans dosyası hazırlanıyor…</div> : null}

          <section className="sfcHeroGrid">
            <article><span>Toplam Borç</span><strong>{money(totalDebt)}</strong><small>Paket + açık ek borçlar</small></article>
            <article><span>Paket Borcu</span><strong>{money(packageRemaining)}</strong><small>{data?.enrollment?.packageName || "Aktif kayıt"}</small></article>
            <article><span>Ek Borçlar</span><strong>{money(extraRemaining)}</strong><small>{openDebts.length} açık kayıt</small></article>
            <article className={totalDebt > 0 ? "danger" : "success"}><span>Durum</span><strong>{totalDebt > 0 ? "Bekleniyor" : "Ödendi"}</strong><small>{data?.enrollment?.paymentDueDate || "Vade yok"}</small></article>
          </section>

          <nav className="sfcTabs">
            <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>Özet & Ödeme</button>
            <button className={tab === "debt" ? "active" : ""} onClick={() => setTab("debt")}>+ Borçlandır</button>
            <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}>Taksit Planı</button>
            <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Geçmiş</button>
          </nav>

          {message ? <div className={`sfcMessage ${error ? "error" : "success"}`}>{message}</div> : null}

          {tab === "summary" ? (
            <div className="sfcStack">
              <section className="sfcCard packageCard">
                <div className="sfcCardHead"><div><span>ANA PAKET BORCU</span><h3>{data?.enrollment?.packageName || "Aktif Kurs Paketi"}</h3></div><b>{money(packageRemaining)}</b></div>
                <div className="sfcInfoRow"><span>Toplam</span><b>{money(Number(data?.enrollment?.totalAmount || 0))}</b><span>Ödenen</span><b>{money(Number(data?.enrollment?.totalReceived || 0))}</b><span>Vade</span><b>{data?.enrollment?.paymentDueDate || "—"}</b></div>
                {packageRemaining > 0 ? (
                  <div className="sfcPayForm">
                    <label><span>Alınan Tutar</span><input value={amountValue} onChange={(e) => setAmountValue(e.target.value)} inputMode="decimal" /></label>
                    <label><span>Ödeme Yöntemi</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}><option value="cash">Nakit</option><option value="card">Kart</option><option value="bank_transfer">Banka Havalesi</option><option value="eft">EFT</option><option value="other">Diğer</option></select></label>
                    <label className="wide"><span>Ödeme Notu</span><input value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} placeholder="Örn. Veli ile görüşüldü / Eylül ödemesi" /></label>
                    <button disabled={busy} onClick={collectPackagePayment}>{busy ? "İşleniyor…" : "Ödeme Al"}</button>
                  </div>
                ) : <div className="sfcPaidBanner">Paket borcu tamamen kapandı.</div>}
              </section>

              <section className="sfcCard">
                <div className="sfcCardHead"><div><span>AÇIK BORÇLAR</span><h3>Vadeli borçlandırmalar</h3></div><button className="ghost" onClick={() => setTab("debt")}>+ Yeni Borç</button></div>
                {openDebts.length ? <div className="sfcDebtList">{openDebts.map((row) => {
                  const remaining = Math.max(0, Number(row.remaining_amount ?? Number(row.amount) - Number(row.paid_amount || 0)));
                  const overdue = Boolean(row.is_overdue) || (row.due_date < today() && row.status !== "paid");
                  return <article key={row.id} className={overdue ? "overdue" : ""}><div><span>{row.title}</span><small>{row.description || "Ek borç"}</small></div><div><span>Vade</span><b>{row.due_date}</b></div><div><span>Kalan</span><b>{money(remaining)}</b></div><div><span>Durum</span><b>{overdue ? "Vadesi Geçti" : row.status === "partially_paid" ? "Kısmi" : "Bekliyor"}</b></div><button disabled={busy} onClick={() => collectDebt(row)}>Ödeme Al</button></article>;
                })}</div> : <div className="sfcEmpty">Açık ek borç bulunmuyor.</div>}
              </section>
            </div>
          ) : null}

          {tab === "debt" ? (
            <section className="sfcCard">
              <div className="sfcCardHead"><div><span>YENİ BORÇLANDIRMA</span><h3>Öğrenciye vadeli borç oluştur</h3></div></div>
              <div className="sfcFormGrid">
                <label><span>Borç Türü</span><select value={debtType} onChange={(e) => setDebtType(e.target.value)}><option value="other">Diğer</option><option value="equipment">Malzeme</option><option value="service">Hizmet / Özel Ders</option><option value="installment">Ek Taksit</option></select></label>
                <label><span>Başlık</span><input value={debtTitle} onChange={(e) => setDebtTitle(e.target.value)} /></label>
                <label><span>Tutar</span><input value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} inputMode="decimal" placeholder="Örn. 1500" /></label>
                <label><span>Vade Tarihi</span><input type="date" value={debtDueDate} onChange={(e) => setDebtDueDate(e.target.value)} /></label>
                <label className="wide"><span>Açıklama / Not</span><textarea value={debtDescription} onChange={(e) => setDebtDescription(e.target.value)} placeholder="Örn. 2 özel ders ücreti, veli ile 15 Eylül için görüşüldü." /></label>
              </div>
              <div className="sfcActions"><button className="secondary" onClick={() => setTab("summary")}>Vazgeç</button><button disabled={busy} onClick={createDebt}>{busy ? "Kaydediliyor…" : "Borçlandır ve Takibe Al"}</button></div>
            </section>
          ) : null}

          {tab === "plan" ? (
            <section className="sfcCard">
              <div className="sfcCardHead"><div><span>TAKSİT PLANI</span><h3>Paket borcunu vadelere böl</h3></div><b>{money(packageRemaining)}</b></div>
              <div className="sfcPlanControls"><label><span>Taksit Sayısı</span><input type="number" min={1} max={24} value={planCount} onChange={(e) => setPlanCount(Number(e.target.value))} /></label><label><span>İlk Vade</span><input type="date" value={planFirstDate} onChange={(e) => setPlanFirstDate(e.target.value)} /></label><button onClick={rebuildPlan}>Planı Hesapla</button></div>
              <div className="sfcInstallments">{planRows.map((row, index) => <div key={`${row.sequence_no}-${index}`}><b>{row.sequence_no}. Taksit</b><input type="date" value={row.due_date} onChange={(e) => setPlanRows((rows) => rows.map((x, i) => i === index ? { ...x, due_date: e.target.value } : x))} /><input inputMode="decimal" value={row.amount} onChange={(e) => setPlanRows((rows) => rows.map((x, i) => i === index ? { ...x, amount: Number(e.target.value) } : x))} /><span>{row.status === "paid" ? "Ödendi" : row.status === "partial" ? "Kısmi" : "Bekliyor"}</span></div>)}</div>
              <label className="sfcNote"><span>Plan Notu</span><textarea value={planNote} onChange={(e) => setPlanNote(e.target.value)} placeholder="Veli ile kararlaştırılan ödeme planı notu" /></label>
              <div className="sfcActions"><button disabled={busy || packageRemaining <= 0} onClick={savePlan}>{busy ? "Kaydediliyor…" : "Ödeme Planını Kaydet"}</button></div>
            </section>
          ) : null}

          {tab === "history" ? (
            <section className="sfcCard">
              <div className="sfcCardHead"><div><span>TAHSİLAT GEÇMİŞİ</span><h3>Öğrencinin ödeme hareketleri</h3></div></div>
              {data?.payments?.length ? <div className="sfcHistory">{data.payments.map((row) => <article key={row.id}><div><b>{money(Number(row.amount || 0))}</b><span>{methodLabels[row.method] || row.method || "Ödeme"}</span></div><div><span>{row.description || "Ödeme alındı"}</span><small>{row.receivedAt ? new Date(row.receivedAt).toLocaleString("tr-TR") : "—"}</small></div></article>)}</div> : <div className="sfcEmpty">Henüz ödeme hareketi yok.</div>}
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createStudentPayment,
  updatePaymentDueDate,
} from "../../odemeler/actions";

type PaymentMethod = "cash" | "card" | "bank_transfer" | "eft" | "other";
type Tab = "payment" | "due" | "debt" | "history";

type PaymentRow = {
  id: string;
  enrollmentId: string | null;
  amount: number;
  method: string;
  description: string | null;
  receivedAt: string | null;
  status: string | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  packageName?: string | null;
  packagePrice?: number;
};

type CenterData = {
  student: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    guardian_name?: string | null;
    guardian_phone?: string | null;
  };
  enrollment: null | {
    id: string;
    startDate: string | null;
    plannedEndDate: string | null;
    paymentDueDate: string | null;
    packageName: string | null;
    lessonCount: number;
    totalAmount: number;
    totalReceived: number;
    remainingPayment: number;
  };
  payments: PaymentRow[];
};

type Obligation = {
  id: string;
  title: string;
  amount: number;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  due_date: string;
  status: string;
};

const methodLabels: Record<string, string> = {
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

const today = () => new Date().toISOString().slice(0, 10);

function dateText(value?: string | null) {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("tr-TR");
}

function parseAmount(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function normalizePhone(value?: string | null) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("0") && phone.length === 11) phone = `90${phone.slice(1)}`;
  if (phone.length === 10 && phone.startsWith("5")) phone = `90${phone}`;
  return phone;
}

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
  const [tab, setTab] = useState<Tab>("payment");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [data, setData] = useState<CenterData | null>(null);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [lastPayment, setLastPayment] = useState<PaymentRow | null>(null);

  const [amountValue, setAmountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [dueReason, setDueReason] = useState("");

  const [debtTitle, setDebtTitle] = useState("Ek borç");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDueDate, setDebtDueDate] = useState(today());
  const [debtDescription, setDebtDescription] = useState("");

  async function load() {
    if (!studentId) return;
    setLoading(true);
    try {
      const [financeResponse, obligationsResponse] = await Promise.all([
        fetch(`/api/student-payment-center?studentId=${encodeURIComponent(studentId)}`, {
          cache: "no-store",
        }),
        fetch(`/api/student-obligations?studentId=${encodeURIComponent(studentId)}`, {
          cache: "no-store",
        }),
      ]);
      const finance = await financeResponse.json();
      const debtPayload = await obligationsResponse.json();
      if (!financeResponse.ok || !finance.ok) {
        throw new Error(finance.error || "Finans bilgileri alınamadı.");
      }
      setData(finance);
      setObligations(debtPayload.obligations || []);
      const remaining = Number(finance.enrollment?.remainingPayment || 0);
      setAmountValue(remaining > 0 ? String(remaining) : "");
      setDueDate(finance.enrollment?.paymentDueDate || today());
      setLastPayment(finance.payments?.[0] || null);
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Finans bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function show(nextTab: Tab = "payment") {
    setTab(nextTab);
    setOpen(true);
    setMessage("");
    setError(false);
    await load();
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("payment");
    if (requested === "history") void show("history");
    else if (requested === "due" || requested === "plan") void show("due");
    else if (requested === "debt") void show("debt");
    else if (requested === "collect") void show("payment");
  }, [studentId]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      const button = target.closest<HTMLElement>(
        ".fileCommandActions button, .fileCommandActions a",
      );
      const alert = target.closest<HTMLElement>(
        ".smartAlertGrid a[href='#odeme'], .smartAlertGrid button",
      );
      if (!button && !alert) return;
      const text = (button?.textContent || alert?.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("tr-TR");
      if (!text.includes("ödeme") && !text.includes("vade")) return;
      event.preventDefault();
      event.stopPropagation();
      (event as any).stopImmediatePropagation?.();
      if (text.includes("geçmiş")) void show("history");
      else if (text.includes("vade")) void show("due");
      else void show("payment");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [studentId]);

  async function collectPackagePayment() {
    if (!data?.enrollment?.id || busy) return;
    const amount = parseAmount(amountValue);
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

    const periodText = `${dateText(data.enrollment.startDate)} - ${dateText(data.enrollment.plannedEndDate)}`;
    const autoDescription = `${periodText} tarihleri arasındaki ${data.enrollment.packageName || "kurs paketi"} ödemesi`;

    setBusy(true);
    const result = await createStudentPayment({
      studentId,
      enrollmentId: data.enrollment.id,
      amount,
      paymentMethod,
      description: paymentDescription.trim() || autoDescription,
      installmentId: null,
    });
    setBusy(false);
    setError(!result.ok);
    setMessage(result.message);
    if (result.ok) {
      setPaymentDescription("");
      await load();
      setTab("history");
      router.refresh();
    }
  }

  async function saveDueDate() {
    if (!data?.enrollment?.id || !dueDate || busy) return;
    setBusy(true);
    const result = await updatePaymentDueDate(
      data.enrollment.id,
      dueDate,
      dueReason.trim() || "Öğrenci finans dosyası üzerinden vade tarihi güncellendi.",
    );
    setBusy(false);
    setError(!result.ok);
    setMessage(result.message);
    if (result.ok) {
      setDueReason("");
      await load();
      router.refresh();
    }
  }

  async function createDebt() {
    const amount = parseAmount(debtAmount);
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
        obligationType: "other",
        title: debtTitle,
        description: debtDescription,
        amount,
        dueDate: debtDueDate,
        reminderDays: 0,
      }),
    });
    const payload = await response.json();
    setBusy(false);
    setError(!response.ok);
    setMessage(payload.message || payload.error || "İşlem tamamlanamadı.");
    if (response.ok) {
      setDebtAmount("");
      setDebtDescription("");
      await load();
      setTab("payment");
      router.refresh();
    }
  }

  function openPaymentReceivedMessage(payment?: PaymentRow | null) {
    if (!data) return;
    const row = payment || lastPayment;
    if (!row) return;
    const phone = normalizePhone(data.student.guardian_phone || data.student.phone);
    if (!phone) {
      setError(true);
      setMessage("Öğrenci/veli telefon bilgisi bulunamadı.");
      return;
    }
    const name = `${data.student.first_name || ""} ${data.student.last_name || ""}`.trim();
    const start = dateText(row.periodStartDate || data.enrollment?.startDate);
    const end = dateText(row.periodEndDate || data.enrollment?.plannedEndDate);
    const packageName = row.packageName || data.enrollment?.packageName || "kurs paketi";
    const text =
      `SPRİNT YÜZME OKULU\n\n` +
      `Sayın Velimiz/Kursiyerimiz,\n\n` +
      `${name} için ${start} - ${end} tarihleri arasındaki ${packageName} dönemine ait ` +
      `${money(row.amount)} ödeme tarafımıza ulaşmıştır.\n\n` +
      `Ödemeniz başarıyla kaydedilmiştir. Teşekkür ederiz.\n\n` +
      `SPRİNT Bilgilendirme Hattı: 0551 896 83 19`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  if (!open) return null;

  const packageRemaining = Number(data?.enrollment?.remainingPayment || 0);
  const openDebts = obligations.filter((item) => !["paid", "cancelled"].includes(item.status));
  const extraRemaining = openDebts.reduce(
    (sum, item) =>
      sum + Math.max(0, Number(item.remaining_amount ?? Number(item.amount) - Number(item.paid_amount || 0))),
    0,
  );
  const totalDebt = packageRemaining + extraRemaining;
  const fullName = data
    ? `${data.student.first_name || ""} ${data.student.last_name || ""}`.trim()
    : "Öğrenci";

  return (
    <div className="sfcOverlay" onMouseDown={() => setOpen(false)}>
      <section className="sfcPanel" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sfcHeader">
          <div>
            <span>SPRİNTOS · ÖĞRENCİ FİNANS DOSYASI</span>
            <h2>Ödeme & Vade</h2>
            <p>{fullName} · Paket borcu, vade, tahsilat ve geçmiş tek merkezde</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Kapat">×</button>
        </header>

        <div className="sfcBody">
          {loading ? <div className="sfcLoading">Finans dosyası hazırlanıyor…</div> : null}

          <section className="sfcHeroGrid">
            <article><span>Toplam Borç</span><strong>{money(totalDebt)}</strong><small>Paket + açık ek borçlar</small></article>
            <article><span>Paket Ücreti</span><strong>{money(Number(data?.enrollment?.totalAmount || 0))}</strong><small>{data?.enrollment?.packageName || "Aktif kayıt"}</small></article>
            <article><span>Ödenen</span><strong>{money(Number(data?.enrollment?.totalReceived || 0))}</strong><small>Aktif kayıt dönemi</small></article>
            <article className={totalDebt > 0 ? "danger" : "success"}><span>Durum</span><strong>{totalDebt > 0 ? "Bekleniyor" : "Ödendi"}</strong><small>{data?.enrollment?.paymentDueDate ? `Vade: ${dateText(data.enrollment.paymentDueDate)}` : "Vade yok"}</small></article>
          </section>

          <nav className="sfcTabs">
            <button className={tab === "payment" ? "active" : ""} onClick={() => setTab("payment")}>Ödeme Al</button>
            <button className={tab === "due" ? "active" : ""} onClick={() => setTab("due")}>Vade Belirle</button>
            <button className={tab === "debt" ? "active" : ""} onClick={() => setTab("debt")}>+ Borçlandır</button>
            <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Ödeme Geçmişi</button>
          </nav>

          {message ? <div className={`sfcMessage ${error ? "error" : "success"}`}>{message}</div> : null}

          {tab === "payment" ? (
            <section className="sfcCard">
              <div className="sfcCardHead">
                <div><span>AKTİF KAYIT BORCU</span><h3>{data?.enrollment?.packageName || "Aktif Kurs Paketi"}</h3></div>
                <b>{money(packageRemaining)}</b>
              </div>
              {data?.enrollment ? (
                <>
                  <div className="sfcInfoBox">
                    <div><span>Dönem</span><b>{dateText(data.enrollment.startDate)} - {dateText(data.enrollment.plannedEndDate)}</b></div>
                    <div><span>Paket Ücreti</span><b>{money(data.enrollment.totalAmount)}</b></div>
                    <div><span>Ödenen</span><b>{money(data.enrollment.totalReceived)}</b></div>
                    <div><span>Kalan</span><b>{money(data.enrollment.remainingPayment)}</b></div>
                    <div><span>Vade</span><b>{dateText(data.enrollment.paymentDueDate)}</b></div>
                  </div>
                  {packageRemaining > 0 ? (
                    <div className="sfcFormGrid">
                      <label>Ödeme Tutarı<input value={amountValue} onChange={(e) => setAmountValue(e.target.value)} inputMode="decimal" /></label>
                      <label>Ödeme Yöntemi<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}><option value="cash">Nakit</option><option value="card">Kart</option><option value="bank_transfer">Banka Havalesi</option><option value="eft">EFT</option><option value="other">Diğer</option></select></label>
                      <label className="full">Ödeme Notu<input value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} placeholder="Boş bırakırsanız dönem bilgisi otomatik yazılır" /></label>
                      <button className="sfcPrimary full" type="button" disabled={busy} onClick={collectPackagePayment}>{busy ? "Kaydediliyor…" : "Ödemeyi Kaydet"}</button>
                    </div>
                  ) : <div className="sfcPaid">Paket borcu tamamen kapandı.</div>}
                </>
              ) : <div className="sfcEmpty">Aktif kayıt/paket bulunamadı.</div>}
            </section>
          ) : null}

          {tab === "due" ? (
            <section className="sfcCard">
              <div className="sfcCardHead"><div><span>VADE TARİHİ</span><h3>Ödeme vadesini belirle</h3></div></div>
              <div className="sfcFormGrid">
                <label className="full">Yeni Vade Tarihi<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
                <label className="full">Vade Notu<textarea rows={3} value={dueReason} onChange={(e) => setDueReason(e.target.value)} /></label>
                <div className="sfcNotice full">Vade günü geldiğinde borç açıksa SprintOS bildirim merkezine otomatik uyarı düşer.</div>
                <button className="sfcPrimary full" type="button" disabled={busy || !dueDate} onClick={saveDueDate}>Vade Tarihini Kaydet</button>
              </div>
            </section>
          ) : null}

          {tab === "debt" ? (
            <section className="sfcCard">
              <div className="sfcCardHead"><div><span>EK BORÇLANDIRMA</span><h3>Paket dışı borç ekle</h3></div></div>
              <div className="sfcFormGrid">
                <label className="full">Borç Başlığı<input value={debtTitle} onChange={(e) => setDebtTitle(e.target.value)} /></label>
                <label>Tutar<input value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} inputMode="decimal" /></label>
                <label>Vade Tarihi<input type="date" value={debtDueDate} onChange={(e) => setDebtDueDate(e.target.value)} /></label>
                <label className="full">Açıklama<textarea rows={3} value={debtDescription} onChange={(e) => setDebtDescription(e.target.value)} /></label>
                <button className="sfcPrimary full" type="button" disabled={busy} onClick={createDebt}>Borcu Kaydet</button>
              </div>
            </section>
          ) : null}

          {tab === "history" ? (
            <section className="sfcCard">
              <div className="sfcCardHead"><div><span>TAHSİLAT GEÇMİŞİ</span><h3>Öğrencinin ödeme hareketleri</h3></div></div>
              {data?.payments?.length ? (
                <div className="sfcHistory">
                  {data.payments.map((row) => (
                    <article key={row.id}>
                      <div>
                        <b>{money(row.amount)} · {methodLabels[row.method] || row.method}</b>
                        <span>{row.packageName || "Kurs paketi"}</span>
                        <span>{dateText(row.periodStartDate)} - {dateText(row.periodEndDate)} tarihleri arasındaki paketin ücreti ödendi.</span>
                        <small>{row.receivedAt ? new Date(row.receivedAt).toLocaleString("tr-TR") : "—"}</small>
                      </div>
                      <button className="sfcMini" type="button" onClick={() => openPaymentReceivedMessage(row)}>WhatsApp · Ödeme Alındı</button>
                    </article>
                  ))}
                </div>
              ) : <div className="sfcEmpty">Henüz ödeme hareketi yok.</div>}
            </section>
          ) : null}
        </div>
      </section>

      <style jsx global>{`
        .sfcOverlay{position:fixed;inset:0;z-index:10000;background:rgba(8,28,55,.42);display:flex;justify-content:center;align-items:flex-start;overflow:auto}.sfcPanel{width:min(760px,100%);min-height:100vh;background:#f4f8fe}.sfcHeader{background:linear-gradient(135deg,#176fe8,#2c83ef);color:#fff;padding:34px 28px;display:flex;justify-content:space-between;gap:20px;position:sticky;top:0;z-index:3}.sfcHeader span{font-size:13px;font-weight:900;letter-spacing:2px}.sfcHeader h2{font-size:36px;margin:10px 0}.sfcHeader p{margin:0}.sfcHeader button{width:54px;height:54px;border:0;border-radius:18px;background:rgba(255,255,255,.17);color:#fff;font-size:38px}.sfcBody{padding:24px}.sfcHeroGrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.sfcHeroGrid article,.sfcCard{background:#fff;border:1px solid #d8e5f5;border-radius:24px;padding:22px}.sfcHeroGrid span,.sfcCardHead span{display:block;color:#75869d;text-transform:uppercase;font-size:13px;font-weight:900;letter-spacing:1.3px}.sfcHeroGrid strong{display:block;color:#112b4d;font-size:28px;margin:10px 0 5px}.sfcHeroGrid .success{background:#eefaf4}.sfcHeroGrid .danger{background:#fff4f4}.sfcTabs{margin:20px 0;display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#fff;border:1px solid #d8e5f5;border-radius:24px;padding:12px}.sfcTabs button{min-height:58px;border:0;border-radius:18px;background:#f2f6fb;color:#506681;font-size:17px;font-weight:900}.sfcTabs button.active{background:#176fe8;color:#fff}.sfcMessage{margin-bottom:16px;padding:15px 18px;border-radius:16px;font-weight:800}.sfcMessage.success{background:#eaf8f0;color:#147a47}.sfcMessage.error{background:#fff0f0;color:#b4323b}.sfcCardHead{display:flex;justify-content:space-between;gap:16px;margin-bottom:20px}.sfcCardHead h3{margin:6px 0 0;color:#112b4d;font-size:25px}.sfcInfoBox{background:#f5f8fc;border-radius:20px;padding:18px;display:grid;gap:12px}.sfcInfoBox div{display:flex;justify-content:space-between;gap:12px}.sfcFormGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}.sfcFormGrid label{display:grid;gap:8px;color:#425b79;font-weight:800}.sfcFormGrid input,.sfcFormGrid select,.sfcFormGrid textarea{width:100%;box-sizing:border-box;border:1px solid #cfdeef;border-radius:15px;padding:14px;font:inherit}.sfcFormGrid .full{grid-column:1/-1}.sfcPrimary{border:0;border-radius:17px;background:#176fe8;color:#fff;padding:16px;font-size:18px;font-weight:900}.sfcNotice{padding:16px;border-radius:16px;background:#fff7df;color:#805d00;font-weight:700}.sfcPaid{margin-top:18px;padding:18px;border-radius:18px;background:#eaf8f0;color:#187c4a;font-weight:900}.sfcHistory{display:grid;gap:12px}.sfcHistory article{border:1px solid #dce7f4;border-radius:18px;padding:16px;display:flex;justify-content:space-between;align-items:center;gap:15px}.sfcHistory article>div{display:grid;gap:5px}.sfcHistory span,.sfcHistory small{color:#71839b}.sfcMini{border:1px solid #bcd4f1;background:#fff;color:#176fe8;border-radius:14px;padding:10px 13px;font-weight:900}.sfcEmpty,.sfcLoading{padding:24px;border:1px solid #d8e5f5;border-radius:20px;background:#fff;color:#63758d}@media(max-width:600px){.sfcHeader{padding:28px 22px}.sfcHeader h2{font-size:31px}.sfcBody{padding:18px}.sfcHeroGrid{gap:10px}.sfcHeroGrid article{padding:17px}.sfcHeroGrid strong{font-size:22px}.sfcTabs{gap:9px;padding:9px}.sfcTabs button{font-size:15px}.sfcFormGrid{grid-template-columns:1fr}.sfcFormGrid .full{grid-column:auto}.sfcHistory article{flex-direction:column;align-items:stretch}}
      `}</style>
    </div>
  );
}

import { requireProfile } from "@/lib/auth/profile";
import {
  formatDate,
  formatMoney,
  getGuardianContext,
} from "@/lib/guardian/data";
import { EmptyGuardian, GuardianHeader, StatusPill } from "@/app/veli-paneli/guardian-ui";
import { guardianPaymentSummary } from "@/lib/guardian/payment-summary";
import "@/app/veli-paneli/veli.css";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const profile = await requireProfile(["guardian"]);
  const { child } = await searchParams;
  const data = await getGuardianContext(profile.id, child);
  if(!data.selected) return <main className="guardianShell"><GuardianHeader name={profile.full_name || "Değerli Velimiz"} students={data.students} issues={data.issues}/><div className="guardianContent"><EmptyGuardian title="Bağlı kursiyer bulunamadı" text="Hesabınıza aktif kursiyer bağlandığında ödeme bilgileri burada görüntülenir."/></div></main>;
  const financeReady=!data.issues.some(issue=>issue.startsWith("Ödeme"));
  const planResult = {data:data.paymentPlan};
  const installments = data.paymentInstallments;
  const {paid, price, debt} = guardianPaymentSummary(data.enrollment, data.coursePackage, data.payments, data.paymentPlan);
  return (
    <main className="guardianShell">
      <GuardianHeader
        name={profile.full_name || "Değerli Velimiz"}
        issues={data.issues} students={data.students}
        selectedId={data.selected?.id}
      />
      <div className="guardianContent">
        <h1 className="guardianSectionTitle">Ödemeler ve Paket</h1>
        <p className="guardianSectionLead">
          Paket ücreti, alınan ödemeler ve kalan ödeme bilgisi.
        </p>
        <section className="guardianStats">
          <article className="guardianStat">
            <span>Paket</span>
            <strong>{data.coursePackage?.name || "—"}</strong>
          </article>
          <article className="guardianStat">
            <span>Paket Ücreti</span>
            <strong>{financeReady?formatMoney(price):"Bilgi alınamadı"}</strong>
          </article>
          <article className="guardianStat">
            <span>Bu pakette ödenen</span>
            <strong>{financeReady?formatMoney(paid):"Bilgi alınamadı"}</strong>
          </article>
          <article className="guardianStat">
            <span>Kalan</span>
            <strong>{financeReady?formatMoney(debt):"Bilgi alınamadı"}</strong>
          </article>
        </section>
        {planResult.data ? (
          <section className="guardianCard" style={{ marginTop: 18 }}>
            <p className="guardianEyebrow">ÖDEME PLANI</p>
            <h2>Vade ve taksitler</h2>
            <div className="guardianTableWrap">
              <table className="guardianTable">
                <thead>
                  <tr>
                    <th>Taksit</th>
                    <th>Vade</th>
                    <th>Tutar</th>
                    <th>Kalan</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((item: any) => (
                    <tr key={item.id}>
                      <td>{item.sequence_no}. taksit</td>
                      <td>{formatDate(item.due_date)}</td>
                      <td>{formatMoney(item.amount)}</td>
                      <td>{formatMoney(Math.max(0, Number(item.amount) - Number(item.paid_amount || 0)))}</td>
                      <td><StatusPill tone={item.status === "paid" ? "green" : item.status === "overdue" ? "red" : "blue"}>{item.status === "paid" ? "Ödendi" : item.status === "partial" ? "Kısmi" : item.status === "overdue" ? "Gecikti" : "Bekliyor"}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {planResult.data.note ? <p className="guardianSectionLead">Not: {planResult.data.note}</p> : null}
          </section>
        ) : null}
        <section className="guardianCard" style={{ marginTop: 18 }}>
          <h2>Ödeme Geçmişi</h2><p className="guardianSectionLead">Tüm kayıt dönemlerindeki tahsilatlar. Üstteki bakiye mevcut pakete aittir.</p><table className="guardianTable">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tutar</th>
                <th>Yöntem</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p: any) => (
                <tr key={p.id}>
                  <td>{formatDate(String(p.received_at).slice(0, 10))}</td>
                  <td>{formatMoney(p.amount)}</td>
                  <td>
                    {p.payment_method === "cash"
                      ? "Nakit"
                      : p.payment_method === "card"
                        ? "Kart"
                        : ["transfer","bank_transfer","eft"].includes(p.payment_method)
                          ? "Havale/EFT"
                          : "Diğer"}
                  </td>
                  <td>
                    <StatusPill
                      tone={["recorded", "paid", "completed"].includes(p.payment_status) ? "green" : "red"}
                    >
                      {["recorded", "paid", "completed"].includes(p.payment_status)
                        ? "Alındı"
                        : "İptal/İade"}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.payments.length ? (
            <p className="guardianSectionLead">Henüz ödeme kaydı bulunmuyor.</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

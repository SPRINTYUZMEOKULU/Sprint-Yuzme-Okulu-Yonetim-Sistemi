import HistoryPagination from "@/app/veli-paneli/history-pagination";
import {loadGuardianPage} from "@/lib/guardian/page-context";
import {
  formatDate,
  formatMoney,
} from "@/lib/guardian/data";
import { EmptyGuardian, GuardianHeader, StatusPill } from "@/app/veli-paneli/guardian-ui";
import PaymentReminder from "@/app/veli-paneli/payment-reminder";
import { guardianCombinedReminder, guardianObligationSummary, paymentPresentation, installmentPresentation, guardianPaymentSummary } from "@/lib/guardian/payment-summary";
import "@/app/veli-paneli/veli.css";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; previewGuardian?:string;page?:string }>;
}) {
  const query=await searchParams; const {profile,data,previewGuardian}=await loadGuardianPage(query,"payments");
  if(!data.selected) return <main className="guardianShell"><GuardianHeader previewGuardian={previewGuardian} name={profile.full_name || "Değerli Velimiz"} students={data.students} issues={data.issues}/><div className="guardianContent"><EmptyGuardian title="Bağlı kursiyer bulunamadı" text="Hesabınıza aktif kursiyer bağlandığında ödeme bilgileri burada görüntülenir."/></div></main>;
  const history=data.paymentHistory??data.payments;
  const financeReady=!data.issues.some(issue=>issue.startsWith("Ödeme"));
  const planResult = {data:data.paymentPlan};
  const installments = data.paymentPlan?.status==="cancelled"?[]:data.paymentInstallments;
  const {paid, price, debt, excess} = guardianPaymentSummary(data.enrollment, data.coursePackage, data.payments, data.paymentPlan);
  const extras=guardianObligationSummary(data.obligations||[]);
  const totalDebt=debt+extras.debt;
  return (
    <main className="guardianShell">
      <GuardianHeader previewGuardian={previewGuardian}
        name={profile.full_name || "Değerli Velimiz"}
        issues={data.issues} students={data.students}
        selectedId={data.selected?.id}
      />
      <div className="guardianContent">
        <h1 className="guardianSectionTitle">Ödemeler ve Paket</h1>
        <p className="guardianSectionLead">
          Paket ücreti, alınan ödemeler ve kalan ödeme bilgisi.
        </p>
      <PaymentReminder reminder={data.issues.some(issue=>issue.startsWith("Ödeme")) ? null : guardianCombinedReminder(data.enrollment, debt, data.paymentInstallments, data.paymentPlan,data.obligations||[])} accountId={profile.id} enrollmentId={data.enrollment?.id} childId={data.selected.id} previewGuardian={previewGuardian}/>
        <section className={'guardianFinanceTotal '+(totalDebt>0?'hasDebt':'clear')} aria-label="Toplam ödeme özeti"><div><span>TOPLAM KALAN BORÇ</span><strong>{financeReady?formatMoney(totalDebt):'Bilgi alınamadı'}</strong><p>Paket kalan borcu ve açık ek borçlarınız birlikte gösterilir.</p></div><div><span>Paket kalan: <b>{financeReady?formatMoney(debt):'—'}</b></span><span>Ek borç kalan: <b>{financeReady?formatMoney(extras.debt):'—'}</b></span></div></section>
        {!data.coursePackage&&!data.paymentPlan?<p className="guardianFinanceNotice">Kurs paketi henüz tanımlanmamış. Aşağıdaki ek borçlar varsa paket bilgisinden bağımsız olarak geçerlidir.</p>:null}
        <section className="guardianStats">
          <article className="guardianStat">
            <span>Paket</span>
            <strong>{data.coursePackage?.name || "Henüz tanımlanmadı"}</strong>
          </article>
          <article className="guardianStat">
            <span>Paket Ücreti</span>
            <strong>{financeReady?data.coursePackage||data.paymentPlan?formatMoney(price):"Tanımlanmadı":"Bilgi alınamadı"}</strong>
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
        {extras.rows.length>0?<section className="guardianCard guardianObligations" id="ek-borclar"><div className="guardianCardHeader"><div><small className="guardianCardEyebrow">EK BORÇLAR VE VADELER</small><h2>Paket dışı ödemeler</h2></div></div><div className="guardianObligationList">{extras.rows.map((item:any)=>{const state=installmentPresentation(item);return <article key={item.id}><div><strong>{item.title}</strong><small>Vade: {formatDate(item.due_date)}</small><StatusPill tone={state.tone}>{state.label}</StatusPill></div><dl><div><dt>Tutar</dt><dd>{formatMoney(Number(item.amount))}</dd></div><div><dt>Ödenen</dt><dd>{formatMoney(Number(item.paid_amount||0))}</dd></div><div><dt>Kalan</dt><dd>{formatMoney(state.remaining)}</dd></div></dl></article>;})}</div></section>:null}
        {financeReady && excess > 0 ? <p className="guardianCard">Paket tutarını aşan tahsilat: <strong>{formatMoney(excess)}</strong>. Çok dönemli ödemenizin kapsamı için kayıt açıklamanızı kontrol edebilirsiniz.</p> : null}
        {planResult.data && planResult.data.status!=="cancelled" ? (
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
                      <td>{formatMoney(installmentPresentation(item).remaining)}</td>
                      <td><StatusPill tone={installmentPresentation(item).tone}>{installmentPresentation(item).label}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        <section className="guardianCard" style={{ marginTop: 18 }}>
          <h2>Ödeme Geçmişi</h2><p className="guardianSectionLead">Tüm kayıt dönemlerindeki tahsilatlar. Üstteki bakiye mevcut pakete aittir.</p><div className="guardianTableWrap"><table className="guardianTable">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tutar</th>
                <th>Yöntem</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p: any) => (
                <tr key={p.id}>
                  <td>{formatDate(p.received_at)}</td>
                  <td>{formatMoney(p.amount)}{p.is_obligation_payment?<small style={{display:"block"}}>Ek borç tahsilatı</small>:null}</td>
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
                      tone={paymentPresentation(p.payment_status).tone}
                    >
                      {paymentPresentation(p.payment_status).label}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <HistoryPagination path="/veli-odemeler" page={data.historyPage||1} hasNext={data.historyHasNext||false} child={data.selected.id} previewGuardian={previewGuardian}/>
          {!history.length ? (
            <p className="guardianSectionLead">Henüz ödeme kaydı bulunmuyor.</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

import { requireProfile } from "@/lib/auth/profile";
import {
  formatDate,
  formatMoney,
  getGuardianContext,
} from "@/lib/guardian/data";
import { GuardianHeader, StatusPill } from "@/app/veli-paneli/guardian-ui";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const planResult = data.enrollment?.id
    ? await supabase
        .from("student_payment_plans")
        .select("id,total_amount,status,note")
        .eq("enrollment_id", data.enrollment.id)
        .maybeSingle()
    : { data: null };
  const installmentsResult = planResult.data?.id
    ? await supabase
        .from("student_payment_installments")
        .select("id,sequence_no,due_date,amount,paid_amount,status")
        .eq("plan_id", planResult.data.id)
        .order("sequence_no")
    : { data: [] };
  const installments = installmentsResult.data || [];
  const paid = data.payments
    .filter((p: any) => p.payment_status === "recorded")
    .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const price = Number(data.coursePackage?.price || 0);
  const debt = Math.max(0, price - paid);
  return (
    <main className="guardianShell">
      <GuardianHeader
        name={profile.full_name || "Değerli Velimiz"}
        students={data.students}
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
            <strong>{formatMoney(price)}</strong>
          </article>
          <article className="guardianStat">
            <span>Ödenen</span>
            <strong>{formatMoney(paid)}</strong>
          </article>
          <article className="guardianStat">
            <span>Kalan</span>
            <strong>{formatMoney(debt)}</strong>
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
          <table className="guardianTable">
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
                        : p.payment_method === "transfer"
                          ? "Havale/EFT"
                          : "Diğer"}
                  </td>
                  <td>
                    <StatusPill
                      tone={p.payment_status === "recorded" ? "green" : "red"}
                    >
                      {p.payment_status === "recorded"
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

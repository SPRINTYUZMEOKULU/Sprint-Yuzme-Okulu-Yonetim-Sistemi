import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import "../dashboard.css";

export const dynamic = "force-dynamic";

function money(value: number) { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value); }

export default async function CashPage() {
  await requireProfile();
  const supabase = await createClient();
  const start = new Date(); start.setHours(0,0,0,0);
  const { data: payments } = await supabase.from("payments").select("id,amount,payment_method,cash_status,received_at,student_id,received_by").gte("received_at", start.toISOString()).order("received_at", { ascending: false });
  const rows = payments || [];
  const total = rows.reduce((sum,p)=>sum+Number(p.amount || 0),0);
  const cash = rows.filter(p=>p.payment_method==="cash").reduce((sum,p)=>sum+Number(p.amount || 0),0);
  const pending = rows.filter(p=>["with_staff","handoff_pending"].includes(p.cash_status)).reduce((sum,p)=>sum+Number(p.amount || 0),0);
  const confirmed = rows.filter(p=>p.cash_status==="main_cash_confirmed").reduce((sum,p)=>sum+Number(p.amount || 0),0);
  return <main className="operationPage"><header className="operationHeader"><div><p>FİNANS VE KASA</p><h1>Bugünkü Kasa</h1><span>Personelin aldığı parayı, teslim durumunu ve ana kasaya giren tutarı tek ekranda görün.</span></div><div className="operationActions"><Link href="/">Dashboard</Link><button className="primaryOperation">Teslim Onaylarını Aç</button></div></header>
    <section className="operationStats cashStats"><article><span>Bugünkü Tahsilat</span><strong>{money(total)}</strong></article><article><span>Nakit Alındı</span><strong>{money(cash)}</strong></article><article><span>Personelde / Onay Bekliyor</span><strong>{money(pending)}</strong></article><article><span>Ana Kasaya Giren</span><strong>{money(confirmed)}</strong></article></section>
    <section className="operationCard"><div className="operationCardHeader"><div><p>GÜNLÜK HAREKET</p><h2>Bugün Alınan Ödemeler</h2></div><span>{rows.length} işlem</span></div><div className="responsiveTable"><table><thead><tr><th>Saat</th><th>Öğrenci</th><th>Tutar</th><th>Yöntem</th><th>Alan Personel</th><th>Kasa Durumu</th><th>Onay</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{new Date(row.received_at).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}</td><td>{row.student_id || "—"}</td><td><strong>{money(Number(row.amount))}</strong></td><td>{row.payment_method}</td><td>{row.received_by || "—"}</td><td><span className={`statusPill ${row.cash_status}`}>{row.cash_status}</span></td><td><button>{row.cash_status==="handoff_pending"?"Teslim Aldım":"Detay"}</button></td></tr>)}{!rows.length?<tr><td colSpan={7}><div className="tableEmpty">Bugün için ödeme kaydı bulunmuyor.</div></td></tr>:null}</tbody></table></div></section>
  </main>;
}

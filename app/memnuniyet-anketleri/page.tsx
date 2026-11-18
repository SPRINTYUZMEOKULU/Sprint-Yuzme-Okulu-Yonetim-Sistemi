import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { satisfactionTopics, scoreLabels } from "@/lib/guardian/satisfaction";
import "@/app/veli-paneli/veli.css";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const profile = await requireProfile(["owner"]);
  if (profile.base_role !== "owner" || !profile.organization_id) notFound();
  const params = await searchParams;
  const page = /^\d{1,4}$/.test(params.page || "") ? Number(params.page) : 0;
  const { data, error } = await documentAdmin().from("guardian_satisfaction_surveys")
    .select("id,rating,topic,comment,submitted_at").eq("organization_id", profile.organization_id)
    .order("submitted_at", { ascending: false }).order("id", { ascending: false }).range(page * 25, page * 25 + 25);
  const date = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" });
  return <main className="guardianShell"><div className="guardianContent">
    <Link href="/bildirimler">Bildirim Merkezine dön</Link>
    <h1>Memnuniyet Anketleri</h1>
    <p>Yönetim Kurulu Başkanlığı · Anonim yanıtlar</p>
    {error ? <p role="alert">Anket sonuçları yüklenemedi.</p> : !data?.length ? <p>Bu sayfada anket yanıtı yok.</p> :
      data.slice(0,25).map(row => <article className="guardianCard" style={{marginTop:12}} key={row.id}>
        <strong>{row.rating}/5 · {scoreLabels[row.rating - 1]}</strong>
        <p>{satisfactionTopics[row.topic as keyof typeof satisfactionTopics]} · {date.format(new Date(row.submitted_at))}</p>
        {row.comment && <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{row.comment}</p>}
      </article>)}
    <nav aria-label="Anket sayfaları" style={{display:"flex",gap:16,marginTop:18}}>
      {page > 0 && <Link href={`?page=${page - 1}`}>Önceki</Link>}
      {(data?.length || 0) > 25 && <Link href={`?page=${page + 1}`}>Sonraki</Link>}
    </nav>
  </div></main>;
}

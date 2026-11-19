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
    .select("id,rating,topic,comment,submitted_at,problem_reported,guardian_profile_id,student_id,guardian:profiles!guardian_profile_id(full_name),student:students!student_id(first_name,last_name)").eq("organization_id", profile.organization_id)
    .order("submitted_at", { ascending: false }).order("id", { ascending: false }).range(page * 25, page * 25 + 25);
  const date = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" });
  return <main className="guardianShell"><div className="guardianContent">
    <Link href="/bildirimler">Bildirim Merkezine dön</Link>
    <h1>Memnuniyet Anketleri</h1>
    <p>Yönetim Kurulu Başkanlığı · Gizli geri bildirim</p>
    {error ? <p role="alert">Anket sonuçları yüklenemedi.</p> : !data?.length ? <p>Bu sayfada anket yanıtı yok.</p> :
      data.slice(0,25).map(row => {
        const guardian = row.guardian as unknown as { full_name: string | null } | null;
        const student = row.student as unknown as { first_name: string; last_name: string } | null;
        return <article className="guardianCard" style={{marginTop:12}} key={row.id}>
        <strong>{row.rating}/5 · {scoreLabels[row.rating - 1]}</strong>
        <p>{satisfactionTopics[row.topic as keyof typeof satisfactionTopics]} · {date.format(new Date(row.submitted_at))}</p>
        {row.problem_reported && <strong className="guardianPill red">Sorun bildirildi</strong>}
        <p>{row.guardian_profile_id ? `Gönderen: ${guardian?.full_name || "Adı kayıtlı değil"}` : "Gönderen bilgisi yok"}</p>
        {student && <p>Öğrenci: {student.first_name} {student.last_name}</p>}
        {row.comment && <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{row.comment}</p>}
      </article>})}
    <nav aria-label="Anket sayfaları" style={{display:"flex",gap:16,marginTop:18}}>
      {page > 0 && <Link href={`?page=${page - 1}`}>Önceki</Link>}
      {(data?.length || 0) > 25 && <Link href={`?page=${page + 1}`}>Sonraki</Link>}
    </nav>
  </div></main>;
}

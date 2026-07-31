import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import "../dashboard.css";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data: students } = await supabase
    .from("students")
    .select("id,first_name,last_name,status,swimming_level,branch_id,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="operationPage">
      <header className="operationHeader"><div><p>ÖĞRENCİ YÖNETİMİ</p><h1>Öğrenci, Grup ve Seviye Merkezi</h1><span>Öğrencinin grubu, seviyesi, paketi ve bitiş tarihini tek ekranda yönetin.</span></div><div className="operationActions"><Link href="/">Dashboard</Link><Link className="primaryOperation" href="/on-kayit">+ Yeni Kayıt</Link></div></header>
      <section className="operationStats"><article><span>Toplam Görünen</span><strong>{students?.length || 0}</strong></article><article><span>Aktif Öğrenci</span><strong>{students?.filter(s=>s.status==="active").length || 0}</strong></article><article><span>Ön Kayıt</span><strong>{students?.filter(s=>s.status==="pre_registration").length || 0}</strong></article><article><span>Seviyesi Eksik</span><strong>{students?.filter(s=>!s.swimming_level).length || 0}</strong></article></section>
      <section className="operationCard"><div className="operationCardHeader"><div><p>TEK EKRAN</p><h2>Öğrenci Listesi</h2></div><input placeholder="Öğrenci ara..." /></div>
        <div className="responsiveTable"><table><thead><tr><th>Öğrenci</th><th>Durum</th><th>Seviye</th><th>Grup</th><th>Kalan Ders</th><th>Bitiş Tarihi</th><th>İşlem</th></tr></thead><tbody>
          {(students || []).map((student)=><tr key={student.id}><td><strong>{student.first_name} {student.last_name}</strong></td><td><span className={`statusPill ${student.status}`}>{student.status}</span></td><td>{student.swimming_level || "Atanmadı"}</td><td>—</td><td>—</td><td>—</td><td><button>Detayı Aç</button></td></tr>)}
          {!students?.length ? <tr><td colSpan={7}><div className="tableEmpty">Henüz öğrenci kaydı bulunmuyor.</div></td></tr> : null}
        </tbody></table></div>
      </section>
    </main>
  );
}

import { developmentReportTitle, developmentSections } from "@/lib/attendance/development-report";
import { loadGuardianPage, type GuardianPageQuery } from "@/lib/guardian/page-context";
import { formatDate } from "@/lib/guardian/data";
import { EmptyGuardian, GuardianHeader, GuardianIcon } from "@/app/veli-paneli/guardian-ui";
import "@/app/veli-paneli/veli.css";
import "@/app/veli-paneli/course-summary.css";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<GuardianPageQuery> }) {
  const { profile, data, previewGuardian } = await loadGuardianPage(await searchParams, "progress");
  const student = data.selected;
  const progressUnavailable = data.issues.some(issue => issue.startsWith("Gelişim"));

  return <main className="guardianShell">
    <GuardianHeader previewGuardian={previewGuardian} name={profile.full_name || "Değerli Velimiz"} issues={data.issues} students={data.students} selectedId={student?.id} />
    <div className="guardianContent">
      <header className="courseIdentity">
        <span className="courseMonogram"><GuardianIcon name="progress" size={24} /></span>
        <div><h1>Gelişim Merkezi</h1>{student && <p>{student.first_name} {student.last_name}</p>}</div>
      </header>
      {!student ? <EmptyGuardian title="Bağlı öğrenci bulunamadı" text="Öğrenci bağlantısı tamamlandığında gelişim notları burada görünecek." /> :
        <section className="guardianCard courseProgress" aria-labelledby="progress-notes">
          <h2 id="progress-notes">Gelişim raporları ve eğitmen notları</h2>
          {progressUnavailable ? <p>Sayfayı yenileyerek tekrar deneyebilirsiniz.</p> :
            data.progress.length ? <ul className="courseProgressNotes">
              {data.progress.map(note => <li key={note.id} id={`not-${note.id}`}>
                <span className="courseProgressDate">{formatDate(note.created_at)}{note.author?.full_name ? ` · ${note.author.full_name}` : ""}</span>
                <h3>{note.target || "Gelişim notu"}</h3>
                <p>{note.target === developmentReportTitle && typeof note.note === "string"
                  ? note.note.split("\n").map((line: string, index: number) => (
                    <span key={index}>
                      {developmentSections.some((section) => section.label === line) ? <strong>{line}</strong> : line}
                      {"\n"}
                    </span>
                  ))
                  : note.note}</p>
              </li>)}
            </ul> : <p>Eğitmeniniz bir gelişim raporu veya notu paylaştığında burada görebilirsiniz.</p>}
        </section>}
    </div>
  </main>;
}

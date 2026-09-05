import type { ReactNode } from "react";
import Link from "next/link";
import type { GuardianStudent } from "@/lib/guardian/data";

export function GuardianHeader({
  name,
  students,
  selectedId
}: {
  name: string;
  students: GuardianStudent[];
  selectedId?: string;
}) {
  const query = selectedId ? `?child=${selectedId}` : "";
  return (
    <>
      <header className="guardianTop">
        <Link href={`/veli-paneli${query}`} className="guardianBrand">
          <span className="guardianBrandMark">S</span>
          <span><strong>SprintOS</strong><small>Veli Merkezi</small></span>
        </Link>
        <div className="guardianTopRight">
          <span className="guardianWelcome">Hoş geldiniz, <b>{name}</b></span>
          <Link className="guardianLogout" href="/auth/signout">Çıkış</Link>
        </div>
      </header>
      <div className="guardianNavWrap">
        <nav className="guardianNav">
          <Link href={`/veli-paneli${query}`}>Genel Bakış</Link>
          <Link href={`/veli-devam${query}`}>Dersler & Yoklama</Link>
          <Link href={`/veli-gelisim${query}`}>Gelişim</Link>
          <Link href={`/veli-odemeler${query}`}>Ödemeler</Link>
          <Link href={`/veli-mesajlar${query}`}>Mesajlar</Link>
          <Link href={`/veli-duyurular${query}`}>Duyurular</Link>
          <Link href={`/veli-belgeler${query}`}>Belgeler</Link>
          <Link href={`/veli-talepleri${query}`}>Talep Oluştur</Link>
        </nav>
        {students.length > 1 ? (
          <div className="childSwitch">
            <span>Öğrenci:</span>
            {students.map((student) => (
              <Link
                key={student.id}
                className={student.id === selectedId ? "active" : ""}
                href={`/veli-paneli?child=${student.id}`}
              >
                {student.first_name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function EmptyGuardian({ title, text }: { title: string; text: string }) {
  return <section className="guardianEmpty"><span>🏊</span><h2>{title}</h2><p>{text}</p></section>;
}

export function StatusPill({ children, tone = "blue" }: { children: ReactNode; tone?: string }) {
  return <span className={`guardianPill ${tone}`}>{children}</span>;
}

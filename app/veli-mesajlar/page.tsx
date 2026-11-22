import GuardianSectionHeading from "@/app/veli-paneli/section-heading";
import { createGuardianRequest } from "@/app/veliler/actions";
import { loadGuardianPage } from "@/lib/guardian/page-context";
import { formatDate } from "@/lib/guardian/data";
import { GuardianHeader, StatusPill, EmptyGuardian } from "@/app/veli-paneli/guardian-ui";
import { markPortalMessageRead } from "@/app/veli-paneli/portal-actions";
import PendingSubmitButton from "@/app/ogrenciler/[id]/pending-submit-button";
import "@/app/veli-paneli/veli.css";
import "./note-reply.css";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ child?: string; previewGuardian?: string; saved?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { profile, data, previewGuardian } = await loadGuardianPage(query, "messages");
  const studentId = data.selected?.id;

  return (
    <main className="guardianShell">
      <GuardianHeader previewGuardian={previewGuardian} name={profile.full_name || "Değerli Velimiz"} students={data.students} selectedId={studentId} issues={data.issues} />
      <div className="guardianContent">
        <GuardianSectionHeading icon="message" title="Mesaj Merkezi" description="Yönetimin portala gönderdiği kişisel ve kursiyere özel mesajlar. WhatsApp gönderim geçmişinden ayrı gösterilir." />
        {query.saved && <div className="guardianFooterNote" role="status">{query.saved}</div>}
        {query.error && <div className="guardianDataNotice" role="alert">{query.error}</div>}
        {studentId ? (
          <section className="guardianCard">
            {data.messages.map(message => {
              const isNote = message.kind === "note";
              return (
                <article className="messageCard" id={`${isNote ? "not" : "mesaj"}-${message.id}`} key={message.id}>
                  <div className="guardianCardHeader">
                    <h2>{message.title}</h2>
                    <StatusPill tone={message.read_at ? "green" : "blue"}>
                      {isNote ? "Paylaşılan not" : message.read_at ? "Okundu" : "Yeni"}
                    </StatusPill>
                  </div>
                  <p>{message.body}</p>
                  <div className="noteMeta">
                    <span>{formatDate(message.created_at)}</span>
                    <span>{message.channel === "panel" ? "Portal" : message.channel || "Portal"}</span>
                  </div>
                  {!isNote && !message.read_at && !previewGuardian && (
                    <form action={markPortalMessageRead} style={{ marginTop: 12 }}>
                      <input type="hidden" name="child" value={studentId} />
                      <input type="hidden" name="message_id" value={message.id} />
                      <PendingSubmitButton className="guardianPortalButton" pendingText="Güncelleniyor…">
                        Okundu Olarak İşaretle
                      </PendingSubmitButton>
                    </form>
                  )}
                  {isNote && !previewGuardian && (
                    <details className="noteReply">
                      <summary>Bu not hakkında yönetime yaz</summary>
                      <form action={createGuardianRequest} className="noteReplyForm">
                        <input type="hidden" name="student_id" value={studentId} />
                        <input type="hidden" name="source_note_id" value={message.id} />
                        <input type="hidden" name="subject" value={`Not hakkında: ${message.title}`} />
                        <input type="hidden" name="category" value="other" />
                        <label htmlFor={`yanit-${message.id}`}>Yönetime yanıtınız</label>
                        <textarea id={`yanit-${message.id}`} name="description" required maxLength={4000} rows={4} placeholder="Yanıtınızı yazın…" />
                        <PendingSubmitButton className="guardianPortalButton" pendingText="Gönderiliyor…">
                          Yanıtı Yönetime Gönder
                        </PendingSubmitButton>
                      </form>
                    </details>
                  )}
                </article>
              );
            })}
            {!data.messages.length && <p className="guardianSectionLead">Henüz portal mesajı bulunmuyor.</p>}
          </section>
        ) : (
          <EmptyGuardian title="Bağlı kursiyer bulunamadı" text="Hesabınıza aktif kursiyer bağlandığında mesajlar burada görüntülenir." />
        )}
      </div>
    </main>
  );
}

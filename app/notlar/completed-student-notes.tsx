import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {formatDisplayDateTime} from "@/lib/dates/display";

export default async function CompletedStudentNotes({organizationId}:{organizationId:string}){
  const db=await createClient();
  const {data:events,error}=await db.from("student_timeline_events").select("student_id,description,created_at,created_by")
    .eq("organization_id",organizationId).eq("title","Öğrenci notu tamamlandı").order("created_at",{ascending:false}).limit(100);
  if(error)return <p role="alert">Tamamlanan öğrenci notları yüklenemedi. Sayfayı yenileyin.</p>;
  const seen=new Set<string>();
  const rows=(events||[]).flatMap(event=>{
    const match=/^SPRINT_NOTE_COMPLETED:([a-f0-9-]{36})\n([\s\S]*)$/i.exec(event.description||"");
    if(!match||seen.has(match[1]))return [];
    seen.add(match[1]);return [{...event,noteId:match[1],reply:match[2]}];
  });
  if(!rows.length)return <section><h2>Tamamlanan Öğrenci Notları</h2><p>Henüz tamamlanan öğrenci notu bulunmuyor.</p></section>;
  const authors=[...new Set(rows.map(row=>row.created_by).filter(Boolean))];
  const [notes,students,profiles]=await Promise.all([
    db.from("student_notes").select("id,student_id,body").eq("organization_id",organizationId).in("id",rows.map(row=>row.noteId)),
    db.from("students").select("id,first_name,last_name").eq("organization_id",organizationId).in("id",rows.map(row=>row.student_id)),
    authors.length?db.from("profiles").select("id,full_name").eq("organization_id",organizationId).in("id",authors):Promise.resolve({data:[],error:null}),
  ]);
  if(notes.error||students.error||profiles.error)return <p role="alert">Tamamlanan notların ayrıntıları yüklenemedi. Sayfayı yenileyin.</p>;
  return <section style={{marginTop:24}}><h2>✓ Tamamlanan Öğrenci Notları</h2><p>En son 100 tamamlanma kaydı. Notun aslı ve işlem sonucu birlikte saklanır.</p>{rows.map(row=>{
    const note=notes.data?.find(note=>note.id===row.noteId&&note.student_id===row.student_id);
    const student=students.data?.find(student=>student.id===row.student_id);
    if(!note||!student)return null;
    const author=profiles.data?.find(person=>person.id===row.created_by);
    return <article key={row.noteId} style={{margin:"12px 0",padding:18,border:"1px solid #cce6d5",borderRadius:14,background:"#f4fbf6"}}>
      <Link href={`/ogrenciler/${row.student_id}#notlar`}>{student.first_name} {student.last_name}</Link><strong style={{display:"block",color:"#166534"}}>✓ Tamamlandı</strong>
      <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{note.body}</p><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}><strong>İşlem sonucu: </strong>{row.reply}</p>
      <small>İşaretleyen: {author?.full_name||"Kullanıcı bilgisi bulunamadı"} · {formatDisplayDateTime(new Date(row.created_at))}</small>
    </article>;
  })}</section>;
}

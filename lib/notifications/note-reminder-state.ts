import type { createClient } from "@/lib/supabase/server";
type Client = Awaited<ReturnType<typeof createClient>>;
const TYPES = new Set(["student_note_reminder", "registration_note_reminder"]);

/** Resolve the original note and its completion before presenting a reminder. */
export async function decorateNoteReminders(client:Client, organizationId:string, rows:any[]) {
  const reminders=rows.filter(row=>TYPES.has(row.notification_type));
  if(!reminders.length)return rows;
  const ids=[...new Set<string>(reminders.flatMap(row=>[row.source_id,row.entity_id,row.metadata?.note_id]).filter(Boolean).map(String))];
  if(!ids.length)return rows;
  const [byId,bySource,notesResult]=await Promise.all([
    client.from("student_activity_logs").select("id,student_id,source_type,source_id,performed_by,reminder_completed,reminder_completed_at").eq("organization_id",organizationId).in("id",ids),
    client.from("student_activity_logs").select("id,student_id,source_type,source_id,performed_by,reminder_completed,reminder_completed_at").eq("organization_id",organizationId).eq("source_type","student_note").in("source_id",ids),
    client.from("student_notes").select("id,student_id,author_id").eq("organization_id",organizationId).in("id",ids),
  ]);
  if(byId.error||bySource.error||notesResult.error)throw new Error("Not hatırlatmaları doğrulanamadı.");
  const activities=[...(byId.data||[]),...(bySource.data||[])];
  const linkedNoteIds=[...new Set(activities.filter(a=>a.source_type==="student_note").map(a=>a.source_id).filter(Boolean))];
  const extra=linkedNoteIds.length?await client.from("student_notes").select("id,student_id,author_id").eq("organization_id",organizationId).in("id",linkedNoteIds):{data:[],error:null};
  if(extra.error)throw new Error("Not yazarı doğrulanamadı.");
  const notes=[...(notesResult.data||[]),...(extra.data||[])];
  const studentIds=[...new Set<string>([...reminders.map(r=>r.student_id),...activities.map(a=>a.student_id),...notes.map(n=>n.student_id)].filter(Boolean))];
  const completionResult=studentIds.length?await client.from("student_timeline_events").select("student_id,description,created_at,created_by").eq("organization_id",organizationId).in("student_id",studentIds).eq("title","Öğrenci notu tamamlandı"):{data:[],error:null};
  if(completionResult.error)throw new Error("Not tamamlama durumu doğrulanamadı.");
  const completed=new Set<string>();
  for(const event of completionResult.data||[]){const match=/^SPRINT_NOTE_COMPLETED:([a-f0-9-]{36})\n/i.exec(event.description||"");if(match)completed.add(`${event.student_id}:${match[1]}`);}
  const authorIds=[...new Set<string>([...notes.map(n=>n.author_id),...activities.map(a=>a.performed_by)].filter(Boolean))];
  const authors=authorIds.length?await client.from("profiles").select("id,full_name,role").eq("organization_id",organizationId).in("id",authorIds):{data:[],error:null};
  if(authors.error)throw new Error("Not yazarı okunamadı.");
  const authorMap=new Map<string,any>((authors.data||[]).map((a:any)=>[String(a.id),a]));
  return rows.map(row=>{
    if(!TYPES.has(row.notification_type))return row;
    const activity=activities.find(a=>a.student_id===row.student_id && (a.id===row.source_id||a.source_id===row.source_id||a.source_id===row.entity_id));
    const note=notes.find(n=>n.student_id===row.student_id && [row.source_id,row.entity_id,activity?.source_type==="student_note"?activity.source_id:null,row.metadata?.note_id].includes(n.id));
    const author=authorMap.get(note?.author_id||activity?.performed_by);
    const done=Boolean(activity?.reminder_completed)||(note?completed.has(`${note.student_id}:${note.id}`):false);
    return {...row,authorName:author?.full_name||"Yazar bilgisi bulunamadı",authorRole:author?.role||null,
      noteId:note?.id||null,reminderCompleted:done,metadata:{...row.metadata,note_completed:done}};
  });
}

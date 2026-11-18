import {createClient} from '@supabase/supabase-js';
import {formatDisplayDateTime} from '@/lib/dates/display';
import {replyGuardianRequest} from '@/app/veliler/actions';
import PendingSubmitButton from '@/app/ogrenciler/[id]/pending-submit-button';
export async function loadRequestThreads(requests:any[],organizationId:string){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 if(!requests.length)return {data:[],error:null};
 return db.from('guardian_request_replies').select('*').eq('organization_id',organizationId).in('request_id',requests.map(r=>r.id)).order('created_at');
}
export default function RequestThread({request,replies=[],error=false,guardian=false,preview=false,guardianPhone}:{request:any;replies?:any[];error?:boolean;guardian?:boolean;preview?:boolean;guardianPhone?:string|null}){
 const digits=(guardianPhone||"").replace(/\D/g,"").replace(/^0090/,"90");
 const phone=/^905\d{9}$/.test(digits)?digits:/^0?5\d{9}$/.test(digits)?`90${digits.slice(-10)}`:"";
 const whatsapp = !guardian && !preview && !error && phone && request.guardian_response
  ? `https://wa.me/${phone}?text=${encodeURIComponent(`Merhaba, ${request.request_number} numaralı talebiniz için Sprint Yüzme Okulu yönetiminin güncel yanıtı:\n\n${request.guardian_response}`)}`
  : null;
 return <section className="requestThread" aria-label="Görüşme geçmişi">
  <div className="requestDelivery"><strong>Alıcı: {guardian||preview?'Sprint Yönetimi':'İlgili veli'}</strong><span>Talep no: {request.request_number}</span></div>
  {request.source_note_id?<p className="noteMeta">Öğrenci dosyasında paylaşılan nota verilen yanıt</p>:null}
  {error?<p role="alert">Görüşme geçmişi yüklenemedi. Lütfen tekrar deneyin.</p>:(replies||[]).map((reply:any)=><article className={`requestBubble ${reply.sender_role}`} key={reply.id}><div><strong>{reply.author_name} · {reply.sender_role==='guardian'?'Veli':'Yönetim'}</strong><time>{formatDisplayDateTime(new Date(reply.created_at))}</time></div><p>{reply.body}</p></article>)}
  {!error&&!replies.some(reply=>reply.sender_role==="staff")&&request.guardian_response?<div className="guardianResponse"><strong>Yönetimin cevabı</strong><p>{request.guardian_response}</p></div>:null}
  {whatsapp?<a className="guardianButton requestWhatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer">Güncel Yanıtı WhatsApp’ta Aç</a>:null}
  {guardian&&!preview&&request.status!=='archived'?<form action={replyGuardianRequest} className="guardianForm"><input type="hidden" name="request_id" value={request.id}/><label>İşlem türü<select name="reply_kind"><option value="reply">Yanıt yaz</option><option value="correction">Gönderdiğim talebi düzelt</option></select></label><label>Yönetime mesajınız<textarea name="body" rows={3} maxLength={4000} required placeholder="Bu görüşmeye yanıt yazın…"/></label><PendingSubmitButton className="guardianButton primary" pendingText="Yanıt gönderiliyor…">Yanıtı Yönetime Gönder</PendingSubmitButton></form>:null}
 </section>;
}

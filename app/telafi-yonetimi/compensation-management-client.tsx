"use client";
import {formatDisplayDate} from "@/lib/dates/display";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import CompensationPlanEditor from "../ogrenciler/[id]/compensation-plan-editor";
import {filterMakeups,type ManagedMakeup,type MakeupSchedule,type MakeupGroup,type MakeupBranch} from "@/lib/students/compensation-management";
const tabs=[['reserved','Tarih Bekleyen'],['planned','Planlanan'],['notifications','Bilgilendirme Bekleyen'],['completed','Tamamlanan'],['cancelled','İptal Edilen']] as const;
type Tab=typeof tabs[number][0];
type Data={items:ManagedMakeup[];schedules:MakeupSchedule[];groups:MakeupGroup[];branches:MakeupBranch[];canDelete:boolean;truncated?:boolean};
const empty:Data={items:[],schedules:[],groups:[],branches:[],canDelete:false};
const name=(item:ManagedMakeup)=>[item.student?.first_name,item.student?.last_name].filter(Boolean).join(' ')||'Kursiyer';
async function request(url:string,options?:RequestInit){
 const response=await fetch(url,{cache:'no-store',...options});
 if(response.redirected)throw new Error('Oturumunuz sona ermiş olabilir. Yeniden giriş yapın.');
 let result;try{result=await response.json();}catch{throw new Error('Sunucu yanıtı doğrulanamadı. Sayfayı yenileyip tekrar deneyin.');}
 if(!response.ok)throw new Error(result.error||'İşlem tamamlanamadı.');return result;
}
export default function CompensationManagementClient(){
 const [data,setData]=useState<Data>(empty),[tab,setTab]=useState<Tab>('reserved'),[query,setQuery]=useState(''),[branch,setBranch]=useState('');
 const [loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [selected,setSelected]=useState<string[]>([]),[day,setDay]=useState(''),[schedule,setSchedule]=useState(''),[prepare,setPrepare]=useState(true);
 const [start,setStart]=useState(''),[end,setEnd]=useState('');
 const special=schedule==='one_off';
 const [results,setResults]=useState<{id:string;name:string;ok:boolean;message:string}[]>([]);
 const lock=useRef(false);
 const load=useCallback(async()=>{setLoading(true);try{const result=await request('/api/compensation-management');setData(result);setLoaded(true);return true;}catch(error){setMessage(error instanceof Error?error.message:'Telafiler alınamadı.');return false;}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const rows=useMemo(()=>filterMakeups(data.items,tab,query,branch,data.groups),[data,tab,query,branch]);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date());
 const weekday=day?new Date(day+'T12:00:00Z').getUTCDay():-1;
 const choices=data.schedules.filter(s=>!s.makeup_date&&Number(s.weekday)%7===weekday&&data.groups.some(g=>g.id===s.group_id&&(!branch||g.branch_id===branch)));
 const selectedRows=data.items.filter(item=>item.status==='reserved'&&selected.includes(item.id));
 function toggle(id:string){setSelected(ids=>ids.includes(id)?ids.filter(value=>value!==id):[...ids,id]);}
 async function plan(){
  if(lock.current||!selectedRows.length||!day||!schedule)return;
  if(special&&(!start||!end||start>=end||new Set(selectedRows.map(item=>item.target_group_id)).size!==1)){
    setMessage('Tek seferlik telafi için aynı grubun haklarını seçin ve geçerli saat aralığı girin.');return;
  }
  if(!window.confirm(`${selectedRows.length} kursiyerin saklı telafi hakkı seçilen tarih ve seansa planlanacak. Devam edilsin mi?`))return;
  lock.current=true;setBusy(true);setResults([]);setMessage('Planlama sürüyor…');
  const outcomes:typeof results=[];
  try{
   for(const item of selectedRows){
    try{const result=await request('/api/compensation-management',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'plan_reserved',id:item.id,lesson_date:day,target_schedule_id:special?null:schedule,one_off:special?{start,end}:undefined,prepare_message:prepare})});outcomes.push({id:item.id,name:name(item),ok:true,message:result.message+(result.messageWarning||'')});}
    catch(error){outcomes.push({id:item.id,name:name(item),ok:false,message:error instanceof Error?error.message:'Sonuç doğrulanamadı; yeniden denemeden önce listeyi yenileyin.'});}
    setResults([...outcomes]);
   }
   const successes=new Set(outcomes.filter(row=>row.ok).map(row=>row.id));
   setSelected(ids=>ids.filter(id=>!successes.has(id)));
   setMessage(`${successes.size} hak planlandı · ${outcomes.length-successes.size} kayıt kontrol bekliyor.${prepare?' Hazırlanan mesajları Bilgilendirme Bekleyen bölümünden gönderebilirsiniz.':''}`);
   await load();
  }finally{lock.current=false;setBusy(false);}
 }
 async function remove(item:ManagedMakeup){
  if(lock.current||!window.confirm('İptal edilmiş telafi kalıcı silinecek. Bu işlem geri alınamaz. Devam edilsin mi?')||!window.confirm('Kalıcı silmeyi ikinci kez onaylıyor musunuz?'))return;
  lock.current=true;setBusy(true);
  try{const result=await request('/api/compensation-management?id='+encodeURIComponent(item.id),{method:'DELETE'});setMessage(result.message);await load();}catch(error){setMessage(error instanceof Error?error.message:'Silme tamamlanamadı.');}finally{lock.current=false;setBusy(false);}
 }
 return <main className="cmShell">
  <header className="cmHeader"><div><p className="cmEyebrow">SPRİNTOS · DERS YÖNETİMİ</p><h1>Telafi Yönetimi</h1><p>Saklı hakları planlayın, tarih ve seansları düzenleyin, veli bilgilendirmelerini takip edin.</p></div><nav><Link href="/ders-operasyonlari">Ders İptali / Telafi</Link><Link href="/ders-operasyonlari/gecmis">İşlem Geçmişi</Link><Link href="/ogrenciler">Öğrenci Merkezi</Link></nav></header>
  {message&&<div className="cmNotice" role="status"><span>{message}</span><button type="button" aria-label="Bildirimi kapat" onClick={()=>setMessage('')}>×</button></div>}
  {data.truncated&&<p className="cmWarning">Liste en yeni 1.000 kayıtla sınırlı olabilir. Eski kayıtlar için kursiyer dosyasını kontrol edin; sayaçlar bu listedeki kayıtları gösterir.</p>}
  <nav className="cmTabs" aria-label="Telafi durumları">{tabs.map(([key,label])=><button type="button" key={key} aria-current={tab===key?'page':undefined} className={tab===key?'active':''} disabled={busy} onClick={()=>{setTab(key);setSelected([]);}}><span>{label}</span><strong>{loaded?filterMakeups(data.items,key,'','',data.groups).length:'—'}</strong></button>)}</nav>
  <section className="cmFilters" aria-label="Telafi filtreleri"><label>Kursiyer ara<input type="search" value={query} disabled={busy} onChange={e=>{setQuery(e.target.value);setSelected([]);}} placeholder="Ad, soyad veya kursiyer numarası"/></label><label>Şube<select value={branch} disabled={busy} onChange={e=>{setBranch(e.target.value);setSelected([]);setSchedule('');}}><option value="">Tüm şubeler</option>{data.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button type="button" disabled={busy||loading} onClick={()=>void load()}>{loading?'Yükleniyor…':'Listeyi Yenile'}</button></section>
  {tab==='reserved'&&loaded&&<section className="cmPlanner"><div><h2>Saklı hakları planla</h2><p>Aşağıdan kursiyerleri seçin. Her seçim mevcut bir telafi hakkını tarihlendirir; ilave ders hakkı oluşturmaz.</p></div><div className="cmPlanFields"><label>Telafi tarihi<input type="date" min={today} value={day} disabled={busy} onChange={e=>{setDay(e.target.value);setSchedule('');}}/></label><label>Şube, grup ve seans<select value={schedule} disabled={busy||!day} onChange={e=>setSchedule(e.target.value)}><option value="">Seans seçin</option><option value="one_off">Tek seferlik telafi seansı oluştur</option>{choices.map(s=>{const g=data.groups.find(g=>g.id===s.group_id);return <option key={s.id} value={s.id}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)} · {g?.name} · {data.branches.find(b=>b.id===g?.branch_id)?.name}</option>;})}</select></label>{special&&<><label>Başlangıç saati<input type="time" value={start} disabled={busy} onChange={e=>setStart(e.target.value)}/></label><label>Bitiş saati<input type="time" value={end} disabled={busy} onChange={e=>setEnd(e.target.value)}/></label></>}</div>{day&&!choices.length&&!special&&<p className="cmWarning">Bu gün ve şube için normal seans bulunmuyor. Tek seferlik telafi oluşturabilirsiniz.</p>}<label className="cmCheck"><input type="checkbox" checked={prepare} disabled={busy} onChange={e=>setPrepare(e.target.checked)}/>WhatsApp bilgilendirme mesajını hazırla</label><div className="cmPlanActions"><span>{selectedRows.length} hak seçildi</span><button type="button" disabled={busy||loading||!selectedRows.length||!schedule||day<today||(special&&(!start||!end||start>=end))} onClick={()=>void plan()}>{busy?'Planlanıyor…':'Seçilen Hakları Planla'}</button></div><small>Mesajlar kendiliğinden gönderilmez. Planlama sonrası içerikleri kontrol ederek WhatsApp üzerinden gönderebilirsiniz.</small></section>}
  {results.length>0&&<section className="cmResults" aria-label="Planlama sonuçları"><h2>Planlama sonuçları</h2>{results.map(row=><p key={row.id} className={row.ok?'success':'failure'}><strong>{row.name}</strong> · {row.message}</p>)}</section>}
  <section className="cmList" aria-busy={loading||busy}>
   {loading&&!loaded?<p className="cmEmpty">Telafiler yükleniyor…</p>:!loaded?<p className="cmEmpty">Liste alınamadı. Listeyi Yenile ile tekrar deneyin.</p>:<>
    {tab==='reserved'&&rows.length>0&&<label className="cmCheck cmSelectAll"><input type="checkbox" disabled={busy||loading} checked={rows.every(row=>selected.includes(row.id))} onChange={e=>setSelected(ids=>e.target.checked?[...new Set([...ids,...rows.map(row=>row.id)])]:ids.filter(id=>!rows.some(row=>row.id===id)))}/>Görünen hakları seç ({rows.length})</label>}
    {rows.length?rows.map(item=>{const group=data.groups.find(g=>g.id===item.target_group_id);const session=data.schedules.find(s=>s.id===item.target_schedule_id);return <article className="compensationCard cmCard" key={item.id}>
     <div className="cmCardHead"><div>{item.status==='reserved'&&<label className="cmCheck"><input type="checkbox" aria-label={name(item)+' telafi hakkını seç'} disabled={busy||loading} checked={selected.includes(item.id)} onChange={()=>toggle(item.id)}/>Tarih bekleyen hak</label>}<small>{item.student?.student_number||'Kursiyer'}</small><h2><Link href={`/ogrenciler/${item.student_id}#ders-hareketleri`}>{name(item)}</Link></h2><p>{item.lesson_date?formatDisplayDate(new Date(item.lesson_date+'T12:00:00')):'Henüz tarih belirlenmedi'}{session?` · ${session.start_time.slice(0,5)}–${session.end_time.slice(0,5)}`:''}</p><p className="cmMuted">{[data.branches.find(b=>b.id===group?.branch_id)?.name,group?.name].filter(Boolean).join(' · ')}</p></div><span className={'compensationStatus '+item.status}>{tabs.find(([key])=>key===item.status)?.[1]||item.status}</span></div>
     {item.note&&<details className="compensationSource"><summary>Kaynak ders ve açıklama</summary><p>{item.note}</p></details>}
     {item.status!=='reserved'&&<CompensationPlanEditor key={item.id+':'+(item.notification?.id||'none')} studentId={item.student_id} id={item.id} date={item.lesson_date||''} status={item.status} notification={item.notification} canPrepare={item.canPrepare} schedules={data.schedules} groups={data.groups} branches={data.branches} onChanged={()=>void load()}/>}
     <div className="cmCardLinks"><Link href={`/ogrenciler/${item.student_id}#ders-hareketleri`}>Kursiyer Dosyasını Aç →</Link>{item.status==='cancelled'&&data.canDelete&&<button type="button" className="cmDelete" disabled={busy||loading} onClick={()=>void remove(item)}>Kalıcı Sil</button>}</div>
    </article>;}):<p className="cmEmpty">Bu bölümde seçilen filtrelere uygun telafi bulunmuyor.</p>}
   </>}
  </section>
 </main>;
}

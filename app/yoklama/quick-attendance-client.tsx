"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import AttendanceReminderPanel from "./attendance-reminder-panel";
import { getAttendanceForDate, saveAttendance } from "./actions";

type Status="present"|"absent"|"excused"|"compensation";
type Branch={id:string;name?:string|null;short_name?:string|null};
type Group={id:string;branch_id?:string|null;name?:string|null;course_type?:string|null;primary_coach_id?:string|null};
type Schedule={id:string;branch_id?:string|null;group_id?:string|null;coach_id?:string|null;weekday?:number|null;start_time?:string|null;end_time?:string|null;is_active?:boolean|null};
type Membership={student_id?:string|null;group_id?:string|null;is_active?:boolean|null};
type Student={id:string;first_name?:string|null;last_name?:string|null;birth_date?:string|null;status?:string|null};
type Enrollment={id:string;student_id?:string|null;group_id?:string|null;total_lessons?:number|null;used_lessons?:number|null;lesson_weekdays?:number[]|null;status?:string|null;start_date?:string|null;planned_end_date?:string|null;created_at?:string|null;updated_at?:string|null};
type Compensation={student_id:string;target_group_id:string;target_schedule_id?:string|null;lesson_date:string;status:string};
type Props={branches:Branch[];groups:Group[];schedules:Schedule[];memberships:Membership[];students:Student[];enrollments:Enrollment[];compensationLessons:Compensation[];initialBranchId?:string};

const DAYS:Record<number,string>={1:"Pazartesi",2:"Salı",3:"Çarşamba",4:"Perşembe",5:"Cuma",6:"Cumartesi",7:"Pazar"};
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function weekday(v:string){const d=new Date(`${v}T12:00:00`).getDay();return d===0?7:d}
function scheduleWeekday(v?:number|null){const d=Number(v);return d===0?7:d}
function tm(v?:string|null){return v?.slice(0,5)||"—"}
function fullName(s:Student){return `${s.first_name||""} ${s.last_name||""}`.trim()||"Kursiyer"}
function age(b?:string|null,ref?:string){if(!b)return null;const x=new Date(`${b}T12:00:00`),r=new Date(`${ref||today()}T12:00:00`);let a=r.getFullYear()-x.getFullYear();if(r.getMonth()<x.getMonth()||(r.getMonth()===x.getMonth()&&r.getDate()<x.getDate()))a--;return a>=0&&a<120?a:null}
function hasDay(e:Enrollment|undefined,uiDay:number){const ds=Array.isArray(e?.lesson_weekdays)?e!.lesson_weekdays!.map(Number):[];if(!ds.length)return true;return ds.includes(uiDay===7?0:uiDay)}
function remaining(e?:Enrollment){return Math.max(0,Number(e?.total_lessons||0)-Number(e?.used_lessons||0))}
function enrollmentStamp(e:Enrollment){return Date.parse(e.created_at||e.updated_at||`${e.start_date||"1970-01-01"}T00:00:00Z`)||0}
function newestEnrollment(rows:Enrollment[]){return [...rows].sort((a,b)=>enrollmentStamp(b)-enrollmentStamp(a)||String(b.start_date||"").localeCompare(String(a.start_date||""))||String(b.id).localeCompare(String(a.id)))[0]}
function attendanceKey(scheduleId:string,studentId:string){return `${scheduleId}:${studentId}`}
function groupSaveKey(groupId:string,scheduleId:string){return `${groupId}:${scheduleId}`}

export default function QuickAttendanceClient(p:Props){
 const [date,setDate]=useState(today);
 const day=weekday(date);
 const initialBranch=(p.branches.some(b=>b.id===p.initialBranchId)?p.initialBranchId:"")||p.schedules.find(s=>scheduleWeekday(s.weekday)===weekday(today()))?.branch_id||p.branches[0]?.id||"";
 const [branchId,setBranchId]=useState(initialBranch);
 const [time,setTime]=useState("");
 const [statuses,setStatuses]=useState<Record<string,Status>>({});
 const [message,setMessage]=useState("");
 const [loaded,setLoaded]=useState(false);
 const [pending,startTransition]=useTransition();
 const [savedGroups,setSavedGroups]=useState<Record<string,boolean>>({});

 function changeDate(nextDate:string){
   if(!nextDate)return;
   setDate(nextDate);
   const nextDay=weekday(nextDate);
   if(!p.schedules.some(s=>s.is_active!==false&&scheduleWeekday(s.weekday)===nextDay&&s.branch_id===branchId)){
     const nextBranch=p.schedules.find(s=>s.is_active!==false&&scheduleWeekday(s.weekday)===nextDay)?.branch_id;
     if(nextBranch)setBranchId(nextBranch);
   }
 }

 const schedulesForDay=useMemo(()=>p.schedules.filter(s=>s.is_active!==false&&scheduleWeekday(s.weekday)===day&&(!branchId||s.branch_id===branchId)),[p.schedules,day,branchId]);
 const times=useMemo(()=>Array.from(new Set(schedulesForDay.map(s=>tm(s.start_time)))).sort(),[schedulesForDay]);
 useEffect(()=>{if(!times.length)setTime("");else if(!times.includes(time))setTime(times[0])},[times,time]);
 const schedulesAtTime=useMemo(()=>schedulesForDay.filter(s=>tm(s.start_time)===time),[schedulesForDay,time]);

 const groups=useMemo(()=>schedulesAtTime.map(schedule=>{
   const group=p.groups.find(g=>g.id===schedule.group_id);if(!group)return null;
   const enrollmentRows=p.enrollments.filter(e=>e.group_id===group.id&&e.status==="active");
   const enrollmentByStudent=new Map<string,Enrollment>();
   for(const enrollment of enrollmentRows){const studentId=enrollment.student_id||"";if(!studentId)continue;const current=enrollmentByStudent.get(studentId);enrollmentByStudent.set(studentId,current?newestEnrollment([current,enrollment]):enrollment)}

   const memberIds=new Set(p.memberships.filter(m=>m.is_active!==false&&m.group_id===group.id&&m.student_id&&hasDay(enrollmentByStudent.get(m.student_id),day)).map(m=>m.student_id as string));
   const compensationIds=new Set(p.compensationLessons.filter(c=>c.status==="planned"&&c.target_group_id===group.id&&c.lesson_date===date&&(!c.target_schedule_id||c.target_schedule_id===schedule.id)).map(c=>c.student_id));
   const ids=new Set([...memberIds,...compensationIds]);
   const students=p.students.filter(s=>ids.has(s.id)&&String(s.status||"active").toLocaleLowerCase("tr-TR")!=="passive").sort((a,b)=>fullName(a).localeCompare(fullName(b),"tr"));
   return {group,schedule,students,enrollmentByStudent,compensationIds};
 }).filter(Boolean) as Array<{group:Group;schedule:Schedule;students:Student[];enrollmentByStudent:Map<string,Enrollment>;compensationIds:Set<string>}> ,[schedulesAtTime,p.groups,p.enrollments,p.memberships,p.compensationLessons,p.students,date,day]);

 const draftKey=`sprintos:quick-attendance:${date}:${branchId}:${time}`;
 useEffect(()=>{let live=true;setLoaded(false);setStatuses({});setMessage("");if(!time||!groups.length){setLoaded(true);return}
   startTransition(async()=>{
     const rows=await Promise.all(groups.map(g=>getAttendanceForDate({groupId:g.group.id,scheduleId:g.schedule.id,lessonDate:date})));
     if(!live)return;
     const next:Record<string,Status>={};
     rows.forEach((r,i)=>{if(r.ok)(r.records||[]).forEach((x:any)=>next[attendanceKey(groups[i].schedule.id,x.student_id)]=x.status)});
     try{const raw=localStorage.getItem(draftKey);if(raw)Object.assign(next,JSON.parse(raw)?.statuses||{})}catch{}
     setStatuses(next);setLoaded(true);
   });
   return()=>{live=false}
 },[date,branchId,time]);

 useEffect(()=>{if(!loaded||!time)return;try{localStorage.setItem(draftKey,JSON.stringify({statuses,savedAt:new Date().toISOString()}))}catch{}},[statuses,draftKey,loaded,time]);

 const total=groups.reduce((n,g)=>n+g.students.length,0);
 const marked=groups.reduce((n,g)=>n+g.students.filter(s=>statuses[attendanceKey(g.schedule.id,s.id)]).length,0);

 function setStatus(g:(typeof groups)[number],s:Student,status:"present"|"absent"|"excused"){
   const e=g.enrollmentByStudent.get(s.id);const rem=remaining(e);const isComp=g.compensationIds.has(s.id);
   if(rem<=0&&!isComp){setMessage(`${fullName(s)} için ders hakkı bitmiş. Kayıt yenileme gerekiyor.`);return}
   const key=attendanceKey(g.schedule.id,s.id);const next:Status=status==="present"&&isComp?"compensation":status;
   setStatuses(v=>({...v,[key]:next}));setSavedGroups(v=>({...v,[groupSaveKey(g.group.id,g.schedule.id)]:false}));setMessage("");
 }

 function markAllPresent(g:(typeof groups)[number]){setStatuses(v=>{const n={...v};g.students.forEach(s=>{const e=g.enrollmentByStudent.get(s.id);if(remaining(e)<=0&&!g.compensationIds.has(s.id))return;n[attendanceKey(g.schedule.id,s.id)]=g.compensationIds.has(s.id)?"compensation":"present"});return n});setSavedGroups(v=>({...v,[groupSaveKey(g.group.id,g.schedule.id)]:false}))}

 function eligibleStudents(g:(typeof groups)[number]){return g.students.filter(s=>!(remaining(g.enrollmentByStudent.get(s.id))<=0&&!g.compensationIds.has(s.id)))}
 function missingStudents(g:(typeof groups)[number]){return eligibleStudents(g).filter(s=>!statuses[attendanceKey(g.schedule.id,s.id)])}
 async function persistGroup(g:(typeof groups)[number]){
   const students=eligibleStudents(g);
   if(!students.length)return {ok:true,message:"Bu seansta kaydedilecek aktif ders hakkı bulunmuyor."};
   const r=await saveAttendance({branchId:g.schedule.branch_id||g.group.branch_id||null,groupId:g.group.id,scheduleId:g.schedule.id,coachId:g.schedule.coach_id||g.group.primary_coach_id||null,lessonDate:date,records:students.map(s=>({studentId:s.id,enrollmentId:g.enrollmentByStudent.get(s.id)?.id||null,status:statuses[attendanceKey(g.schedule.id,s.id)],coachNote:null}))});
   return r;
 }
 function saveGroup(g:(typeof groups)[number]){
   const missing=missingStudents(g);
   if(missing.length){setMessage(`${g.group.name||"Seans"}: ${missing.length} öğrencinin yoklaması işaretlenmedi.`);return}
   startTransition(async()=>{
     const r=await persistGroup(g);
     if(!r.ok){setMessage(r.message);return}
     setSavedGroups(v=>({...v,[groupSaveKey(g.group.id,g.schedule.id)]:true}));
     setMessage(`✓ ${g.group.name||"Seans"} kaydedildi. Diğer seansları daha sonra kaydedebilirsiniz.`);
   })
 }
 function saveAll(){
   const missing=groups.flatMap(g=>missingStudents(g));
   if(missing.length){setMessage(`${missing.length} öğrencinin yoklaması işaretlenmedi.`);return}
   startTransition(async()=>{
     for(const g of groups){
       const r=await persistGroup(g);
       if(!r.ok){setMessage(r.message);return}
     }
     setSavedGroups(Object.fromEntries(groups.map(g=>[groupSaveKey(g.group.id,g.schedule.id),true])));
     try{localStorage.removeItem(draftKey)}catch{}
     setMessage("✓ Yoklama kaydedildi. Ders hakları ve bağlı ekranlar güncellendi.");
   })
 }

 return <main className="qaRoot">
   <section className="qaTop">
     <div><small>HIZLI YOKLAMA</small><h1>{DAYS[day]} · {date}</h1></div>
     <div className="qaSelectors">
       <input type="date" value={date} onChange={e=>changeDate(e.target.value)} aria-label="Yoklama tarihi"/>
       <select aria-label="Şube / Havuz" value={branchId} onChange={e=>setBranchId(e.target.value)}>{!p.branches.length&&<option value="">Atanmış şube yok</option>}{p.branches.map(b=><option key={b.id} value={b.id}>{b.short_name||b.name}</option>)}</select>
       <select aria-label="Ders saati" value={time} onChange={e=>setTime(e.target.value)} disabled={!times.length}>{times.length?times.map(t=><option key={t}>{t}</option>):<option>Ders yok</option>}</select>
     </div>
     <div className="qaProgress"><b>{marked}/{total}</b><span>öğrenci işlendi</span></div>
   </section>

   <AttendanceReminderPanel key={draftKey} students={p.students} context={`${date} · ${p.branches.find(b=>b.id===branchId)?.name||"Havuz"} · ${time||"Seans yok"}`} draftKey={`${draftKey}:note`}/>

   {!times.length&&<div className="qaLoading">{!p.schedules.length?"Görüntüleyebileceğiniz aktif seans bulunamadı. Yöneticinizin operasyon planındaki eğitmen atamasını kontrol etmesi gerekiyor.":"Seçilen tarih ve şubede size açık ders yok. Farklı bir tarih veya şube seçebilirsiniz."}</div>}
   {!loaded?<div className="qaLoading">Yoklama hazırlanıyor…</div>:groups.map(g=><section className="qaGroup" key={groupSaveKey(g.group.id,g.schedule.id)}>
     <header><div><b>{g.group.name||"Grup"}</b><span>{tm(g.schedule.start_time)}–{tm(g.schedule.end_time)} · {g.students.length} öğrenci</span></div><button onClick={()=>markAllPresent(g)}>Tümünü Geldi</button></header>
     <div className="qaList">{g.students.map(s=>{const key=attendanceKey(g.schedule.id,s.id);const e=g.enrollmentByStudent.get(s.id);const rem=remaining(e);const comp=g.compensationIds.has(s.id);const cur=statuses[key];const last=rem===1&&!comp;const expired=rem<=0&&!comp;return <article key={s.id} className={expired?"expired":last?"last":""}>
       <div className="qaStudent"><b>{fullName(s)}</b><span>{age(s.birth_date,date)!==null?`${age(s.birth_date,date)} yaş · `:""}{comp?"Telafi dersi":expired?"DERS HAKKI BİTTİ":last?"SON DERS":`${rem} ders kaldı`}</span></div>
       <div className="qaButtons">
         <button disabled={expired||pending} className={cur==="present"||cur==="compensation"?"on present":""} onClick={()=>setStatus(g,s,"present")}>✓ Geldi</button>
         <button disabled={expired||pending} className={cur==="absent"?"on absent":""} onClick={()=>setStatus(g,s,"absent")}>✕ Gelmedi</button>
         <button disabled={expired||pending} className={cur==="excused"?"on excused":""} onClick={()=>setStatus(g,s,"excused")}>○ İzinli</button>
       </div>
     </article>})}</div>
     <div className="qaGroupSave"><div>{savedGroups[groupSaveKey(g.group.id,g.schedule.id)]?<><b>✓ Seans kaydedildi</b><span>Değişiklik yaparsanız tekrar kaydedebilirsiniz.</span></>:<><b>Bu seansı ayrı kaydedin</b><span>Diğer seansları beklemeden kayıt işlemini tamamlar.</span></>}</div><button disabled={pending||!eligibleStudents(g).length} onClick={()=>saveGroup(g)}>{pending?"Kaydediliyor…":savedGroups[groupSaveKey(g.group.id,g.schedule.id)]?"Tekrar Kaydet":"Bu Seansı Kaydet"}</button></div>
   </section>)}

   {message&&<div className="qaMessage">{message}</div>}
   <div className="qaSticky"><div><b>{marked}/{total}</b><span> tamamlandı</span></div><button disabled={pending||!groups.length} onClick={saveAll}>{pending?"Kaydediliyor…":"Yoklamayı Kaydet"}</button></div>
   <style jsx>{`
     .qaRoot{max-width:900px;margin:0 auto;padding:12px 12px 90px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#10213a}
     .qaTop,.qaGroup{background:#fff;border:1px solid #dfe7f0;border-radius:16px;box-shadow:0 5px 16px rgba(15,23,42,.04)}
     .qaTop{padding:14px;margin-bottom:10px}.qaTop small{font-size:9px;font-weight:900;color:#1769e0;letter-spacing:.12em}.qaTop h1{font-size:18px;margin:3px 0 10px}.qaSelectors{display:grid;grid-template-columns:1fr 1fr 110px;gap:7px}.qaSelectors input,.qaSelectors select{height:42px;border:1px solid #d7e2ed;border-radius:10px;background:#fff;padding:0 8px;font-size:12px}.qaProgress{display:flex;gap:6px;align-items:baseline;margin-top:9px}.qaProgress b{font-size:17px}.qaProgress span{font-size:10px;color:#72839a}
     .qaGroup{margin:10px 0;overflow:hidden}.qaGroup header{padding:11px 12px;border-bottom:1px solid #edf1f5;display:flex;justify-content:space-between;align-items:center;gap:10px}.qaGroup header div{display:grid;gap:2px}.qaGroup header b{font-size:13px}.qaGroup header span{font-size:9px;color:#7a8a9c}.qaGroup header button{border:1px solid #bad5f4;background:#f4f9ff;color:#1769d2;border-radius:9px;min-height:36px;padding:0 10px;font-size:10px;font-weight:900}
     .qaList{display:grid}.qaList article{padding:11px 12px;border-bottom:1px solid #edf1f5}.qaList article:last-child{border-bottom:0}.qaList article.last{background:#fffaf0}.qaList article.expired{background:#fff1f2}.qaStudent{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.qaStudent b{font-size:13px}.qaStudent span{font-size:9px;font-weight:850;color:#607287}.last .qaStudent span{color:#a56800}.expired .qaStudent span{color:#b42333}
     .qaButtons{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.qaButtons button{min-height:42px;border:1px solid #d8e2ec;border-radius:10px;background:#fff;font-size:10px;font-weight:900;color:#53677e}.qaButtons button.on.present{background:#eaf9ef;border-color:#9bd8af;color:#14733a}.qaButtons button.on.absent{background:#fff0f2;border-color:#f1b6bf;color:#b42333}.qaButtons button.on.excused{background:#fff8e8;border-color:#ebd08b;color:#8a6200}.qaButtons button:disabled{opacity:.45}
     .qaGroupSave{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#f8fbff;border-top:1px solid #e5edf6}.qaGroupSave div{display:grid;gap:2px}.qaGroupSave b{font-size:11px}.qaGroupSave span{font-size:9px;color:#6d7d90}.qaGroupSave button{min-height:40px;border:0;border-radius:10px;background:#1769df;color:#fff;padding:0 14px;font-size:10px;font-weight:950}.qaGroupSave button:disabled{opacity:.5}
     .qaLoading,.qaMessage{margin:10px 0;padding:13px;border-radius:12px;background:#f4f8fc;border:1px solid #dce7f2;font-size:11px;font-weight:800}.qaMessage{position:sticky;bottom:78px;z-index:4;background:#fff7df;border-color:#edd18b}
     .qaSticky{position:fixed;left:0;right:0;bottom:0;z-index:20;background:rgba(255,255,255,.97);border-top:1px solid #dce5ef;padding:10px max(12px,calc((100vw - 900px)/2));display:flex;align-items:center;justify-content:space-between;gap:12px;backdrop-filter:blur(8px)}.qaSticky div{font-size:11px;color:#6d7d90}.qaSticky div b{font-size:16px;color:#10213a}.qaSticky button{min-height:48px;min-width:180px;border:0;border-radius:12px;background:#1769df;color:#fff;font-weight:950;font-size:12px}.qaSticky button:disabled{opacity:.55}
     @media(max-width:620px){.qaRoot{padding:8px 8px 92px}.qaTop{padding:11px}.qaSelectors{grid-template-columns:1fr 1fr}.qaSelectors select:last-child{grid-column:1/-1}.qaGroup{border-radius:14px}.qaStudent{align-items:flex-start}.qaButtons button{min-height:46px}.qaGroupSave{align-items:stretch;flex-direction:column}.qaGroupSave button{width:100%;min-height:44px}.qaSticky{padding:9px 10px}.qaSticky button{flex:1;min-width:0}}
   `}</style>
 </main>
}

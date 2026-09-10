"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { getAttendanceForDate, saveAttendance } from "./actions";

type Status = "present" | "absent" | "excused" | "compensation";
type Branch = { id:string; name?:string|null; short_name?:string|null };
type Group = { id:string; branch_id?:string|null; level_id?:string|null; name?:string|null; course_type?:string|null; capacity?:number|null; primary_coach_id?:string|null };
type Schedule = { id:string; branch_id?:string|null; group_id?:string|null; coach_id?:string|null; weekday?:number|null; start_time?:string|null; end_time?:string|null; is_active?:boolean|null };
type Membership = { student_id?:string|null; group_id?:string|null; level_id?:string|null; is_active?:boolean|null };
type Student = { id:string; first_name?:string|null; last_name?:string|null; student_number?:string|null; phone?:string|null; guardian_phone?:string|null; swimming_level?:string|null; medical_note?:string|null; general_note?:string|null };
type Enrollment = { id:string; student_id?:string|null; group_id?:string|null; start_date?:string|null; planned_end_date?:string|null; total_lessons?:number|null; used_lessons?:number|null; status?:string|null };
type Profile = { id:string; full_name?:string|null };
type Level = { id:string; name?:string|null };
type Compensation = { student_id:string; target_group_id:string; target_schedule_id?:string|null; lesson_date:string; status:string };
type HistoryRow = { student_id?:string|null; group_id?:string|null; lesson_date?:string|null; status?:string|null };

type Props={branches:Branch[];groups:Group[];schedules:Schedule[];memberships:Membership[];students:Student[];enrollments:Enrollment[];profiles:Profile[];levels:Level[];compensationLessons:Compensation[];attendanceHistory:HistoryRow[];initialBranchId?:string};

const DAYS:Record<number,string>={1:"Pazartesi",2:"Salı",3:"Çarşamba",4:"Perşembe",5:"Cuma",6:"Cumartesi",7:"Pazar"};
const STATUS:{key:Status;label:string;short:string}[]=[{key:"present",label:"Geldi",short:"✓"},{key:"absent",label:"Gelmedi",short:"✕"},{key:"excused",label:"İzinli",short:"○"},{key:"compensation",label:"Telafi",short:"T"}];
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function weekday(v:string){const d=new Date(`${v}T12:00:00`);const x=d.getDay();return x===0?7:x}
function shift(v:string,n:number){const d=new Date(`${v}T12:00:00`);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function trDate(v?:string|null){if(!v)return"—";return new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${v}T12:00:00`))}
function tm(v?:string|null){return v?.slice(0,5)||"—"}
function norm(v?:string|null){return (v||"").toLocaleLowerCase("tr-TR")}
function adult(g:Group){const s=norm(`${g.name||""} ${g.course_type||""}`);return s.includes("yetişkin")||s.includes("yetiskin")||s.includes("adult")||s.includes("master")}
function cleanPhone(v?:string|null){return (v||"").replace(/\D/g,"")}
function waPhone(v:string){if(v.startsWith("90"))return v;if(v.startsWith("0"))return `90${v.slice(1)}`;return v.length===10?`90${v}`:v}
function fullName(s:Student){return `${s.first_name||""} ${s.last_name||""}`.trim()||"Kursiyer"}

export default function SessionAttendanceClient(p:Props){
 const [date,setDate]=useState(today());
 const firstBranch=p.initialBranchId||p.schedules.find(s=>s.weekday===weekday(today()))?.branch_id||p.branches[0]?.id||"";
 const [branchId,setBranchId]=useState(firstBranch||"");
 const [time,setTime]=useState("");
 const [query,setQuery]=useState("");
 const [filter,setFilter]=useState("all");
 const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const [statuses,setStatuses]=useState<Record<string,Status>>({});
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [message,setMessage]=useState("Hazır.");
 const [saved,setSaved]=useState(false);
 const [pending,startTransition]=useTransition();
 const day=weekday(date);
 const branch=p.branches.find(b=>b.id===branchId);
 const levelMap=useMemo(()=>new Map(p.levels.map(l=>[l.id,l.name||""])),[p.levels]);
 const profileMap=useMemo(()=>new Map(p.profiles.map(x=>[x.id,x.full_name||"Eğitmen"])),[p.profiles]);
 const eligible=useMemo(()=>p.schedules.filter(s=>s.is_active!==false&&Number(s.weekday)===day&&(!branchId||s.branch_id===branchId)),[p.schedules,day,branchId]);
 const times=useMemo(()=>Array.from(new Set(eligible.map(s=>tm(s.start_time)))).sort(),[eligible]);
 useEffect(()=>{if(!times.length){setTime("");return}if(!times.includes(time))setTime(times[0])},[times,time]);
 const atTime=useMemo(()=>eligible.filter(s=>tm(s.start_time)===time),[eligible,time]);
 const sessionGroups=useMemo(()=>{const ids=Array.from(new Set(atTime.map(s=>s.group_id).filter(Boolean))) as string[];return ids.map(id=>p.groups.find(g=>g.id===id)).filter(Boolean) as Group[]},[atTime,p.groups]);
 const groupInfo=useMemo(()=>sessionGroups.map(group=>{const groupSchedules=atTime.filter(s=>s.group_id===group.id);const schedule=groupSchedules[0];const coachIds=Array.from(new Set([group.primary_coach_id,...groupSchedules.map(s=>s.coach_id)].filter(Boolean))) as string[];const memberIds=new Set(p.memberships.filter(m=>m.is_active!==false&&m.group_id===group.id&&m.student_id).map(m=>m.student_id as string));const compensationIds=new Set(p.compensationLessons.filter(c=>c.status==="planned"&&c.target_group_id===group.id&&c.lesson_date===date&&(!c.target_schedule_id||groupSchedules.some(s=>s.id===c.target_schedule_id))).map(c=>c.student_id));const ids=new Set([...memberIds,...compensationIds]);const students=p.students.filter(s=>ids.has(s.id)).sort((a,b)=>fullName(a).localeCompare(fullName(b),"tr"));const levelName=levelMap.get(group.level_id||"")||students.find(s=>s.swimming_level)?.swimming_level||"Genel";return{group,schedule,groupSchedules,coachIds,students,compensationIds,levelName,isAdult:adult(group)} }),[sessionGroups,atTime,p.memberships,p.compensationLessons,p.students,date,levelMap]);

 useEffect(()=>{let live=true;setStatuses({});setNotes({});setSaved(false);const valid=groupInfo.filter(x=>x.schedule);if(!valid.length)return;startTransition(async()=>{const results=await Promise.all(valid.map(x=>getAttendanceForDate({groupId:x.group.id,scheduleId:x.schedule!.id,lessonDate:date})));if(!live)return;const sm:Record<string,Status>={};const nm:Record<string,string>={};let any=false;results.forEach((r,i)=>{if(!r.ok)return;(r.records||[]).forEach((raw:any)=>{const k=`${valid[i].group.id}:${raw.student_id}`;sm[k]=raw.status;nm[k]=raw.coach_note||"";any=true})});setStatuses(sm);setNotes(nm);setSaved(any)});return()=>{live=false}},[date,branchId,time]);

 const levelFilters=useMemo(()=>Array.from(new Set(groupInfo.map(x=>x.levelName).filter(Boolean))),[groupInfo]);
 const visibleGroups=groupInfo.filter(x=>!(filter==="child"&&x.isAdult)&&!(filter==="adult"&&!x.isAdult)&&!(filter.startsWith("level:")&&x.levelName!==filter.slice(6)));
 const q=norm(query.trim());
 const totalStudents=visibleGroups.reduce((n,x)=>n+x.students.filter(s=>!q||norm(`${fullName(s)} ${s.student_number} ${s.phone} ${s.guardian_phone}`).includes(q)).length,0);
 const marked=Object.keys(statuses).filter(k=>visibleGroups.some(g=>k.startsWith(`${g.group.id}:`))).length;

 function enrollmentOf(s:Student,g:Group){return p.enrollments.find(e=>e.student_id===s.id&&e.group_id===g.id)}
 function remaining(e?:Enrollment){return Math.max(0,Number(e?.total_lessons||0)-Number(e?.used_lessons||0))}
 function expired(e?:Enrollment){return !!e&&remaining(e)<=0}
 function consecutiveAbsences(s:Student,g:Group){const rows=p.attendanceHistory.filter(r=>r.student_id===s.id&&r.group_id===g.id&&r.lesson_date&&r.lesson_date<date).sort((a,b)=>(b.lesson_date||"").localeCompare(a.lesson_date||""));return rows.length>=2&&rows[0].status==="absent"&&rows[1].status==="absent"}
 function setStatus(groupId:string,studentId:string,status:Status){const g=p.groups.find(x=>x.id===groupId);const s=p.students.find(x=>x.id===studentId);const e=s&&g?enrollmentOf(s,g):undefined;if(expired(e)){setMessage(`${s?fullName(s):"Kursiyer"} kaydı bitmiş. Yoklama için yönetici kontrolü gerekir.`);return}setStatuses(old=>({...old,[`${groupId}:${studentId}`]:status}))}
 function markGroup(groupId:string){const info=groupInfo.find(x=>x.group.id===groupId);if(!info)return;setStatuses(old=>{const next={...old};info.students.forEach(s=>{const e=enrollmentOf(s,info.group);if(!expired(e))next[`${groupId}:${s.id}`]=info.compensationIds.has(s.id)?"compensation":"present"});return next})}
 function openMessage(s:Student,g:Group,mode:"status"|"renewal"|"absence"){const phone=cleanPhone(adult(g)?(s.phone||s.guardian_phone):(s.guardian_phone||s.phone));if(!phone){setMessage("WhatsApp numarası bulunamadı.");return}const e=enrollmentOf(s,g);const current=statuses[`${g.id}:${s.id}`];let text="";if(mode==="renewal")text=`Merhaba, ${fullName(s)} isimli kursiyerimizin mevcut ders paketi tamamlanmıştır. Kayıt yenileme işlemi için bizimle iletişime geçebilirsiniz.\n\nSprint Yüzme Okulu`;else if(mode==="absence")text=`Merhaba, ${fullName(s)} isimli kursiyerimiz son iki dersine katılım sağlamadı. Devam durumunu birlikte kontrol etmek istedik.\n\nSprint Yüzme Okulu`;else text=`Merhaba, ${fullName(s)} için ${trDate(date)} tarihli ders yoklaması: ${current?STATUS.find(x=>x.key===current)?.label:"işaretlenmedi"}.\nŞube: ${branch?.short_name||branch?.name||"Sprint"} · Saat: ${time}.\n\nSprint Yüzme Okulu`;window.open(`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer")}
 async function saveAll(){const targets=visibleGroups.filter(x=>x.schedule);const missing=targets.flatMap(x=>x.students.filter(s=>!expired(enrollmentOf(s,x.group))&&!statuses[`${x.group.id}:${s.id}`]));if(missing.length){setMessage(`${missing.length} öğrencinin yoklaması işaretlenmedi.`);return}startTransition(async()=>{for(const x of targets){const activeStudents=x.students.filter(s=>!expired(enrollmentOf(s,x.group)));if(!activeStudents.length)continue;const result=await saveAttendance({branchId:x.schedule?.branch_id||x.group.branch_id||null,groupId:x.group.id,scheduleId:x.schedule!.id,coachId:x.schedule?.coach_id||x.group.primary_coach_id||null,lessonDate:date,records:activeStudents.map(s=>({studentId:s.id,enrollmentId:enrollmentOf(s,x.group)?.id||null,status:statuses[`${x.group.id}:${s.id}`],coachNote:notes[`${x.group.id}:${s.id}`]?.trim()||null}))});if(!result.ok){setMessage(result.message);return}}setSaved(true);setMessage("Tüm seans yoklamaları kaydedildi; ders hakları ve bağlı kartlar güncellendi.")})}

 return <div className="saRoot">
   <header className="saHero"><div className="saHeroIcon">✓</div><div><h1>Yoklama &amp; Ders Yönetimi</h1><p>Aynı saatteki tüm grupları tek ekrandan yönetin.</p></div><div className="saHeroActions"><button onClick={()=>setDate(today())}>Bugünün Yoklaması</button><Link href="/raporlar">Aylık Görünüm</Link></div></header>
   <section className="saSelectors"><label>Tarih<div className="saDate"><button onClick={()=>setDate(shift(date,-1))}>‹</button><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><button onClick={()=>setDate(shift(date,1))}>›</button></div></label><label>Şube / Havuz<select value={branchId} onChange={e=>setBranchId(e.target.value)}>{p.branches.map(b=><option key={b.id} value={b.id}>{b.short_name||b.name||"Şube"}</option>)}</select></label><label>Saat<select value={time} onChange={e=>setTime(e.target.value)}>{times.length?times.map(t=><option key={t}>{t}</option>):<option>Seans yok</option>}</select></label><button className="saSave" disabled={pending||!visibleGroups.length} onClick={saveAll}>{pending?"Kaydediliyor…":saved?"Yoklamayı Güncelle":"Yoklamayı Kaydet"}</button></section>
   <section className="saSessionBar"><div><strong>{DAYS[day]}, {trDate(date)} · {branch?.short_name||branch?.name||"Tüm Şubeler"} · {time||"—"}</strong><span>Bu saatte {groupInfo.length} grup ve {groupInfo.reduce((n,x)=>n+x.students.length,0)} öğrenci var.</span></div><div className="saSessionActions"><Link href="/raporlar">Yoklama Raporu</Link></div></section>
   <section className="saFilterbar"><div className="saSearch">⌕ <input placeholder="Öğrenci, veli veya numara ara..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="saChips"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Tümü <b>{groupInfo.reduce((n,x)=>n+x.students.length,0)}</b></button><button className={filter==="child"?"active":""} onClick={()=>setFilter("child")}>Çocuk</button><button className={filter==="adult"?"active":""} onClick={()=>setFilter("adult")}>Yetişkin</button>{levelFilters.map(l=><button key={l} className={filter===`level:${l}`?"active":""} onClick={()=>setFilter(`level:${l}`)}>{l}</button>)}</div></section>
   <div className="saGroups">{visibleGroups.map((x,idx)=>{const tone=["green","blue","purple","amber"][idx%4];const rows=x.students.filter(s=>!q||norm(`${fullName(s)} ${s.student_number} ${s.phone} ${s.guardian_phone}`).includes(q));const isCollapsed=collapsed[x.group.id];return <section className={`saGroup saTone-${tone}`} key={x.group.id}>
     <header className="saGroupHead"><div className="saGroupIcon">👥</div><div className="saGroupTitle"><h2>{x.isAdult?"Yetişkin":"Çocuk"} Grubu ({x.levelName})</h2><div>⌖ {branch?.short_name||branch?.name||"Şube"} · {DAYS[day]} · ◷ {tm(x.schedule?.start_time)} - {tm(x.schedule?.end_time)}</div></div><div className="saCoaches"><small>Eğitmenler ({x.coachIds.length})</small><div>{x.coachIds.length?x.coachIds.map(id=><span key={id}>● {profileMap.get(id)||"Eğitmen"}</span>):<span>Atanmamış</span>}</div></div><div className="saCount"><strong>{x.students.filter(s=>statuses[`${x.group.id}:${s.id}`]).length} / {x.students.length}</strong><small>Öğrenci</small><div><i style={{width:`${x.students.length?Math.round(x.students.filter(s=>statuses[`${x.group.id}:${s.id}`]).length/x.students.length*100):0}%`}}/></div></div><button className="saCollapse" onClick={()=>setCollapsed(o=>({...o,[x.group.id]:!o[x.group.id]}))}>{isCollapsed?"⌄":"⌃"}</button></header>
     {!isCollapsed&&<><div className="saGroupTools"><button onClick={()=>markGroup(x.group.id)}>✓ Tümünü Geldi</button><Link href={`/gruplar?groupId=${x.group.id}`}>Grup Kartı</Link></div><div className="saTableWrap"><table><thead><tr><th>Öğrenci</th><th>Seviye</th><th>Durum</th><th>Not</th><th>Kayıt</th><th>İşlem</th></tr></thead><tbody>{rows.map(s=>{const key=`${x.group.id}:${s.id}`;const e=enrollmentOf(s,x.group);const rem=remaining(e);const isExpired=expired(e);const twoAbsent=consecutiveAbsences(s,x.group);return <tr key={s.id} className={isExpired?"isExpired":""}><td data-label="Öğrenci"><Link className="saStudent" href={`/ogrenciler/${s.id}`}>{fullName(s)}</Link><small>{s.student_number||""}</small>{twoAbsent&&<span className="saWarning">⚠ 2 ders üst üste gelmedi</span>}{isExpired&&<span className="saDanger">KAYIT BİTTİ · Yönetici kontrolü</span>}</td><td data-label="Seviye">{s.swimming_level||x.levelName}</td><td data-label="Durum"><div className="saStatus">{STATUS.map(st=><button key={st.key} disabled={isExpired} className={statuses[key]===st.key?`active ${st.key}`:""} onClick={()=>setStatus(x.group.id,s.id,st.key)} title={isExpired?"Kayıt bitmiş; yönetici kontrolü gerekir":st.label}>{st.short}<span>{st.label}</span></button>)}</div></td><td data-label="Not"><input value={notes[key]||""} onChange={ev=>setNotes(o=>({...o,[key]:ev.target.value}))} placeholder="Antrenör notu"/></td><td data-label="Kayıt"><div className="saEnrollment"><b>{rem} ders kaldı</b><small>Başlangıç {trDate(e?.start_date)}</small><small>Bitiş {trDate(e?.planned_end_date)}</small></div></td><td data-label="İşlem"><div className="saActions"><Link title="Dijital kursiyer dosyası" href={`/ogrenciler/${s.id}`}>◉ Kart</Link><button title="Yoklama durumuna göre hazır mesaj" onClick={()=>openMessage(s,x.group,"status")}>✦ Akıllı Mesaj</button>{twoAbsent&&<button className="warn" onClick={()=>openMessage(s,x.group,"absence")}>⚠ Devam Mesajı</button>}{isExpired&&<button className="danger" onClick={()=>openMessage(s,x.group,"renewal")}>↻ Yenileme Mesajı</button>}</div></td></tr>})}</tbody></table></div></>}
   </section>})}</div>
   {!visibleGroups.length&&<div className="saEmpty">Bu tarih, şube ve saatte aktif ders bulunamadı.</div>}
   <footer className="saFooter"><div className="saLegend"><span className="present">✓ Geldi</span><span className="absent">✕ Gelmedi</span><span className="excused">○ İzinli</span><span className="compensation">T Telafi</span></div><div className="saTotal">Toplam: {marked}/{totalStudents} öğrenci <div><i style={{width:`${totalStudents?Math.round(marked/totalStudents*100):0}%`}}/></div><b>%{totalStudents?Math.round(marked/totalStudents*100):0}</b></div></footer>
   <div className="saMessage">{message}</div>
 </div>
}

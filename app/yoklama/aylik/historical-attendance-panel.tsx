"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "present" | "absent" | "excused";
type Student = { id:string; first_name?:string|null; last_name?:string|null; student_number?:string|null; guardian_name?:string|null; guardian_phone?:string|null; phone?:string|null };
type Branch = { id:string; name?:string|null; short_name?:string|null };
type Group = { id:string; branch_id?:string|null; name?:string|null; course_type?:string|null };
type Schedule = { id:string; branch_id?:string|null; group_id?:string|null; coach_id?:string|null; weekday?:number|null; start_time?:string|null; end_time?:string|null };
type Membership = { student_id?:string|null; group_id?:string|null };
type Enrollment = { id:string; student_id?:string|null; group_id?:string|null; start_date?:string|null; planned_end_date?:string|null; normal_end_date?:string|null; compensation_end_date?:string|null; total_lessons?:number|null; used_lessons?:number|null; status?:string|null };
type Attendance = { student_id?:string|null; enrollment_id?:string|null; group_id?:string|null; schedule_id?:string|null; lesson_date?:string|null; status?:string|null };
type ImportRecord = { studentId:string; enrollmentId:string|null; groupId:string; scheduleId:string; lessonDate:string; status:Status };
type PendingRequest = { id:string; reason?:string|null; requested_by_name?:string|null; created_at?:string|null; new_values?:{month?:string;mode?:string;records?:ImportRecord[]}|null };
type ApiData = { ok:boolean; error?:string; canApprove:boolean; branches:Branch[]; groups:Group[]; schedules:Schedule[]; memberships:Membership[]; students:Student[]; enrollments:Enrollment[]; attendance:Attendance[]; pendingRequests:PendingRequest[] };

const DAYS:Record<number,string>={1:"Pazartesi",2:"Salı",3:"Çarşamba",4:"Perşembe",5:"Cuma",6:"Cumartesi",7:"Pazar"};
const STATUS_LABEL:Record<Status,string>={present:"Geldi",absent:"Gelmedi",excused:"İzinli"};
const todayTR=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const fullName=(student?:Student|null)=>student?`${student.first_name||""} ${student.last_name||""}`.trim()||"Kursiyer":"Kursiyer";
const tm=(value?:string|null)=>value?.slice(0,5)||"—";
const trDate=(value:string)=>new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",weekday:"short"}).format(new Date(`${value}T12:00:00`));
const norm=(value:string)=>value.toLocaleLowerCase("tr-TR");
const keyOf=(studentId:string,date:string,groupId:string,scheduleId:string)=>`${studentId}:${date}:${groupId}:${scheduleId}`;

function monthDates(month:string, weekday:number){
  const first=new Date(`${month}-01T12:00:00`);const next=new Date(first);next.setMonth(next.getMonth()+1);const today=todayTR();const result:string[]=[];
  for(const d=new Date(first);d<next;d.setDate(d.getDate()+1)){const day=d.getDay()===0?7:d.getDay();const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;if(day===weekday&&iso<=today)result.push(iso)}
  return result;
}

export default function HistoricalAttendancePanel({month}:{month:string}){
  const [data,setData]=useState<ApiData|null>(null);const [loading,setLoading]=useState(true);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const [mode,setMode]=useState<"student"|"group">("student");const [search,setSearch]=useState("");const [studentId,setStudentId]=useState("");const [branchId,setBranchId]=useState("");const [groupId,setGroupId]=useState("");const [scheduleId,setScheduleId]=useState("");const [lessonDate,setLessonDate]=useState("");
  const [edits,setEdits]=useState<Record<string,ImportRecord>>({});

  async function load(){setLoading(true);setMessage("");try{const res=await fetch(`/api/attendance-history-import?month=${encodeURIComponent(month)}`,{cache:"no-store"});const json=await res.json();if(!res.ok||!json.ok)throw new Error(json.error||"Veriler yüklenemedi.");setData(json)}catch(error){setMessage(error instanceof Error?error.message:"Veriler yüklenemedi.")}finally{setLoading(false)}}
  useEffect(()=>{setEdits({});setStudentId("");setGroupId("");setScheduleId("");setLessonDate("");void load()},[month]);

  const studentMap=useMemo(()=>new Map((data?.students||[]).map(s=>[s.id,s])),[data]);
  const groupMap=useMemo(()=>new Map((data?.groups||[]).map(g=>[g.id,g])),[data]);
  const attendanceMap=useMemo(()=>{const m=new Map<string,Attendance>();for(const row of data?.attendance||[]){if(row.student_id&&row.lesson_date&&row.group_id&&row.schedule_id)m.set(keyOf(row.student_id,row.lesson_date,row.group_id,row.schedule_id),row)}return m},[data]);
  const q=norm(search.trim());
  const searchResults=useMemo(()=>!q?[]:(data?.students||[]).filter(s=>norm(`${fullName(s)} ${s.student_number||""} ${s.guardian_name||""} ${s.guardian_phone||""} ${s.phone||""}`).includes(q)).slice(0,12),[data,q]);

  const studentGroupIds=useMemo(()=>{if(!studentId||!data)return[];const ids=new Set<string>();data.memberships.forEach(m=>{if(m.student_id===studentId&&m.group_id)ids.add(m.group_id)});data.enrollments.forEach(e=>{if(e.student_id===studentId&&e.group_id)ids.add(e.group_id)});return [...ids]},[data,studentId]);
  const studentGroups=(data?.groups||[]).filter(g=>studentGroupIds.includes(g.id));
  const branchGroups=(data?.groups||[]).filter(g=>!branchId||g.branch_id===branchId);
  const visibleGroups=mode==="student"?studentGroups:branchGroups;
  const visibleSchedules=(data?.schedules||[]).filter(s=>s.group_id===groupId&&(!branchId||mode==="student"||s.branch_id===branchId));
  const selectedSchedule=visibleSchedules.find(s=>s.id===scheduleId);
  const dates=selectedSchedule?.weekday?monthDates(month,Number(selectedSchedule.weekday)):[];
  const selectedStudent=studentMap.get(studentId);

  useEffect(()=>{if(groupId&&!visibleGroups.some(g=>g.id===groupId)){setGroupId("");setScheduleId("");setLessonDate("")}},[branchId,studentId,mode]);
  useEffect(()=>{if(scheduleId&&!visibleSchedules.some(s=>s.id===scheduleId)){setScheduleId("");setLessonDate("")}},[groupId]);
  useEffect(()=>{if(scheduleId&&dates.length&&!dates.includes(lessonDate))setLessonDate(dates[dates.length-1]);if(!dates.length)setLessonDate("")},[scheduleId,month]);

  function enrollmentFor(student:string,group:string,date:string){
    const rows=(data?.enrollments||[]).filter(e=>e.student_id===student&&e.group_id===group);return rows.find(e=>{const end=e.compensation_end_date||e.normal_end_date||e.planned_end_date;return(!e.start_date||date>=e.start_date)&&(!end||date<=end)})||rows.find(e=>e.status==="active")||rows[0];
  }
  function statusFor(student:string,date:string){const key=keyOf(student,date,groupId,scheduleId);return edits[key]?.status||(attendanceMap.get(key)?.status as Status|undefined)}
  function setStatus(student:string,date:string,status:Status){if(!groupId||!scheduleId)return;const enrollment=enrollmentFor(student,groupId,date);const key=keyOf(student,date,groupId,scheduleId);setEdits(current=>({...current,[key]:{studentId:student,enrollmentId:enrollment?.id||null,groupId,scheduleId,lessonDate:date,status}}))}
  function clearEdit(student:string,date:string){const key=keyOf(student,date,groupId,scheduleId);setEdits(current=>{const next={...current};delete next[key];return next})}

  const groupStudentIds=useMemo(()=>{if(!groupId||!data)return[];const ids=new Set<string>();data.memberships.forEach(m=>{if(m.group_id===groupId&&m.student_id)ids.add(m.student_id)});data.enrollments.forEach(e=>{if(e.group_id===groupId&&e.student_id&&e.status==="active")ids.add(e.student_id)});return [...ids]},[data,groupId]);
  const groupStudents=groupStudentIds.map(id=>studentMap.get(id)).filter(Boolean) as Student[];

  async function submit(){const records=Object.values(edits);if(!records.length){setMessage("Önce en az bir geçmiş yoklama işaretleyin.");return}setBusy(true);setMessage("");try{const res=await fetch("/api/attendance-history-import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit",month,mode:mode==="student"?"student_month":"branch_day",records})});const json=await res.json();if(!res.ok||!json.ok)throw new Error(json.error||"Onay talebi oluşturulamadı.");setMessage(json.message);setEdits({});await load()}catch(error){setMessage(error instanceof Error?error.message:"İşlem tamamlanamadı.")}finally{setBusy(false)}}
  async function decide(requestId:string,action:"approve"|"reject"){setBusy(true);setMessage("");try{const res=await fetch("/api/attendance-history-import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,requestId})});const json=await res.json();if(!res.ok||!json.ok)throw new Error(json.error||"Onay işlemi tamamlanamadı.");setMessage(json.message);await load();window.location.reload()}catch(error){setMessage(error instanceof Error?error.message:"Onay işlemi tamamlanamadı.")}finally{setBusy(false)}}

  return <section className="haiPanel">
    <div className="haiHead"><div><span>GEÇMİŞ YOKLAMA AKTARIMI</span><h2>Aylık yoklamayı geriye dönük gir</h2><p>Öğrenci bazında bütün ayı veya şube–seans bazında belirli bir günü işaretleyin. Kayıtlar doğrudan işlenmez; önce yönetici onayına gider.</p></div><div className="haiApprovalBadge">✓ Yönetici Onaylı Akış</div></div>
    <div className="haiMode"><button type="button" className={mode==="student"?"active":""} onClick={()=>{setMode("student");setBranchId("");setGroupId("");setScheduleId("")}}>Öğrenciye Göre Aylık</button><button type="button" className={mode==="group"?"active":""} onClick={()=>{setMode("group");setStudentId("");setSearch("");setGroupId("");setScheduleId("")}}>Şube / Gün Bazlı</button></div>
    {loading?<div className="haiEmpty">Geçmiş yoklama ekranı hazırlanıyor…</div>:data?<>
      {mode==="student"?<div className="haiWork">
        <div className="haiSearch"><label>Öğrenci Ara<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Öğrenci adı, numara, veli veya telefon"/></label>{q&&searchResults.length>0&&<div className="haiResults">{searchResults.map(s=><button type="button" key={s.id} onClick={()=>{setStudentId(s.id);setSearch(fullName(s));setGroupId("");setScheduleId("")}}><b>{fullName(s)}</b><small>{s.student_number||"Numara yok"}{s.guardian_name?` · ${s.guardian_name}`:""}</small></button>)}</div>}</div>
        {selectedStudent&&<div className="haiSelected"><strong>{fullName(selectedStudent)}</strong><span>{selectedStudent.student_number||"Öğrenci numarası yok"}</span></div>}
        <div className="haiSelectors"><label>Grup<select value={groupId} onChange={e=>{setGroupId(e.target.value);setScheduleId("")}}><option value="">Grup seçin</option>{studentGroups.map(g=><option key={g.id} value={g.id}>{g.name||"Grup"}</option>)}</select></label><label>Seans<select value={scheduleId} onChange={e=>setScheduleId(e.target.value)}><option value="">Seans seçin</option>{visibleSchedules.map(s=><option key={s.id} value={s.id}>{DAYS[Number(s.weekday)]||"Gün"} · {tm(s.start_time)}–{tm(s.end_time)}</option>)}</select></label></div>
        {selectedStudent&&scheduleId&&<div className="haiMonthGrid"><div className="haiGridHead"><div><strong>{month} Aylık Yoklama</strong><small>{groupMap.get(groupId)?.name||"Grup"} · {DAYS[Number(selectedSchedule?.weekday)]} · {tm(selectedSchedule?.start_time)}</small></div><button type="button" onClick={()=>dates.forEach(date=>setStatus(studentId,date,"present"))}>Tümünü Geldi</button></div>{dates.map(date=><AttendanceLine key={date} date={date} status={statusFor(studentId,date)} changed={Boolean(edits[keyOf(studentId,date,groupId,scheduleId)])} onStatus={s=>setStatus(studentId,date,s)} onClear={()=>clearEdit(studentId,date)}/>)}</div>}
      </div>:<div className="haiWork">
        <div className="haiSelectors haiSelectorsThree"><label>Şube<select value={branchId} onChange={e=>{setBranchId(e.target.value);setGroupId("");setScheduleId("")}}><option value="">Şube seçin</option>{data.branches.map(b=><option key={b.id} value={b.id}>{b.short_name||b.name}</option>)}</select></label><label>Grup<select value={groupId} onChange={e=>{setGroupId(e.target.value);setScheduleId("")}}><option value="">Grup seçin</option>{branchGroups.map(g=><option key={g.id} value={g.id}>{g.name||"Grup"}</option>)}</select></label><label>Seans<select value={scheduleId} onChange={e=>setScheduleId(e.target.value)}><option value="">Seans seçin</option>{visibleSchedules.map(s=><option key={s.id} value={s.id}>{DAYS[Number(s.weekday)]||"Gün"} · {tm(s.start_time)}–{tm(s.end_time)}</option>)}</select></label></div>
        {scheduleId&&<div className="haiDateBar"><label>Geçmiş Ders Günü<select value={lessonDate} onChange={e=>setLessonDate(e.target.value)}>{dates.map(date=><option key={date} value={date}>{trDate(date)}</option>)}</select></label><button type="button" disabled={!lessonDate} onClick={()=>groupStudents.forEach(s=>setStatus(s.id,lessonDate,"present"))}>Listedekilerin Tümü Geldi</button></div>}
        {lessonDate&&<div className="haiRoster"><div className="haiRosterTitle"><strong>{groupMap.get(groupId)?.name||"Grup"}</strong><span>{trDate(lessonDate)} · {groupStudents.length} öğrenci</span></div>{groupStudents.map(s=><div className="haiStudentRow" key={s.id}><div><b>{fullName(s)}</b><small>{s.student_number||"Numara yok"}</small></div><StatusButtons status={statusFor(s.id,lessonDate)} changed={Boolean(edits[keyOf(s.id,lessonDate,groupId,scheduleId)])} onStatus={st=>setStatus(s.id,lessonDate,st)} onClear={()=>clearEdit(s.id,lessonDate)}/></div>)}</div>}
      </div>}
      <div className="haiSave"><div><b>{Object.keys(edits).length}</b><span>değişiklik onaya hazır</span></div><button type="button" disabled={busy||!Object.keys(edits).length} onClick={submit}>{busy?"İşleniyor…":"Yönetici Onayına Gönder"}</button></div>
      {!!data.pendingRequests.length&&<div className="haiPending"><div className="haiPendingHead"><div><span>ONAY BEKLEYENLER</span><h3>{data.canApprove?"Yönetici karar ekranı":"Gönderdiğiniz talepler"}</h3></div><b>{data.pendingRequests.length}</b></div>{data.pendingRequests.map(req=>{const count=req.new_values?.records?.length||0;return <div className="haiPendingRow" key={req.id}><div><strong>{req.reason||"Geçmiş yoklama aktarımı"}</strong><small>{req.requested_by_name||"Personel"} · {req.created_at?new Intl.DateTimeFormat("tr-TR",{dateStyle:"short",timeStyle:"short"}).format(new Date(req.created_at)):""}</small></div>{data.canApprove?<div className="haiDecision"><button type="button" className="reject" disabled={busy} onClick={()=>decide(req.id,"reject")}>Reddet</button><button type="button" className="approve" disabled={busy} onClick={()=>decide(req.id,"approve")}>Onayla · {count}</button></div>:<span className="haiWaiting">Yönetici onayı bekliyor</span>}</div>})}</div>}
    </>:null}
    {message&&<div className="haiMessage">{message}</div>}
  </section>
}

function AttendanceLine({date,status,changed,onStatus,onClear}:{date:string;status?:Status;changed:boolean;onStatus:(s:Status)=>void;onClear:()=>void}){return <div className="haiDateRow"><div><b>{trDate(date)}</b><small>{changed?"Onaya eklendi":status?`Mevcut: ${STATUS_LABEL[status]}`:"Henüz kayıt yok"}</small></div><StatusButtons status={status} changed={changed} onStatus={onStatus} onClear={onClear}/></div>}
function StatusButtons({status,changed,onStatus,onClear}:{status?:Status;changed:boolean;onStatus:(s:Status)=>void;onClear:()=>void}){return <div className="haiStatusButtons"><button type="button" className={status==="present"?"present active":"present"} onClick={()=>onStatus("present")}>✓ Geldi</button><button type="button" className={status==="absent"?"absent active":"absent"} onClick={()=>onStatus("absent")}>✕ Gelmedi</button><button type="button" className={status==="excused"?"excused active":"excused"} onClick={()=>onStatus("excused")}>○ İzinli</button>{changed&&<button type="button" className="clear" onClick={onClear}>Geri Al</button>}</div>}

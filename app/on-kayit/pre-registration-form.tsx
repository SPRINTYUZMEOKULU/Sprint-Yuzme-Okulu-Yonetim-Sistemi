"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Branch={id:string;name:string};
type Group={id:string;branch_id:string;level_id:string|null;name:string;capacity:number;course_type:string;description:string|null;sort_order:number};
type Schedule={id:string;group_id:string;weekday:number;start_time:string;end_time:string};
type Package={id:string;name:string;lesson_count:number;price:number};
type Level={id:string;name:string;sort_order:number};
type Options={branches:Branch[];groups:Group[];schedules:Schedule[];packages:Package[];levels:Level[]};
const days=["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];

export default function PreRegistrationForm() {
  const [status,setStatus]=useState<"idle"|"sending"|"success"|"error">("idle");
  const [message,setMessage]=useState("");
  const [options,setOptions]=useState<Options>({branches:[],groups:[],schedules:[],packages:[],levels:[]});
  const [loading,setLoading]=useState(true);
  const [courseType,setCourseType]=useState("");
  const [branchId,setBranchId]=useState("");
  const [groupId,setGroupId]=useState("");

  useEffect(()=>{fetch("/api/public-registration-options",{cache:"no-store"}).then(r=>r.json()).then(data=>{if(data.error) throw new Error(data.error);setOptions(data);}).catch(()=>setMessage("Grup ve saat seçenekleri yüklenemedi. Lütfen daha sonra tekrar deneyin.")).finally(()=>setLoading(false));},[]);

  const courseTypes=useMemo(()=>Array.from(new Set(options.groups.map(g=>g.course_type))),[options.groups]);
  const availableBranches=useMemo(()=>options.branches.filter(b=>options.groups.some(g=>g.branch_id===b.id&&(!courseType||g.course_type===courseType))),[options,courseType]);
  const availableGroups=useMemo(()=>options.groups.filter(g=>(!courseType||g.course_type===courseType)&&(!branchId||g.branch_id===branchId)),[options,courseType,branchId]);
  const selectedGroup=options.groups.find(g=>g.id===groupId);
  const selectedSchedules=options.schedules.filter(s=>s.group_id===groupId);
  const selectedLevel=selectedGroup?.level_id?options.levels.find(l=>l.id===selectedGroup.level_id):null;

  function groupLabel(group:Group){const schedules=options.schedules.filter(s=>s.group_id===group.id);const dayText=Array.from(new Set(schedules.map(s=>days[s.weekday]))).join(" – ");const time=schedules[0]?`${schedules[0].start_time.slice(0,5)}–${schedules[0].end_time.slice(0,5)}`:"Saat tanımlanmadı";return `${group.name} · ${dayText} · ${time}`;}

  async function handleSubmit(event:FormEvent<HTMLFormElement>){event.preventDefault();setStatus("sending");setMessage("");const formElement=event.currentTarget;const payload=Object.fromEntries(new FormData(formElement).entries());try{const response=await fetch("/api/pre-registrations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||"Kayıt oluşturulamadı.");setStatus("success");setMessage("Ön kaydınız başarıyla alınmıştır. Kayıt ekibimiz en kısa sürede sizinle iletişime geçecektir.");formElement.reset();setCourseType("");setBranchId("");setGroupId("");}catch(error){setStatus("error");setMessage(error instanceof Error?error.message:"Bir hata oluştu.");}}

  return <form className="registrationForm" onSubmit={handleSubmit}>
    <input className="hiddenField" type="text" name="website" tabIndex={-1} autoComplete="off"/>
    <section className="formSection"><div className="formSectionTitle"><b>1</b><div><strong>Öğrenci ve veli bilgileri</strong><span>İletişim kurabilmemiz için temel bilgiler</span></div></div><div className="formGrid">
      <label>Öğrenci adı<input name="firstName" required maxLength={60} placeholder="Adı"/></label><label>Öğrenci soyadı<input name="lastName" required maxLength={60} placeholder="Soyadı"/></label><label>Doğum tarihi<input name="birthDate" type="date"/></label><label>Veli adı soyadı<input name="guardianName" required maxLength={120} placeholder="Veli adı soyadı"/></label><label>Telefon<input name="phone" type="tel" required placeholder="05xx xxx xx xx" maxLength={20}/></label><label>E-posta<input name="email" type="email" maxLength={160} placeholder="ornek@email.com"/></label>
    </div></section>
    <section className="formSection"><div className="formSectionTitle"><b>2</b><div><strong>Kurs, grup ve paket tercihi</strong><span>Panelde açılmış aktif gruplar otomatik olarak burada görünür</span></div></div>
      {loading?<div className="optionsLoading">Aktif gruplar yükleniyor…</div>:<div className="formGrid">
        <label>Kurs türü<select name="courseType" required value={courseType} onChange={e=>{setCourseType(e.target.value);setBranchId("");setGroupId("");}}><option value="" disabled>Seçiniz</option>{courseTypes.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Şube<select name="branchId" required value={branchId} onChange={e=>{setBranchId(e.target.value);setGroupId("");}}><option value="" disabled>Şube seçin</option>{availableBranches.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
        <label className="wideGroupSelect">Aktif grup, gün ve saat<select name="groupId" required value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="" disabled>Grup seçin</option>{availableGroups.map(x=><option value={x.id} key={x.id}>{groupLabel(x)}</option>)}</select></label>
        <label>Yüzme seviyesi<select name="swimmingLevel" defaultValue=""><option value="">Seçiniz</option>{options.levels.map(x=><option key={x.id}>{x.name}</option>)}<option>Bilmiyorum</option></select></label>
        <label>Paket tercihi<select name="packageId" required defaultValue=""><option value="" disabled>Paket seçin</option>{options.packages.map(x=><option value={x.id} key={x.id}>{x.name} · {x.lesson_count} ders{x.price?` · ${Number(x.price).toLocaleString("tr-TR")} ₺`:""}</option>)}</select></label>
      </div>}
      {selectedGroup?<div className="selectedGroupCard"><div><span>SEÇİLEN GRUP</span><strong>{selectedGroup.name}</strong><small>{options.branches.find(b=>b.id===selectedGroup.branch_id)?.name} · {selectedGroup.course_type}</small></div><div className="selectedSchedule">{selectedSchedules.map(s=><span key={s.id}><b>{days[s.weekday]}</b>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</span>)}</div><div className="selectedMeta"><span>Kontenjan: <b>{selectedGroup.capacity} kişi</b></span><span>Seviye: <b>{selectedLevel?.name||"Tüm seviyeler"}</b></span></div>{selectedGroup.description?<p>{selectedGroup.description}</p>:null}<input type="hidden" name="branchName" value={options.branches.find(b=>b.id===selectedGroup.branch_id)?.name||""}/><input type="hidden" name="preferredDays" value={selectedSchedules.map(s=>days[s.weekday]).join(" - ")}/><input type="hidden" name="preferredTime" value={selectedSchedules[0]?`${selectedSchedules[0].start_time.slice(0,5)} - ${selectedSchedules[0].end_time.slice(0,5)}`:""}/></div>:null}
      {!loading&&!options.groups.length?<div className="noGroupWarning">Şu anda ön kayda açık grup bulunmuyor. Kayıt ekibimizle iletişime geçebilirsiniz.</div>:null}
    </section>
    <section className="formSection"><div className="formSectionTitle"><b>3</b><div><strong>Ek bilgiler</strong><span>Özel durum ve beklentilerinizi paylaşabilirsiniz</span></div></div><label className="fullWidth">Açıklama / özel durum<textarea name="note" rows={4} maxLength={1000} placeholder="Su korkusu, sağlık bilgisi veya eklemek istediğiniz not..."/></label></section>
    <label className="consent"><input type="checkbox" name="whatsappPermission" value="true" required/><span>İletişim ve kayıt bilgilendirmelerinin WhatsApp üzerinden gönderilmesini ve başvuru bilgilerimin kayıt süreci kapsamında işlenmesini kabul ediyorum.</span></label>
    <div className="submitRow"><button className="submitButton" disabled={status==="sending"||loading||!options.groups.length} type="submit">{status==="sending"?"Başvurunuz gönderiliyor...":"Ön Kaydı Tamamla"}</button></div>{message&&<p className={status==="success"?"formMessage success":"formMessage error"}>{message}</p>}
  </form>;
}

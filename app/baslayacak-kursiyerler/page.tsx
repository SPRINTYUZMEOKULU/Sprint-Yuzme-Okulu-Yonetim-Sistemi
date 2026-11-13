import {awaitingEnrollmentStart,nextRegisteredLesson} from "@/lib/enrollment/starting";
import { formatDisplayDate } from "@/lib/dates/display";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import "../dashboard.css";
import "./starting-center.css";

export const dynamic = "force-dynamic";

type StudentRow={id:string;student_number:string|null;first_name:string|null;last_name:string|null;phone:string|null;guardian_name:string|null;guardian_phone:string|null};
type EnrollmentRow={id:string;status:string;lesson_weekdays:number[]|null;student_id:string;group_id:string|null;branch_id:string|null;start_date:string|null;created_at:string|null;start_confirmation_required:boolean|null;actual_started_at:string|null};
type BranchRow={id:string;name:string|null};
type GroupRow={id:string;name:string|null;branch_id:string|null};
type ScheduleRow={id:string;group_id:string|null;weekday:number|null;start_time:string|null;end_time:string|null};
type StartingStudent={student:StudentRow;enrollment:EnrollmentRow;group:GroupRow|null;branchName:string;nextLesson:{date:string;startTime:string;endTime:string;scheduleId:string}|null};
type FilterKey="today"|"tomorrow"|"week"|"all";

function trToday(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const get=(type:string)=>parts.find(p=>p.type===type)?.value||"";return `${get("year")}-${get("month")}-${get("day")}`;}
function addDays(date:string,days:number){const d=new Date(`${date}T12:00:00+03:00`);d.setDate(d.getDate()+days);return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
function isoWeekday(date:string){const n=new Date(`${date}T12:00:00+03:00`).getDay();return n===0?7:n;}
function formatDate(date:string){return formatDisplayDate(new Date(`${date}T12:00:00+03:00`));}

export default async function StartingStudentsPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const params=searchParams?await searchParams:{};
  const requested=String(params?.filter||"all");
  const activeFilter:FilterKey=requested==="today"||requested==="tomorrow"||requested==="week"?requested:"all";
  const activeTime=typeof params?.time==="string"?params.time:null;

  const profile=await requireProfile(["owner","admin","branch_manager","registration_staff","accounting","coach"]);
  const supabase=await createClient();
  const organizationId=profile.organization_id;
  const today=trToday();
  const tomorrow=addDays(today,1);
  const weekEnd=addDays(today,7);

  const [studentsResult,enrollmentsResult,attendanceResult,transferStartedResult,branchesResult,groupsResult,schedulesResult]=await Promise.all([
    supabase.from("students").select("id,student_number,first_name,last_name,phone,guardian_name,guardian_phone").eq("organization_id",organizationId).eq("status","active").eq("is_deleted",false),
    supabase.from("student_enrollments").select("id,status,lesson_weekdays,student_id,group_id,branch_id,start_date,created_at,start_confirmation_required,actual_started_at").eq("organization_id",organizationId).in("status",["active","scheduled"]).order("created_at",{ascending:false}),
    supabase.from("attendance_records").select("student_id,enrollment_id,lesson_date,status").eq("organization_id",organizationId).in("status",["present","absent","excused"]),
    supabase.from("student_activity_logs").select("student_id").eq("organization_id",organizationId).eq("activity_type","legacy_transfer_manager_confirmed"),
    supabase.from("branches").select("id,name").eq("organization_id",organizationId),
    supabase.from("training_groups").select("id,name,branch_id").eq("organization_id",organizationId),
    supabase.from("lesson_schedules").select("id,group_id,weekday,start_time,end_time").eq("organization_id",organizationId).eq("is_active",true),
  ]);

  const queryError=studentsResult.error||enrollmentsResult.error||attendanceResult.error||transferStartedResult.error||branchesResult.error||groupsResult.error||schedulesResult.error;
  if(queryError)throw new Error(`Başlayacak kursiyerler yüklenemedi: ${queryError.message}`);


  const transferStarted=new Set((transferStartedResult.data||[]).map((r:any)=>String(r.student_id)).filter(Boolean));
  const enrollmentMap=new Map<string,EnrollmentRow>();
  for(const row of (enrollmentsResult.data||[]) as EnrollmentRow[])if(row.student_id&&!enrollmentMap.has(String(row.student_id)))enrollmentMap.set(String(row.student_id),row);
  const branchMap=new Map<string,string>(((branchesResult.data||[]) as BranchRow[]).map(b=>[String(b.id),b.name||"Şube"]));
  const groupMap=new Map<string,GroupRow>(((groupsResult.data||[]) as GroupRow[]).map(g=>[String(g.id),g]));
  const schedulesByGroup=new Map<string,ScheduleRow[]>();
  for(const s of (schedulesResult.data||[]) as ScheduleRow[]){const id=String(s.group_id||"");if(!id)continue;const rows=schedulesByGroup.get(id)||[];rows.push(s);schedulesByGroup.set(id,rows);}



  const starting:StartingStudent[]=((studentsResult.data||[]) as StudentRow[]).flatMap(student=>{const id=String(student.id);const enrollment=enrollmentMap.get(id);if(!enrollment||!awaitingEnrollmentStart(enrollment,today,(attendanceResult.data||[]).filter((row:any)=>row.student_id===id),transferStarted.has(id)))return[];const group=groupMap.get(String(enrollment.group_id||""))||null;const branchName=branchMap.get(String(group?.branch_id||enrollment.branch_id||""))||"Şube belirtilmemiş";return[{student,enrollment,group,branchName,nextLesson:nextRegisteredLesson(schedulesByGroup.get(String(enrollment!.group_id||""))||[],enrollment!.start_date,today,enrollment!.lesson_weekdays)}];}).sort((a,b)=>{const ad=a.nextLesson?.date||"9999-12-31";const bd=b.nextLesson?.date||"9999-12-31";if(ad!==bd)return ad.localeCompare(bd);return String(a.nextLesson?.startTime||"").localeCompare(String(b.nextLesson?.startTime||""));});

  const todayStudents=starting.filter(x=>x.nextLesson?.date===today);
  const tomorrowStudents=starting.filter(x=>x.nextLesson?.date===tomorrow);
  const comingStudents=starting.filter(x=>x.nextLesson&&x.nextLesson.date>tomorrow&&x.nextLesson.date<=weekEnd);
  const laterStudents=starting.filter(x=>x.nextLesson&&x.nextLesson.date>weekEnd);
  const unscheduledStudents=starting.filter(x=>!x.nextLesson);
  const todaySlots=new Map<string,number>();
  for(const item of todayStudents){const time=item.nextLesson?.startTime||"Saat yok";todaySlots.set(time,(todaySlots.get(time)||0)+1);}
  const filteredToday=activeFilter==="today"&&activeTime?todayStudents.filter(x=>x.nextLesson?.startTime===activeTime):todayStudents;

  function StudentCard({item}:{item:StartingStudent}){
    const s=item.student;
    const branch=item.branchName;
    const fullGroup=item.group?.name||"Grup belirtilmemiş";
    const groupTail=fullGroup.toLocaleLowerCase("tr-TR").startsWith(branch.toLocaleLowerCase("tr-TR"))?fullGroup.slice(branch.length):null;
    const groupLabel=groupTail!==null&&(!groupTail||/^[\s·|:—–-]/.test(groupTail))?groupTail.replace(/^[\s·|:—–-]+/,"")||"Grup programı":fullGroup;
    const phone=s.guardian_phone||s.phone||"";
    const digits=phone.replace(/\D/g,"");
    const dial=digits.length===12&&digits.startsWith("90")?`+${digits}`:digits.length===10?`+90${digits}`:digits.length===11&&digits.startsWith("0")?`+90${digits.slice(1)}`:phone.startsWith("+")?`+${digits}`:digits;
    const future=Boolean(item.nextLesson&&item.nextLesson.date>today);
    return <article className="startingStudentCard" data-first-lesson-date={item.nextLesson?.date}>
      <div className="startingStudentMain">
        <div className="studentTopLine"><small>{s.student_number||"Kursiyer"}</small>{item.nextLesson?<span className="lessonBadge">{item.nextLesson.startTime}</span>:<span className="lessonBadge warningBadge">Program bekleniyor</span>}</div>
        <h3>{s.first_name} {s.last_name}</h3>
        {item.enrollment.status==="scheduled"&&<p className="startingRenewal"><b>Kayıt yenilendi · Yeni dönem başlangıcı: {item.enrollment.start_date?formatDate(item.enrollment.start_date):"—"}</b></p>}
        <div className="startingProgramInfo"><span className="startingBranch">{branch}</span><p className="studentProgram">{groupLabel}</p></div>
        {item.nextLesson?<div className="lessonDate"><span>İlk ders</span><strong>{formatDate(item.nextLesson.date)}</strong><span>{item.nextLesson.startTime}{item.nextLesson.endTime?`–${item.nextLesson.endTime}`:""}</span></div>:null}
        <div className="guardianLine"><span>{s.guardian_name?`Veli: ${s.guardian_name}`:"İletişim"}</span>{digits?<a href={`tel:${dial}`}>{phone}</a>:<span>Telefon belirtilmemiş</span>}</div>
      </div>
      {future?<div className="futureStartNotice"><span aria-hidden="true">◷</span><div><strong>İlk ders planlandı</strong><small>{formatDate(item.nextLesson!.date)} · {item.nextLesson!.date===tomorrow?"Yarın":"Başlangıç tarihi bekleniyor"}</small></div></div>:!item.nextLesson?<div className="futureStartNotice"><span aria-hidden="true">!</span><div><strong>Ders programı kontrol edilmeli</strong><small>İlk ders için uygun seans bulunamadı.</small></div></div>:null}
      <div className="startingStudentActions"><Link className="primaryAction" href={`/ogrenciler/${s.id}`}>Öğrenci Dosyası</Link>{item.nextLesson?<Link href={`/yoklama?${new URLSearchParams({date:item.nextLesson.date,branchId:item.group?.branch_id||item.enrollment.branch_id||"",time:item.nextLesson.startTime,scheduleId:item.nextLesson.scheduleId}).toString()}`}>Yoklamaya Git</Link>:<span className="startingDisabledAction" aria-disabled="true">Önce program tanımlayın</span>}</div>
    </article>;
  }
  function StudentSection({title,subtitle,items,accent=false}:{title:string;subtitle:string;items:StartingStudent[];accent?:boolean}){return <section className={`startingGroup ${accent?"startingGroupToday":""}`}><div className="startingGroupHead"><div><p>{subtitle}</p><h2>{title}</h2></div><strong>{items.length}</strong></div>{items.length?<div className="startingStudentGrid">{items.map(item=><StudentCard key={item.student.id} item={item}/>)}</div>:<div className="tableEmpty">Bu filtrede kursiyer bulunmuyor.</div>}</section>}
  const filterHref=(filter:FilterKey,time?:string)=>`/baslayacak-kursiyerler?filter=${filter}${time?`&time=${encodeURIComponent(time)}`:""}#kursiyer-listesi`;

  return <main className="operationPage startingPage"><header className="operationHeader"><div><p>SPRİNTOS · ÖĞRENCİ YÖNETİMİ</p><h1>Başlayacak Kursiyerler</h1><span>İlk dersini bekleyen kursiyerleri tarih ve seans saatine göre takip edin.</span></div><div className="operationActions"><Link href="/ogrenciler">Öğrenci Merkezi</Link><Link href="/yoklama">Yoklama</Link></div></header><section className="startingOverview" aria-label="Başlangıç filtreleri"><Link href={filterHref("today")} className={`overviewPrimary overviewLink ${activeFilter==="today"&&!activeTime?"isActive":""}`}><span>BUGÜN</span><strong>{todayStudents.length}</strong><p>kursiyer ilk dersine başlayacak</p><em>Listeyi göster →</em></Link><Link href={filterHref("tomorrow")} className={`overviewCard overviewLink ${activeFilter==="tomorrow"?"isActive":""}`}><span>YARIN</span><strong>{tomorrowStudents.length}</strong><p>kursiyer</p><em>Filtrele →</em></Link><Link href={filterHref("week")} className={`overviewCard overviewLink ${activeFilter==="week"?"isActive":""}`}><span>7 GÜN İÇİNDE</span><strong>{comingStudents.length}</strong><p>kursiyer</p><em>Filtrele →</em></Link><Link href={filterHref("all")} className={`overviewCard overviewLink ${activeFilter==="all"?"isActive":""}`}><span>TOPLAM BEKLEYEN</span><strong>{starting.length}</strong><p>kursiyer</p><em>Tümünü göster →</em></Link></section>{todayStudents.length?<section className="todayAlertCard"><div><span className="todayAlertIcon">↗</span><div><b>Bugünün başlangıç planı hazır</b><p>Seans saatine dokunarak yalnızca o saatte başlayacak kursiyerleri görüntüleyebilirsiniz.</p></div></div><div className="slotPills">{[...todaySlots.entries()].map(([time,count])=><Link className={activeFilter==="today"&&activeTime===time?"activeSlot":""} href={filterHref("today",time)} key={time}>{time} · {count} kursiyer</Link>)}</div></section>:null}<div id="kursiyer-listesi" className="filterResultBar"><div><span>AKTİF FİLTRE</span><b>{activeFilter==="today"?(activeTime?`Bugün · ${activeTime}`:"Bugün başlayacaklar"):activeFilter==="tomorrow"?"Yarın başlayacaklar":activeFilter==="week"?"Önümüzdeki 7 gün":"Tüm başlayacak kursiyerler"}</b></div>{activeFilter!=="all"||activeTime?<Link href={filterHref("all")}>Filtreyi temizle</Link>:null}</div><div className="startingSections">{activeFilter==="today"?<StudentSection title={activeTime?`Bugün ${activeTime} Seansı`:"Bugün Başlayacaklar"} subtitle="ÖNCELİKLİ TAKİP" items={filteredToday} accent/>:null}{activeFilter==="tomorrow"?<StudentSection title="Yarın Başlayacaklar" subtitle="YARIN" items={tomorrowStudents} accent/>:null}{activeFilter==="week"?<StudentSection title="Önümüzdeki 7 Gün" subtitle="YAKLAŞAN BAŞLANGIÇLAR" items={comingStudents} accent/>:null}{activeFilter==="all"?<><StudentSection title="Bugün Başlayacaklar" subtitle="ÖNCELİKLİ TAKİP" items={todayStudents} accent/><StudentSection title="Yarın Başlayacaklar" subtitle="YARIN" items={tomorrowStudents}/><StudentSection title="Önümüzdeki 7 Gün" subtitle="YAKLAŞAN BAŞLANGIÇLAR" items={comingStudents}/>{laterStudents.length||unscheduledStudents.length?<details className="laterDetails"><summary>Diğer Zamanlar <span>{laterStudents.length+unscheduledStudents.length}</span></summary><div className="laterContent">{laterStudents.length?<StudentSection title="Daha Sonra Başlayacaklar" subtitle="İLERİ TARİH" items={laterStudents}/>:null}{unscheduledStudents.length?<StudentSection title="Programı Eksik Kursiyerler" subtitle="KONTROL GEREKİYOR" items={unscheduledStudents}/>:null}</div></details>:null}</>:null}</div></main>;
}

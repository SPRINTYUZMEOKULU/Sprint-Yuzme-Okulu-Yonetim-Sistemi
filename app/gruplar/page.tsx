import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createGroup, toggleGroup } from "./actions";
import "./groups.css";

export const dynamic = "force-dynamic";
const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export default async function GroupsPage() {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const supabase = await createClient();
  const org = profile.organization_id || "";
  const [{ data: branches }, { data: levels }, { data: groups }, { data: schedules }] = await Promise.all([
    supabase.from("branches").select("id,name").eq("organization_id", org).eq("is_active", true).order("name"),
    supabase.from("swimming_levels").select("id,name").eq("organization_id", org).eq("is_active", true).order("sort_order"),
    supabase.from("training_groups").select("id,branch_id,level_id,name,capacity,course_type,description,is_active,public_registration").eq("organization_id", org).order("created_at", { ascending: false }),
    supabase.from("lesson_schedules").select("group_id,weekday,start_time,end_time").eq("organization_id", org).eq("is_active", true).order("weekday").order("start_time")
  ]);
  const branchMap = new Map((branches || []).map((x) => [x.id, x.name]));
  const levelMap = new Map((levels || []).map((x) => [x.id, x.name]));
  const scheduleMap = new Map<string, typeof schedules>();
  for (const item of schedules || []) scheduleMap.set(item.group_id, [...(scheduleMap.get(item.group_id) || []), item]);

  return <main className="groupsPage">
    <header className="groupsHeader"><div><p>SPRİNTOS · EĞİTİM YAPISI</p><h1>Gruplar ve Saatler</h1><span>Burada oluşturduğunuz aktif gruplar, günler ve saatler ön kayıt formuna otomatik yansır.</span></div><div><Link href="/">Dashboard</Link><Link href="/on-kayit" target="_blank">Ön Kayıt Formunu Aç</Link></div></header>

    <section className="groupLayout">
      <form action={createGroup} className="groupForm">
        <div className="sectionHead"><p>YENİ GRUP</p><h2>Grup Oluştur</h2><span>Şube, gün ve saat bilgilerini bir kez girin; sistemin gereken tüm alanlarında kullanılsın.</span></div>
        <div className="formGrid">
          <label>Grup adı<input name="name" required placeholder="Örn. Hafta Sonu 10.00 Çocuk" /></label>
          <label>Kurs türü<select name="course_type" defaultValue="Çocuk Yüzme Kursu"><option>Çocuk Yüzme Kursu</option><option>Yetişkin Yüzme Kursu</option><option>Özel Ders</option><option>Takım / Performans</option></select></label>
          <label>Şube<select name="branch_id" required defaultValue=""><option value="" disabled>Şube seçin</option>{(branches || []).map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
          <label>Seviye<select name="level_id" defaultValue=""><option value="">Tüm seviyeler</option>{(levels || []).map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
          <label>Başlangıç saati<input type="time" name="start_time" required /></label>
          <label>Bitiş saati<input type="time" name="end_time" required /></label>
          <label>Kontenjan<input type="number" name="capacity" min="1" max="50" defaultValue="6" required /></label>
          <label className="wide">Açıklama<input name="description" placeholder="Örn. 5–8 yaş başlangıç seviyesi" /></label>
        </div>
        <fieldset className="weekdayField"><legend>Ders günleri</legend>{dayNames.map((day, index) => <label key={day}><input type="checkbox" name="weekdays" value={index}/><span>{day}</span></label>)}</fieldset>
        <label className="publishToggle"><input type="checkbox" name="public_registration" defaultChecked/><span><strong>Ön kayıt formunda göster</strong><small>Kapalı olursa grup panelde kalır fakat veliler göremez.</small></span></label>
        <button className="primaryButton" type="submit">Grubu Oluştur ve Yayınla</button>
      </form>

      <section className="groupListCard">
        <div className="sectionHead"><p>AKTİF YAPI</p><h2>Tanımlı Gruplar</h2><span>{(groups || []).length} grup bulunuyor.</span></div>
        <div className="groupCards">{(groups || []).map((group) => {
          const groupSchedules = scheduleMap.get(group.id) || [];
          return <article className={!group.is_active ? "groupCard passive" : "groupCard"} key={group.id}>
            <div className="groupTop"><div><span className="coursePill">{group.course_type}</span><h3>{group.name}</h3><p>{branchMap.get(group.branch_id) || "Şube"} · {group.level_id ? levelMap.get(group.level_id) : "Tüm seviyeler"}</p></div><strong>{group.capacity} kişilik</strong></div>
            <div className="scheduleTags">{groupSchedules.map((s, i) => <span key={`${s.weekday}-${i}`}><b>{dayNames[s.weekday]}</b>{String(s.start_time).slice(0,5)}–{String(s.end_time).slice(0,5)}</span>)}</div>
            {group.description ? <p className="groupDesc">{group.description}</p> : null}
            <div className="groupActions">
              <form action={toggleGroup}><input type="hidden" name="id" value={group.id}/><input type="hidden" name="field" value="public_registration"/><input type="hidden" name="value" value={String(!group.public_registration)}/><button className={group.public_registration ? "publicOn" : "publicOff"}>{group.public_registration ? "Formda Görünüyor" : "Formda Gizli"}</button></form>
              <form action={toggleGroup}><input type="hidden" name="id" value={group.id}/><input type="hidden" name="field" value="is_active"/><input type="hidden" name="value" value={String(!group.is_active)}/><button>{group.is_active ? "Pasife Al" : "Aktifleştir"}</button></form>
            </div>
          </article>;
        })}{!(groups || []).length ? <div className="emptyGroups"><strong>Henüz grup oluşturulmadı.</strong><span>Soldaki formdan ilk grubunuzu tanımlayın.</span></div> : null}</div>
      </section>
    </section>
  </main>;
}

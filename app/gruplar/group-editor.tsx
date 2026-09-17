"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { updateGroupMulti } from "./update-group-multi";

type OptionItem = { id: string; name: string };
type CoachItem = { id: string; full_name: string | null };
type ScheduleItem = { weekday: number; start_time: string; end_time: string };
type GroupItem = { id: string; branch_id: string; level_id: string | null; name: string; capacity: number; course_type: string; description: string | null; primary_coach_id: string | null; public_registration: boolean };
type Props = { group: GroupItem; schedules: ScheduleItem[]; branches: OptionItem[]; levels: OptionItem[]; coaches: CoachItem[] };

const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const courseTypes = ["Çocuk Yüzme Kursu", "Yetişkin Yüzme Kursu", "Özel Ders", "Takım / Performans"];

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="editorSaveButton" disabled={pending}>{pending ? "Değişiklikler kaydediliyor..." : "Değişiklikleri Kaydet"}</button>;
}

export default function GroupEditor({ group, schedules, branches, levels, coaches }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstSchedule = schedules[0];
  const selectedWeekdays = new Set(schedules.map((s) => s.weekday));
  const close = () => dialogRef.current?.close();

  return <>
    <button type="button" className="editGroupButton" onClick={() => dialogRef.current?.showModal()}>Düzenle</button>
    <dialog ref={dialogRef} className="groupEditorDialog" onClick={(e) => e.target === e.currentTarget && close()}>
      <form action={updateGroupMulti} className="groupEditorForm">
        <input type="hidden" name="group_id" value={group.id} />
        <header className="groupEditorHeader"><div><span>EĞİTİM GRUBU DÜZENLEME</span><h2>{group.name}</h2><p>Aynı seansa birden fazla kurs programı ekleyebilirsiniz.</p></div><button type="button" className="groupEditorClose" onClick={close} aria-label="Pencereyi kapat">×</button></header>
        <div className="groupEditorBody">
          <fieldset className="courseTypeField"><legend>Kurs programları <small>Birden fazla seçebilirsiniz</small></legend><div className="courseTypeGrid">
            {courseTypes.map((type) => <label key={type} className={type === group.course_type ? "currentType" : ""}><input type="checkbox" name="course_types" value={type} defaultChecked={type === group.course_type} disabled={type === group.course_type} /><span><b>{type}</b>{type === group.course_type && <em>Mevcut grup</em>}</span>{type === group.course_type && <input type="hidden" name="course_types" value={type} />}</label>)}
          </div><p className="courseHelp">Örneğin Çocuk + Yetişkin seçildiğinde aynı gün ve saatte iki ayrı eğitim grubu oluşur. Öğrenci kayıtları ve kontenjanlar birbirinden ayrı takip edilir.</p></fieldset>

          <div className="editorGrid">
            <label>Şube<select name="branch_id" defaultValue={group.branch_id} required>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label>Seviye<select name="level_id" defaultValue={group.level_id || ""}><option value="">Tüm seviyeler</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
            <label>Ana eğitmen<select name="primary_coach_id" defaultValue={group.primary_coach_id || ""}><option value="">Eğitmen seçilmedi</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name || "İsimsiz eğitmen"}</option>)}</select></label>
            <label>Kontenjan<input type="number" name="capacity" min="1" max="50" defaultValue={group.capacity} required /></label>
            <label>Başlangıç saati<input type="time" name="start_time" defaultValue={firstSchedule ? String(firstSchedule.start_time).slice(0, 5) : ""} required /></label>
            <label>Bitiş saati<input type="time" name="end_time" defaultValue={firstSchedule ? String(firstSchedule.end_time).slice(0, 5) : ""} required /></label>
            <label className="editorWide">Açıklama<textarea name="description" rows={3} defaultValue={group.description || ""} /></label>
          </div>

          <fieldset className="editorWeekdays"><legend>Ders günleri</legend>{dayNames.map((day, i) => <label key={day}><input type="checkbox" name="weekdays" value={i} defaultChecked={selectedWeekdays.has(i)} /><span>{day}</span></label>)}</fieldset>
          <label className="editorPublishToggle"><input type="checkbox" name="public_registration" defaultChecked={group.public_registration} /><span><strong>Ön kayıt formunda göster</strong><small>Seçilen tüm kurs programları ön kayıt seçeneklerine eklenir.</small></span></label>
        </div>
        <footer className="groupEditorFooter"><button type="button" className="editorCancelButton" onClick={close}>Vazgeç</button><SaveButton /></footer>
      </form>
    </dialog>

    <style jsx global>{`
      .groupEditorDialog{width:min(760px,calc(100vw - 28px));max-height:calc(100dvh - 28px);margin:auto;padding:0;overflow:hidden;border:0;border-radius:23px;background:#fff;color:#10213f;box-shadow:0 30px 90px rgba(3,19,45,.32)}
      .groupEditorDialog::backdrop{background:rgba(3,15,35,.66);backdrop-filter:blur(5px)}.groupEditorForm{max-height:calc(100dvh - 28px);display:flex;flex-direction:column}.groupEditorHeader{display:flex;justify-content:space-between;gap:20px;padding:23px 25px;background:linear-gradient(135deg,#082a58,#0d6bca);color:#fff}.groupEditorHeader span{color:#8ec5ff;font-size:10px;font-weight:950;letter-spacing:.14em}.groupEditorHeader h2{margin:7px 0 4px;font-size:23px}.groupEditorHeader p{margin:0;color:#d9eaff;font-size:12px}.groupEditorClose{width:40px;height:40px;border:1px solid rgba(255,255,255,.25);border-radius:12px;background:rgba(255,255,255,.13);color:#fff;font-size:27px}.groupEditorBody{padding:23px 25px;overflow-y:auto}
      .courseTypeField{margin:0 0 20px;padding:0;border:0}.courseTypeField legend{width:100%;margin-bottom:10px;color:#42536f;font-size:12px;font-weight:900}.courseTypeField legend small{margin-left:7px;color:#71809a;font-weight:700}.courseTypeGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.courseTypeGrid>label{display:flex;align-items:center;gap:10px;min-height:58px;padding:11px 12px;border:1px solid #d8e2ef;border-radius:13px;background:#fbfcff;cursor:pointer}.courseTypeGrid>label:has(input:checked){border-color:#1769e8;background:#eef6ff;box-shadow:0 0 0 2px rgba(23,105,232,.08)}.courseTypeGrid input[type=checkbox]{width:19px;height:19px;accent-color:#1769e8}.courseTypeGrid span{display:flex;flex-direction:column;gap:2px}.courseTypeGrid b{font-size:12px}.courseTypeGrid em{color:#1769e8;font-size:10px;font-style:normal;font-weight:850}.courseHelp{margin:9px 2px 0;color:#71809a;font-size:10px;line-height:1.45}
      .editorGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.editorGrid label{color:#42536f;font-size:12px;font-weight:850}.editorGrid input,.editorGrid select,.editorGrid textarea{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:12px;border:1px solid #d8e2ef;border-radius:12px;outline:none;background:#fbfcff;color:#13233f;font:inherit}.editorGrid input,.editorGrid select{min-height:46px}.editorWide{grid-column:1/-1}.editorWeekdays{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0;padding:0;border:0}.editorWeekdays legend{width:100%;margin-bottom:9px;color:#42536f;font-size:12px;font-weight:900}.editorWeekdays input{display:none}.editorWeekdays span{display:block;padding:9px 11px;border:1px solid #dbe4f0;border-radius:9px;color:#344765;font-size:11px;font-weight:850}.editorWeekdays input:checked+span{border-color:#1769e8;background:#1769e8;color:#fff}.editorPublishToggle{display:flex;gap:11px;padding:13px;border:1px solid #d6e7fd;border-radius:13px;background:#f2f7ff}.editorPublishToggle input{width:18px;height:18px;accent-color:#1769e8}.editorPublishToggle span{display:flex;flex-direction:column}.editorPublishToggle small{margin-top:3px;color:#71809a}.groupEditorFooter{display:flex;justify-content:flex-end;gap:10px;padding:16px 25px;border-top:1px solid #e7edf5;background:#f8fafd}.groupEditorFooter button{min-height:44px;padding:11px 17px;border-radius:11px;font-weight:900}.editorCancelButton{border:1px solid #d7e0ec;background:#fff;color:#344765}.editorSaveButton{border:0;background:linear-gradient(135deg,#1774f0,#0754c6);color:#fff}.editGroupButton{min-height:38px;padding:8px 12px;border:1px solid #b9d2f6;border-radius:10px;background:#edf5ff;color:#1769e8;font-size:11px;font-weight:900}
      @media(max-width:620px){.groupEditorDialog{width:calc(100vw - 20px);max-height:calc(100dvh - 20px)}.groupEditorHeader{padding:20px}.groupEditorHeader h2{font-size:21px}.groupEditorBody{padding:18px}.courseTypeGrid,.editorGrid{grid-template-columns:1fr}.editorWide{grid-column:auto}.groupEditorFooter{padding:14px 18px}.groupEditorFooter button{flex:1}}
    `}</style>
  </>;
}

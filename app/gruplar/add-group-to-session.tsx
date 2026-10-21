"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { createGroup } from "./actions";

type LevelItem = { id: string; name: string };

type Props = {
  branchId: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  defaultCourseType: string;
  levels: LevelItem[];
};

const dayNames = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
const courseTypes = ["Çocuk Yüzme Kursu","Yetişkin Yüzme Kursu","Özel Ders","Takım / Performans"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="sessionAddGroupSave" disabled={pending}>
      {pending ? "Grup ekleniyor..." : "Grubu Ekle"}
    </button>
  );
}

export default function AddGroupToSession({
  branchId,
  weekdays,
  startTime,
  endTime,
  defaultCourseType,
  levels,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" className="sessionAddGroupButton" onClick={() => dialogRef.current?.showModal()}>
        <span aria-hidden="true">＋</span>
        Grup Ekle
      </button>

      <dialog
        ref={dialogRef}
        className="sessionAddGroupDialog"
        onClick={(event) => event.target === event.currentTarget && close()}
      >
        <form action={createGroup} className="sessionAddGroupForm">
          <input type="hidden" name="branch_id" value={branchId} />
          <input type="hidden" name="start_time" value={startTime} />
          <input type="hidden" name="end_time" value={endTime} />
          {weekdays.map((weekday) => (
            <input key={weekday} type="hidden" name="weekdays" value={weekday} />
          ))}

          <header className="sessionAddGroupHeader">
            <div>
              <span>AYNI SEANSA YENİ EĞİTİM GRUBU</span>
              <h2>Grup Ekle</h2>
              <p>Gün ve saat değişmez. Yeni grup bu seans kartının içine eklenir.</p>
            </div>
            <button type="button" className="sessionAddGroupClose" onClick={close} aria-label="Pencereyi kapat">×</button>
          </header>

          <div className="sessionAddGroupBody">
            <div className="sessionFixedInfo">
              <span>
                <b>Ders günleri</b>
                {weekdays.slice().sort((a,b) => a-b).map((weekday) => dayNames[weekday] || "").filter(Boolean).join(" • ")}
              </span>
              <span>
                <b>Saat</b>
                {startTime}–{endTime}
              </span>
            </div>

            <div className="sessionAddGroupGrid">
              <label>
                Grup türü
                <select name="course_type" defaultValue={courseTypes.includes(defaultCourseType) ? defaultCourseType : courseTypes[0]} required>
                  {courseTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>

              <label>
                Seviye
                <select name="level_id" defaultValue="" required>
                  <option value="" disabled>Seviye seçin</option>
                  {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
                </select>
              </label>

              <label>
                Kontenjan
                <input type="number" name="capacity" min={1} max={50} defaultValue={6} required />
              </label>

              <label className="sessionAddGroupWide">
                Açıklama
                <input name="description" placeholder="İsteğe bağlı operasyon notu" />
              </label>
            </div>

            <label className="sessionAddGroupPublish">
              <input type="checkbox" name="public_registration" defaultChecked />
              <span>
                <strong>Ön kayıt formunda göster</strong>
                <small>Açık olduğunda yeni grup ön kayıt seçeneklerine otomatik eklenir.</small>
              </span>
            </label>
          </div>

          <footer className="sessionAddGroupFooter">
            <button type="button" className="sessionAddGroupCancel" onClick={close}>Vazgeç</button>
            <SubmitButton />
          </footer>
        </form>
      </dialog>
    </>
  );
}

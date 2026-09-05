"use client";

import {
  useRef,
} from "react";

import {
  useFormStatus,
} from "react-dom";

import {
  updateGroup,
} from "./actions";

type OptionItem = {
  id: string;
  name: string;
};

type CoachItem = {
  id: string;
  full_name: string | null;
};

type ScheduleItem = {
  weekday: number;
  start_time: string;
  end_time: string;
};

type GroupItem = {
  id: string;
  branch_id: string;
  level_id: string | null;
  name: string;
  capacity: number;
  course_type: string;
  description: string | null;
  primary_coach_id: string | null;
  public_registration: boolean;
};

type GroupEditorProps = {
  group: GroupItem;
  schedules: ScheduleItem[];
  branches: OptionItem[];
  levels: OptionItem[];
  coaches: CoachItem[];
};

const dayNames = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="editorSaveButton"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span
            className="groupButtonSpinner"
            aria-hidden="true"
          />
          Değişiklikler kaydediliyor...
        </>
      ) : (
        "Değişiklikleri Kaydet"
      )}
    </button>
  );
}

export default function GroupEditor({
  group,
  schedules,
  branches,
  levels,
  coaches,
}: GroupEditorProps) {
  const dialogRef =
    useRef<HTMLDialogElement>(null);

  const firstSchedule =
    schedules[0];

  const selectedWeekdays = new Set(
    schedules.map(
      (schedule) => schedule.weekday
    )
  );

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function handleBackdropClick(
    event: React.MouseEvent<HTMLDialogElement>
  ) {
    if (
      event.target === event.currentTarget
    ) {
      closeDialog();
    }
  }

  return (
    <>
      <button
        type="button"
        className="editGroupButton"
        onClick={openDialog}
      >
        Düzenle
      </button>

      <dialog
        ref={dialogRef}
        className="groupEditorDialog"
        onClick={handleBackdropClick}
      >
        <form
          action={updateGroup}
          className="groupEditorForm"
        >
          <input
            type="hidden"
            name="group_id"
            value={group.id}
          />

          <header className="groupEditorHeader">
            <div>
              <span>
                EĞİTİM GRUBU DÜZENLEME
              </span>

              <h2>{group.name}</h2>

              <p>
                Grup, eğitmen, seviye,
                program ve saat bilgilerini
                güncelleyin.
              </p>
            </div>

            <button
              type="button"
              className="groupEditorClose"
              onClick={closeDialog}
              aria-label="Pencereyi kapat"
              title="Kapat"
            >
              ×
            </button>
          </header>

          <div className="groupEditorBody">
            <div className="editorGrid">
              <label className="editorWide">
                Kısa grup adı

                <input
                  name="name"
                  defaultValue={group.name}
                  required
                  placeholder="Örn. Çocuk, Yetişkin veya Takım Altyapı"
                />
                <small className="groupNameHelp">Şube, gün ve saat bilgisini grup adına tekrar yazmayın. Bunlar aşağıdaki alanlardan alınır ve ön kayıt formunda otomatik, düzenli biçimde birleştirilir.</small>
              </label>

              <label>
                Kurs programı

                <select
                  name="course_type"
                  defaultValue={
                    group.course_type
                  }
                  required
                >
                  <option value="Çocuk Yüzme Kursu">
                    Çocuk Yüzme Kursu
                  </option>

                  <option value="Yetişkin Yüzme Kursu">
                    Yetişkin Yüzme Kursu
                  </option>

                  <option value="Özel Ders">
                    Özel Ders
                  </option>

                  <option value="Takım / Performans">
                    Takım / Performans
                  </option>
                </select>
              </label>

              <label>
                Şube

                <select
                  name="branch_id"
                  defaultValue={
                    group.branch_id
                  }
                  required
                >
                  {branches.map(
                    (branch) => (
                      <option
                        value={branch.id}
                        key={branch.id}
                      >
                        {branch.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Seviye

                <select
                  name="level_id"
                  defaultValue={
                    group.level_id || ""
                  }
                >
                  <option value="">
                    Tüm seviyeler
                  </option>

                  {levels.map(
                    (level) => (
                      <option
                        value={level.id}
                        key={level.id}
                      >
                        {level.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Ana eğitmen

                <select
                  name="primary_coach_id"
                  defaultValue={
                    group.primary_coach_id ||
                    ""
                  }
                >
                  <option value="">
                    Eğitmen seçilmedi
                  </option>

                  {coaches.map(
                    (coach) => (
                      <option
                        value={coach.id}
                        key={coach.id}
                      >
                        {coach.full_name ||
                          "İsimsiz eğitmen"}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Başlangıç saati

                <input
                  type="time"
                  name="start_time"
                  defaultValue={
                    firstSchedule
                      ? String(
                          firstSchedule.start_time
                        ).slice(0, 5)
                      : ""
                  }
                  required
                />
              </label>

              <label>
                Bitiş saati

                <input
                  type="time"
                  name="end_time"
                  defaultValue={
                    firstSchedule
                      ? String(
                          firstSchedule.end_time
                        ).slice(0, 5)
                      : ""
                  }
                  required
                />
              </label>

              <label>
                Kontenjan

                <input
                  type="number"
                  name="capacity"
                  min="1"
                  max="50"
                  defaultValue={
                    group.capacity
                  }
                  required
                />
              </label>

              <label className="editorWide">
                Açıklama

                <textarea
                  name="description"
                  rows={3}
                  defaultValue={
                    group.description || ""
                  }
                  placeholder="Grup hakkında açıklama"
                />
              </label>
            </div>

            <fieldset className="editorWeekdays">
              <legend>Ders günleri</legend>

              {dayNames.map(
                (day, index) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      name="weekdays"
                      value={index}
                      defaultChecked={selectedWeekdays.has(
                        index
                      )}
                    />

                    <span>{day}</span>
                  </label>
                )
              )}
            </fieldset>

            <label className="editorPublishToggle">
              <input
                type="checkbox"
                name="public_registration"
                defaultChecked={
                  group.public_registration
                }
              />

              <span>
                <strong>
                  Ön kayıt formunda göster
                </strong>

                <small>
                  Kapalı olduğunda grup
                  panelde kalır fakat ön
                  kayıt formunda görünmez.
                </small>
              </span>
            </label>
          </div>

          <footer className="groupEditorFooter">
            <button
              type="button"
              className="editorCancelButton"
              onClick={closeDialog}
            >
              Vazgeç
            </button>

            <SaveButton />
          </footer>
        </form>
      </dialog>

      <style jsx global>{`
        .groupEditorDialog {
          width: min(760px, calc(100vw - 28px));
          max-height: calc(100dvh - 28px);
          margin: auto;
          padding: 0;
          overflow: hidden;
          border: 0;
          border-radius: 23px;
          background: #ffffff;
          color: #10213f;
          box-shadow: 0 30px 90px
            rgba(3, 19, 45, 0.32);
        }

        .groupEditorDialog::backdrop {
          background: rgba(3, 15, 35, 0.66);
          backdrop-filter: blur(5px);
        }

        .groupEditorForm {
          max-height: calc(100dvh - 28px);
          display: flex;
          flex-direction: column;
        }

        .groupEditorHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 23px 25px;
          background: linear-gradient(
            135deg,
            #082a58,
            #0d6bca
          );
          color: #ffffff;
        }

        .groupEditorHeader span {
          color: #8ec5ff;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .groupEditorHeader h2 {
          margin: 7px 0 4px;
          font-size: 23px;
        }

        .groupEditorHeader p {
          margin: 0;
          color: #d9eaff;
          font-size: 12px;
          line-height: 1.5;
        }

        .groupEditorClose {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          padding: 0;
          border: 1px solid
            rgba(255, 255, 255, 0.25);
          border-radius: 12px;
          background: rgba(
            255,
            255,
            255,
            0.13
          );
          color: #ffffff;
          font-size: 27px;
          line-height: 1;
          cursor: pointer;
        }

        .groupEditorBody {
          padding: 23px 25px;
          overflow-y: auto;
        }

        .editorGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .editorGrid label {
          color: #42536f;
          font-size: 12px;
          font-weight: 850;
        }

        .editorGrid input,
        .editorGrid select,
        .editorGrid textarea {
          display: block;
          width: 100%;
          box-sizing: border-box;
          margin-top: 7px;
          padding: 12px;
          border: 1px solid #d8e2ef;
          border-radius: 12px;
          outline: none;
          background: #fbfcff;
          color: #13233f;
          font: inherit;
        }

        .groupNameHelp {
          display: block;
          margin-top: 7px;
          padding: 9px 10px;
          border-radius: 9px;
          background: #eef6ff;
          color: #315f94;
          font-size: 11px;
          line-height: 1.45;
        }

        .editorGrid input,
        .editorGrid select {
          min-height: 46px;
        }

        .editorGrid textarea {
          resize: vertical;
        }

        .editorGrid input:focus,
        .editorGrid select:focus,
        .editorGrid textarea:focus {
          border-color: #3388ef;
          background: #ffffff;
          box-shadow: 0 0 0 4px
            rgba(23, 105, 232, 0.1);
        }

        .editorWide {
          grid-column: 1 / -1;
        }

        .editorWeekdays {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 20px 0;
          padding: 0;
          border: 0;
        }

        .editorWeekdays legend {
          width: 100%;
          margin-bottom: 9px;
          color: #42536f;
          font-size: 12px;
          font-weight: 900;
        }

        .editorWeekdays input {
          display: none;
        }

        .editorWeekdays span {
          display: block;
          padding: 9px 11px;
          border: 1px solid #dbe4f0;
          border-radius: 9px;
          color: #344765;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        .editorWeekdays
          input:checked
          + span {
          border-color: #1769e8;
          background: #1769e8;
          color: #ffffff;
        }

        .editorPublishToggle {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 13px;
          border: 1px solid #d6e7fd;
          border-radius: 13px;
          background: #f2f7ff;
          cursor: pointer;
        }

        .editorPublishToggle input {
          width: 18px;
          height: 18px;
          accent-color: #1769e8;
        }

        .editorPublishToggle span {
          display: flex;
          flex-direction: column;
        }

        .editorPublishToggle strong {
          font-size: 12px;
        }

        .editorPublishToggle small {
          margin-top: 3px;
          color: #71809a;
          line-height: 1.4;
        }

        .groupEditorFooter {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 25px;
          border-top: 1px solid #e7edf5;
          background: #f8fafd;
        }

        .groupEditorFooter button {
          min-height: 44px;
          padding: 11px 17px;
          border-radius: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .editorCancelButton {
          border: 1px solid #d7e0ec;
          background: #ffffff;
          color: #344765;
        }

        .editorSaveButton {
          border: 0;
          background: linear-gradient(
            135deg,
            #1774f0,
            #0754c6
          );
          color: #ffffff;
          box-shadow: 0 9px 20px
            rgba(23, 105, 232, 0.22);
        }

        .editGroupButton {
          min-height: 38px;
          padding: 8px 12px;
          border: 1px solid #b9d2f6;
          border-radius: 10px;
          background: #edf5ff;
          color: #1769e8;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        @media (max-width: 620px) {
          .groupEditorDialog {
            width: calc(100vw - 18px);
            max-height: calc(100dvh - 18px);
            border-radius: 18px;
          }

          .groupEditorForm {
            max-height: calc(100dvh - 18px);
          }

          .groupEditorHeader,
          .groupEditorBody {
            padding: 18px;
          }

          .editorGrid {
            grid-template-columns: 1fr;
          }

          .editorWide {
            grid-column: auto;
          }

          .groupEditorFooter {
            padding: 13px 18px;
          }

          .groupEditorFooter button {
            flex: 1;
          }
        }
      `}</style>
    </>
  );
}

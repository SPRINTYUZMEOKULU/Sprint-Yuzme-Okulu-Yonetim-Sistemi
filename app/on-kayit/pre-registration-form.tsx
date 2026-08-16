"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type Branch = {
  id: string;
  name: string;
};

type Group = {
  id: string;
  branch_id: string;
  level_id: string | null;
  name: string;
  capacity: number;
  course_type: string;
  description: string | null;
  sort_order: number;
};

type Schedule = {
  id: string;
  group_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

type Package = {
  id: string;
  name: string;
  lesson_count: number;
  price: number;
};

type Level = {
  id: string;
  name: string;
  sort_order: number;
};

type Options = {
  branches: Branch[];
  groups: Group[];
  schedules: Schedule[];
  packages: Package[];
  levels: Level[];
};

type RegistrationFor =
  | "child"
  | "adult";

const days = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

export default function PreRegistrationForm() {
  const [status, setStatus] =
    useState<
      "idle" |
      "sending" |
      "success" |
      "error"
    >("idle");

  const [message, setMessage] =
    useState("");

  const [options, setOptions] =
    useState<Options>({
      branches: [],
      groups: [],
      schedules: [],
      packages: [],
      levels: [],
    });

  const [loading, setLoading] =
    useState(true);

  const [
    registrationFor,
    setRegistrationFor,
  ] =
    useState<RegistrationFor>(
      "child"
    );

  const [courseType, setCourseType] =
    useState("");

  const [branchId, setBranchId] =
    useState("");

  const [groupId, setGroupId] =
    useState("");

  useEffect(() => {
    fetch(
      "/api/public-registration-options",
      {
        cache: "no-store",
      }
    )
      .then((response) =>
        response.json()
      )
      .then((data) => {
        if (data.error) {
          throw new Error(
            data.error
          );
        }

        setOptions(data);
      })
      .catch(() => {
        setMessage(
          "Grup ve saat seçenekleri yüklenemedi. Lütfen daha sonra tekrar deneyin."
        );
      })
      .finally(() =>
        setLoading(false)
      );
  }, []);

  const courseTypes =
    useMemo(
      () =>
        Array.from(
          new Set(
            options.groups.map(
              (group) =>
                group.course_type
            )
          )
        ),
      [options.groups]
    );

  const availableBranches =
    useMemo(
      () =>
        options.branches.filter(
          (branch) =>
            options.groups.some(
              (group) =>
                group.branch_id ===
                  branch.id &&
                (!courseType ||
                  group.course_type ===
                    courseType)
            )
        ),
      [
        options,
        courseType,
      ]
    );

  const availableGroups =
    useMemo(
      () =>
        options.groups.filter(
          (group) =>
            (!courseType ||
              group.course_type ===
                courseType) &&
            (!branchId ||
              group.branch_id ===
                branchId)
        ),
      [
        options,
        courseType,
        branchId,
      ]
    );

  const selectedGroup =
    options.groups.find(
      (group) =>
        group.id === groupId
    );

  const selectedSchedules =
    options.schedules.filter(
      (schedule) =>
        schedule.group_id ===
        groupId
    );

  const selectedLevel =
    selectedGroup?.level_id
      ? options.levels.find(
          (level) =>
            level.id ===
            selectedGroup.level_id
        )
      : null;

  function groupLabel(
    group: Group
  ) {
    const schedules =
      options.schedules.filter(
        (schedule) =>
          schedule.group_id ===
          group.id
      );

    const dayText =
      Array.from(
        new Set(
          schedules.map(
            (schedule) =>
              days[
                schedule.weekday
              ]
          )
        )
      ).join(" – ");

    const time =
      schedules[0]
        ? `${schedules[0].start_time.slice(
            0,
            5
          )}–${schedules[0].end_time.slice(
            0,
            5
          )}`
        : "Saat tanımlanmadı";

    return `${group.name} · ${dayText} · ${time}`;
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setStatus("sending");
    setMessage("");

    const formElement =
      event.currentTarget;

    const payload =
      Object.fromEntries(
        new FormData(
          formElement
        ).entries()
      );

    try {
      const response =
        await fetch(
          "/api/pre-registrations",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Kayıt oluşturulamadı."
        );
      }

      setStatus("success");

      setMessage(
        "Ön kaydınız başarıyla alınmıştır. Kayıt ekibimiz en kısa sürede sizinle iletişime geçecektir."
      );

      formElement.reset();

      setRegistrationFor(
        "child"
      );

      setCourseType("");
      setBranchId("");
      setGroupId("");
    } catch (error) {
      setStatus("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Bir hata oluştu."
      );
    }
  }

  return (
    <form
      className="registrationForm"
      onSubmit={handleSubmit}
    >
      <input
        className="hiddenField"
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
      />

      <section className="formSection">
        <div className="formSectionTitle">
          <b>1</b>

          <div>
            <strong>
              Öğrenci / Katılımcı
              bilgileri
            </strong>

            <span>
              Kimin için kayıt
              oluşturduğunuzu seçin
            </span>
          </div>
        </div>

        <div className="registrationType">
          <label
            className={
              registrationFor ===
              "child"
                ? "selected"
                : ""
            }
          >
            <input
              type="radio"
              name="registrationFor"
              value="child"
              checked={
                registrationFor ===
                "child"
              }
              onChange={() =>
                setRegistrationFor(
                  "child"
                )
              }
            />

            <strong>
              Çocuğum için
            </strong>

            <span>
              Veli olarak çocuğunuz
              için ön kayıt
              oluşturun.
            </span>
          </label>

          <label
            className={
              registrationFor ===
              "adult"
                ? "selected"
                : ""
            }
          >
            <input
              type="radio"
              name="registrationFor"
              value="adult"
              checked={
                registrationFor ===
                "adult"
              }
              onChange={() =>
                setRegistrationFor(
                  "adult"
                )
              }
            />

            <strong>
              Kendim için /
              Yetişkin
            </strong>

            <span>
              18 yaş ve üzeri
              katılımcılar için.
            </span>
          </label>
        </div>

        <div className="formGrid">
          <label>
            Öğrenci / Katılımcı adı

            <input
              name="firstName"
              required
              maxLength={60}
              placeholder="Adı"
            />
          </label>

          <label>
            Soyadı

            <input
              name="lastName"
              required
              maxLength={60}
              placeholder="Soyadı"
            />
          </label>

          <label>
            Doğum tarihi

            <input
              name="birthDate"
              type="date"
            />
          </label>

          {registrationFor ===
            "child" && (
            <label>
              Veli adı soyadı

              <input
                name="guardianName"
                required
                maxLength={120}
                placeholder="Veli adı soyadı"
              />
            </label>
          )}

          <label>
            Telefon

            <input
              name="phone"
              type="tel"
              required
              placeholder="05xx xxx xx xx"
              maxLength={20}
            />
          </label>
        </div>
      </section>

      <section className="formSection">
        <div className="formSectionTitle">
          <b>2</b>

          <div>
            <strong>
              Kurs, grup ve paket
              tercihi
            </strong>

            <span>
              Aktif gruplar sistemden
              otomatik gelir
            </span>
          </div>
        </div>

        {loading ? (
          <div className="optionsLoading">
            Aktif gruplar
            yükleniyor…
          </div>
        ) : (
          <div className="formGrid">
            <label>
              Kurs türü

              <select
                name="courseType"
                required
                value={courseType}
                onChange={(event) => {
                  setCourseType(
                    event.target.value
                  );

                  setBranchId("");
                  setGroupId("");
                }}
              >
                <option
                  value=""
                  disabled
                >
                  Seçiniz
                </option>

                {courseTypes.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Şube

              <select
                name="branchId"
                required
                value={branchId}
                onChange={(event) => {
                  setBranchId(
                    event.target.value
                  );

                  setGroupId("");
                }}
              >
                <option
                  value=""
                  disabled
                >
                  Şube seçin
                </option>

                {availableBranches.map(
                  (branch) => (
                    <option
                      value={
                        branch.id
                      }
                      key={
                        branch.id
                      }
                    >
                      {branch.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="wideGroupSelect">
              Aktif grup, gün ve saat

              <select
                name="groupId"
                required
                value={groupId}
                onChange={(event) =>
                  setGroupId(
                    event.target.value
                  )
                }
              >
                <option
                  value=""
                  disabled
                >
                  Grup seçin
                </option>

                {availableGroups.map(
                  (group) => (
                    <option
                      value={
                        group.id
                      }
                      key={
                        group.id
                      }
                    >
                      {groupLabel(
                        group
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Yüzme seviyesi

              <select
                name="swimmingLevel"
                defaultValue=""
              >
                <option value="">
                  Seçiniz
                </option>

                {options.levels.map(
                  (level) => (
                    <option
                      key={
                        level.id
                      }
                    >
                      {level.name}
                    </option>
                  )
                )}

                <option>
                  Bilmiyorum
                </option>
              </select>
            </label>

            <label>
              Paket tercihi

              <select
                name="packageId"
                defaultValue=""
              >
                <option value="">
                  Paket seçin
                </option>

                {options.packages.map(
                  (item) => (
                    <option
                      value={
                        item.id
                      }
                      key={
                        item.id
                      }
                    >
                      {item.name} ·{" "}
                      {item.lesson_count}{" "}
                      ders
                      {item.price
                        ? ` · ${Number(
                            item.price
                          ).toLocaleString(
                            "tr-TR"
                          )} ₺`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>
        )}

        {selectedGroup ? (
          <div className="selectedGroupCard">
            <div>
              <span>
                SEÇİLEN GRUP
              </span>

              <strong>
                {selectedGroup.name}
              </strong>

              <small>
                {
                  options.branches.find(
                    (branch) =>
                      branch.id ===
                      selectedGroup.branch_id
                  )?.name
                }{" "}
                ·{" "}
                {
                  selectedGroup.course_type
                }
              </small>
            </div>

            <div className="selectedSchedule">
              {selectedSchedules.map(
                (schedule) => (
                  <span
                    key={
                      schedule.id
                    }
                  >
                    <b>
                      {
                        days[
                          schedule.weekday
                        ]
                      }
                    </b>

                    {schedule.start_time.slice(
                      0,
                      5
                    )}
                    –
                    {schedule.end_time.slice(
                      0,
                      5
                    )}
                  </span>
                )
              )}
            </div>

            <div className="selectedMeta">
              <span>
                Kontenjan:{" "}
                <b>
                  {
                    selectedGroup.capacity
                  }{" "}
                  kişi
                </b>
              </span>

              <span>
                Seviye:{" "}
                <b>
                  {selectedLevel?.name ||
                    "Tüm seviyeler"}
                </b>
              </span>
            </div>

            {selectedGroup.description ? (
              <p>
                {
                  selectedGroup.description
                }
              </p>
            ) : null}

            <input
              type="hidden"
              name="branchName"
              value={
                options.branches.find(
                  (branch) =>
                    branch.id ===
                    selectedGroup.branch_id
                )?.name || ""
              }
            />

            <input
              type="hidden"
              name="preferredDays"
              value={selectedSchedules
                .map(
                  (schedule) =>
                    days[
                      schedule.weekday
                    ]
                )
                .join(" - ")}
            />

            <input
              type="hidden"
              name="preferredTime"
              value={
                selectedSchedules[0]
                  ? `${selectedSchedules[0].start_time.slice(
                      0,
                      5
                    )} - ${selectedSchedules[0].end_time.slice(
                      0,
                      5
                    )}`
                  : ""
              }
            />
          </div>
        ) : null}

        {!loading &&
        !options.groups.length ? (
          <div className="noGroupWarning">
            Şu anda ön kayda açık grup
            bulunmuyor. Kayıt ekibimizle
            iletişime geçebilirsiniz.
          </div>
        ) : null}
      </section>

      <section className="formSection">
        <div className="formSectionTitle">
          <b>3</b>

          <div>
            <strong>
              İletişim talebiniz
            </strong>

            <span>
              Ekibimizin size nasıl
              dönüş yapmasını
              istediğinizi seçin
            </span>
          </div>
        </div>

        <div className="requestOptions">
          <label>
            <input
              type="radio"
              name="contactRequest"
              value="call_me"
            />
            Beni aramanızı istiyorum
          </label>

          <label>
            <input
              type="radio"
              name="contactRequest"
              value="whatsapp_info"
            />
            WhatsApp üzerinden detaylı
            bilgi almak istiyorum
          </label>

          <label>
            <input
              type="radio"
              name="contactRequest"
              value="ready_to_start"
            />
            Kaydım tamamlandığında
            doğrudan kursa başlayacağım
          </label>

          <label>
            <input
              type="radio"
              name="contactRequest"
              value="need_information"
            />
            Karar vermeden önce detaylı
            bilgi almak istiyorum
          </label>
        </div>
      </section>

      <section className="formSection">
        <div className="formSectionTitle">
          <b>4</b>

          <div>
            <strong>
              Ek bilgiler
            </strong>

            <span>
              Özel durum ve
              beklentilerinizi
              paylaşabilirsiniz
            </span>
          </div>
        </div>

        <label className="fullWidth">
          Açıklama / özel durum

          <textarea
            name="note"
            rows={4}
            maxLength={1000}
            placeholder="Su korkusu veya kayıtla ilgili eklemek istediğiniz not..."
          />
        </label>
      </section>

      <section className="formSection">
        <div className="formSectionTitle">
          <b>5</b>

          <div>
            <strong>
              Kurallar ve onaylar
            </strong>

            <span>
              Başvurunuzu tamamlamadan
              önce bilgilendirmeleri
              inceleyin
            </span>
          </div>
        </div>

        <details className="rulesDetails">
          <summary>
            Sprint Yüzme Okulu
            Kurallarını Görüntüle
          </summary>

          <div className="rulesContent">
            <p>
              Sprint Yüzme Okulu kayıt
              ve kurs kuralları burada
              gösterilecektir.
            </p>

            <p>
              Bu metin daha sonra
              yönetim panelindeki form
              ayarlarından
              düzenlenebilir hale
              getirilecektir.
            </p>
          </div>
        </details>

        <label className="consent">
          <input
            type="checkbox"
            name="rulesAccepted"
            value="true"
            required
          />

          <span>
            Sprint Yüzme Okulu
            kurallarını okudum,
            anladım ve kabul ediyorum.
          </span>
        </label>

        <label className="consent">
          <input
            type="checkbox"
            name="whatsappPermission"
            value="true"
            required
          />

          <span>
            Kayıt ve iletişim
            bilgilendirmelerinin
            WhatsApp üzerinden
            gönderilmesini kabul
            ediyorum.
          </span>
        </label>
      </section>

      <div className="submitRow">
        <button
          className="submitButton"
          disabled={
            status === "sending" ||
            loading ||
            !options.groups.length
          }
          type="submit"
        >
          {status === "sending"
            ? "Başvurunuz gönderiliyor..."
            : "Ön Kaydı Tamamla"}
        </button>
      </div>

      {message && (
        <p
          className={
            status === "success"
              ? "formMessage success"
              : "formMessage error"
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}

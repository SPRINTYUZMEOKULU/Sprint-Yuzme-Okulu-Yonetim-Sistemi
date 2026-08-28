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
              inputMode="tel"
              autoComplete="tel"
              placeholder="05xx xxx xx xx"
              maxLength={20}
              pattern="(?:\+90|0)?5\d{9}"
              title="Telefon numarasını 05XXXXXXXXX veya +905XXXXXXXXX formatında giriniz."
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
                required
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
              required
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
              Sağlık beyanı
            </strong>

            <span>
              Yüzme eğitimine katılım açısından
              bilinmesi gereken bir durum varsa
              bizimle paylaşın
            </span>
          </div>
        </div>

        <label className="consent">
          <input
            type="checkbox"
            name="healthDeclaration"
            value="true"
            required
          />

          <span>
            Öğrenci / katılımcının yüzme eğitimine
            katılmasına engel teşkil eden, antrenörün
            bilmesi gereken veya güvenliği etkileyebilecek
            bir sağlık durumu varsa aşağıdaki alanda
            eksiksiz olarak belirteceğimi; aksi durumda
            yüzme eğitimine katılım açısından bilinen bir
            engel bulunmadığını beyan ediyorum.
          </span>
        </label>

        <label className="fullWidth">
          Sağlıkla ilgili açıklama
          <textarea
            name="healthNote"
            rows={3}
            maxLength={1000}
            placeholder="Varsa alerji, kronik rahatsızlık, özel gereksinim veya antrenörün bilmesi gereken durumu yazınız. Yoksa boş bırakabilirsiniz."
          />
        </label>
      </section>

      <section className="formSection">
        <div className="formSectionTitle">
          <b>6</b>

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
              <strong>1. Telafi dersi:</strong>{" "}
              Hastalık, tatil, izin, şehir dışı veya
              benzeri bireysel nedenlerle kaçırılan
              dersler için telafi dersi uygulanmaz.
              Telafi yalnızca tesis / havuz kaynaklı
              olarak dersin yapılamadığı durumlarda
              tanımlanır.
            </p>

            <p>
              <strong>2. Kayıt dondurma ve ders ekleme:</strong>{" "}
              Bireysel nedenlerle kayıt dondurma,
              kullanılmayan dersleri ileri tarihe aktarma
              veya pakete ek ders tanımlama yapılmaz.
            </p>

            <p>
              <strong>3. Ücret ve indirim:</strong>{" "}
              Başlanan veya planlanan kurs paketlerinde
              bireysel devamsızlıklara bağlı ücret
              indirimi, ders başına ücret düşümü veya
              geriye dönük indirim uygulanmaz.
            </p>

            <p>
              <strong>4. Grup ve saat düzeni:</strong>{" "}
              Eğitim kalitesi, seviye dengesi, tesis
              programı ve operasyon ihtiyacına göre
              grup, saat, kulvar veya antrenör planlaması
              Sprint Yüzme Okulu tarafından
              güncellenebilir.
            </p>

            <p>
              <strong>5. Sağlık ve güvenlik:</strong>{" "}
              Öğrenci / katılımcının antrenör tarafından
              bilinmesi gereken sağlık, alerji, özel
              gereksinim veya güvenliği etkileyebilecek
              durumları kayıt öncesinde bildirmek
              kursiyer / veli sorumluluğundadır.
            </p>

            <p>
              <strong>6. Ön kayıt:</strong>{" "}
              Bu formun gönderilmesi kesin kayıt,
              kesin kontenjan veya ödeme onayı anlamına
              gelmez. Kesin kayıt, kayıt ekibinin
              teyidiyle tamamlanır.
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
            Kayıt süreci, ders programı ve kurs
            bilgilendirmelerinin bu formda belirttiğim
            telefon numarasına WhatsApp üzerinden
            gönderilmesini kabul ediyorum.
          </span>
        </label>
      </section>

      <div
        style={{
          marginTop: 16,
          padding: "14px 16px",
          borderRadius: 12,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          color: "#1e3a8a",
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        <strong>Başvurunuz gönderildikten sonra:</strong>{" "}
        Seçtiğiniz şube, grup ve paket bilgileri SprintOS
        kayıt ekranına otomatik düşer. Kayıt ekibimiz
        başvuruyu kontrol ederek sizinle iletişime geçer.
      </div>

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

      {status === "error" && message && (
        <p className="formMessage error" role="alert">
          {message}
        </p>
      )}

      {status === "success" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pre-registration-success-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(15, 23, 42, 0.64)",
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            style={{
              width: "min(100%, 520px)",
              borderRadius: 24,
              background: "#ffffff",
              boxShadow: "0 28px 80px rgba(15, 23, 42, 0.28)",
              border: "1px solid rgba(226, 232, 240, 0.95)",
              padding: "34px 28px 28px",
              textAlign: "center",
              animation: "sprintSuccessIn 220ms ease-out",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 76,
                height: 76,
                margin: "0 auto 20px",
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#047857",
                fontSize: 38,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              ✓
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 28,
                padding: "6px 12px",
                marginBottom: 14,
                borderRadius: 999,
                background: "#eff6ff",
                color: "#1d4ed8",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: ".04em",
              }}
            >
              SPRINT YÜZME OKULU
            </div>

            <h2
              id="pre-registration-success-title"
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "clamp(25px, 5vw, 32px)",
                lineHeight: 1.15,
                fontWeight: 900,
              }}
            >
              Ön Kaydınız Alındı!
            </h2>

            <p
              style={{
                margin: "16px auto 0",
                maxWidth: 430,
                color: "#475569",
                fontSize: 15,
                lineHeight: 1.7,
              }}
            >
              Başvurunuz başarıyla Sprint Yüzme Okulu kayıt
              sistemine iletilmiştir.
            </p>

            <div
              style={{
                marginTop: 20,
                padding: "16px 18px",
                borderRadius: 16,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#334155",
                fontSize: 14,
                lineHeight: 1.65,
              }}
            >
              Kayıt ekibimiz başvurunuzu inceleyecek ve
              <strong> en kısa sürede sizinle iletişime geçecektir.</strong>
            </div>

            <p
              style={{
                margin: "18px 0 0",
                color: "#0f172a",
                fontSize: 14,
                lineHeight: 1.6,
                fontWeight: 700,
              }}
            >
              Başvurunuz için teşekkür ederiz. 🏊‍♂️
            </p>

            <button
              type="button"
              autoFocus
              onClick={() => {
                setStatus("idle");
                setMessage("");
              }}
              style={{
                width: "100%",
                minHeight: 50,
                marginTop: 24,
                border: 0,
                borderRadius: 14,
                background: "#0b6ff4",
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(11, 111, 244, 0.22)",
              }}
            >
              Tamam
            </button>

            <style jsx>{`
              @keyframes sprintSuccessIn {
                from {
                  opacity: 0;
                  transform: translateY(10px) scale(0.98);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
            `}</style>
          </div>
        </div>
      )}
    </form>
  );
}

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

  if (status === "success") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          overflowY: "auto",
          background:
            "linear-gradient(135deg, #021a3d 0%, #073f91 42%, #edf5ff 42%, #ffffff 100%)",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            gridTemplateColumns: "minmax(310px, 0.9fr) minmax(520px, 2.1fr)",
          }}
          className="sprintSuccessShell"
        >
          <aside
            style={{
              position: "relative",
              overflow: "hidden",
              minHeight: "100vh",
              padding: "54px 42px",
              color: "#ffffff",
              background:
                "radial-gradient(circle at 48% 33%, rgba(35,140,255,.36), transparent 28%), linear-gradient(180deg,#031f49 0%,#073f91 58%,#032454 100%)",
            }}
          >
            <div className="spark spark1" />
            <div className="spark spark2" />
            <div className="spark spark3" />

            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: 22,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 16px 45px rgba(0,0,0,.22)",
                marginBottom: 34,
              }}
            >
              <div
                style={{
                  color: "#0b4e9c",
                  fontSize: 15,
                  lineHeight: 1.05,
                  fontWeight: 1000,
                  textAlign: "center",
                  letterSpacing: ".03em",
                }}
              >
                SPRINT
                <br />
                <span style={{ fontSize: 9 }}>YÜZME OKULU</span>
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: ".22em",
                opacity: .88,
                marginBottom: 18,
              }}
            >
              SPRINT YÜZME OKULU
            </div>

            <h2
              style={{
                margin: 0,
                maxWidth: 420,
                fontSize: "clamp(38px, 4.5vw, 64px)",
                lineHeight: 1.07,
                fontWeight: 1000,
                letterSpacing: "-.045em",
              }}
            >
              Yüzmeye ilk
              <br />
              adımınız
              <br />
              <span
                style={{
                  color: "#ff9a1f",
                  textDecoration: "underline",
                  textUnderlineOffset: 7,
                }}
              >
                burada başlıyor.
              </span>
            </h2>

            <div
              className="successPulseText"
              style={{
                marginTop: 28,
                maxWidth: 410,
                padding: "18px 20px",
                borderRadius: 18,
                background: "rgba(255,255,255,.10)",
                border: "1px solid rgba(255,255,255,.20)",
                boxShadow: "0 0 34px rgba(39,137,255,.28)",
              }}
            >
              <strong
                style={{
                  display: "block",
                  fontSize: 19,
                  marginBottom: 7,
                }}
              >
                🎉 Ön Kaydınız Başarıyla Alındı!
              </strong>
              <span
                style={{
                  display: "block",
                  fontSize: 14,
                  lineHeight: 1.65,
                  opacity: .92,
                }}
              >
                Başvurunuz kayıt ekibimize ulaştı. En kısa sürede
                sizinle iletişime geçeceğiz.
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                marginTop: 28,
                maxWidth: 410,
              }}
            >
              {[
                ["👥", "Butik gruplar", "Kontenjan sınırılı eğitim"],
                ["🏅", "Uzman antrenörler", "Deneyimli ve sertifikalı kadro"],
                ["⚡", "Hızlı dönüş", "Başvurunuz kayıtsız kalmaz"],
              ].map(([icon, title, desc]) => (
                <div
                  key={title}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr",
                    gap: 14,
                    alignItems: "center",
                    padding: "14px 16px",
                    borderRadius: 16,
                    background: "rgba(37,127,225,.22)",
                    border: "1px solid rgba(255,255,255,.12)",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      display: "grid",
                      placeItems: "center",
                      background: "#0b6ff4",
                      fontSize: 20,
                    }}
                  >
                    {icon}
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: 15 }}>
                      {title}
                    </strong>
                    <span style={{ fontSize: 12, opacity: .8 }}>
                      {desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "50%",
                bottom: -155,
                width: 540,
                height: 540,
                transform: "translateX(-50%)",
                borderRadius: "50%",
                border: "3px solid rgba(54,156,255,.72)",
                boxShadow:
                  "0 0 20px rgba(38,146,255,.9), inset 0 0 34px rgba(38,146,255,.35)",
                opacity: .72,
              }}
            />
          </aside>

          <main
            style={{
              position: "relative",
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "46px 34px",
              background:
                "radial-gradient(circle at 50% 28%, rgba(103,232,162,.16), transparent 24%), linear-gradient(180deg,#f9fbff 0%,#ffffff 100%)",
            }}
          >
            <div className="confetti confettiA" />
            <div className="confetti confettiB" />
            <div className="confetti confettiC" />
            <div className="confetti confettiD" />
            <div className="confetti confettiE" />
            <div className="confetti confettiF" />
            <div className="confetti confettiG" />
            <div className="confetti confettiH" />

            <section
              style={{
                width: "min(100%, 720px)",
                textAlign: "center",
                padding: "28px 16px",
              }}
            >
              <div
                className="successCheck"
                style={{
                  width: 132,
                  height: 132,
                  margin: "0 auto 34px",
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: "#ffffff",
                  border: "10px solid #dffbe8",
                  color: "#22c55e",
                  fontSize: 72,
                  fontWeight: 1000,
                  boxShadow:
                    "0 0 0 14px rgba(34,197,94,.09), 0 18px 50px rgba(34,197,94,.22)",
                }}
              >
                ✓
              </div>

              <h1
                style={{
                  margin: 0,
                  color: "#07356f",
                  fontSize: "clamp(38px, 6vw, 64px)",
                  lineHeight: 1.06,
                  letterSpacing: "-.04em",
                  fontWeight: 1000,
                }}
              >
                Ön Kaydınız Alındı! 🎉
              </h1>

              <p
                style={{
                  margin: "22px auto 0",
                  maxWidth: 620,
                  color: "#64748b",
                  fontSize: 17,
                  lineHeight: 1.75,
                }}
              >
                Başvurunuz başarıyla{" "}
                <strong style={{ color: "#0b6ff4" }}>
                  Sprint Yüzme Okulu
                </strong>{" "}
                kayıt sistemine iletilmiştir.
              </p>

              <div
                style={{
                  margin: "28px auto 0",
                  maxWidth: 640,
                  padding: "18px 22px",
                  borderRadius: 18,
                  background: "#ffffff",
                  border: "1px solid #dfe7f1",
                  boxShadow: "0 12px 36px rgba(15,23,42,.08)",
                  display: "grid",
                  gridTemplateColumns: "48px 1fr",
                  gap: 14,
                  textAlign: "left",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background: "#e9fbef",
                    fontSize: 22,
                  }}
                >
                  🕒
                </div>
                <div
                  style={{
                    color: "#334155",
                    fontSize: 15,
                    lineHeight: 1.55,
                    fontWeight: 700,
                  }}
                >
                  Kayıt ekibimiz başvurunuzu inceleyecek ve en kısa
                  sürede sizinle iletişime geçecektir.
                </div>
              </div>

              <div
                style={{
                  marginTop: 30,
                  color: "#f59e0b",
                  fontSize: "clamp(22px, 3vw, 34px)",
                  fontWeight: 800,
                  fontStyle: "italic",
                }}
              >
                Başvurunuz için teşekkür ederiz. 💙
              </div>

              <div
                style={{
                  marginTop: 8,
                  color: "#173a6a",
                  fontSize: 20,
                  fontWeight: 900,
                }}
              >
                Sprint Yüzme Okulu
              </div>

              <button
                type="button"
                autoFocus
                onClick={() => {
                  setStatus("idle");
                  setMessage("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                style={{
                  width: "min(100%, 640px)",
                  minHeight: 58,
                  marginTop: 30,
                  border: 0,
                  borderRadius: 14,
                  background:
                    "linear-gradient(90deg,#075ee9 0%,#1878ff 100%)",
                  color: "#ffffff",
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: "0 14px 30px rgba(11,111,244,.28)",
                }}
              >
                ↻ &nbsp; Yeni Kayıt Oluştur
              </button>

              <div
                className="welcomePulse"
                style={{
                  margin: "34px auto 0",
                  maxWidth: 640,
                  padding: "15px 20px",
                  borderRadius: 16,
                  color: "#0756c6",
                  background: "#eef6ff",
                  border: "1px solid #cfe2ff",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                🎁 Sizi en kısa sürede aramızda görmek için sabırsızlanıyoruz! 🏊
              </div>
            </section>
          </main>
        </div>

        <style jsx>{`
          .successCheck {
            animation: successPop 700ms cubic-bezier(.2,.9,.3,1.3) both,
              successGlow 1.8s ease-in-out infinite 800ms;
          }

          .successPulseText {
            animation: pulseCard 1.65s ease-in-out infinite;
          }

          .welcomePulse {
            animation: softBlink 1.7s ease-in-out infinite;
          }

          .spark {
            position: absolute;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #8dccff;
            box-shadow: 0 0 18px 5px rgba(80,170,255,.75);
            animation: sparkle 1.7s ease-in-out infinite;
          }

          .spark1 { left: 24%; top: 18%; }
          .spark2 { right: 18%; top: 29%; animation-delay: .45s; }
          .spark3 { left: 52%; top: 52%; animation-delay: .9s; }

          .confetti {
            position: absolute;
            width: 9px;
            height: 18px;
            border-radius: 3px;
            animation: confettiFall 3.3s linear infinite;
            opacity: .8;
          }

          .confettiA { left: 12%; top: 5%; background: #ff9f43; }
          .confettiB { left: 24%; top: 10%; background: #4f8cff; animation-delay: .5s; }
          .confettiC { left: 38%; top: 4%; background: #8e5bea; animation-delay: 1s; }
          .confettiD { left: 55%; top: 8%; background: #2fc590; animation-delay: 1.5s; }
          .confettiE { left: 70%; top: 5%; background: #ff6b6b; animation-delay: .3s; }
          .confettiF { left: 84%; top: 12%; background: #5da9ff; animation-delay: 1.2s; }
          .confettiG { left: 18%; top: 34%; background: #b56bed; animation-delay: 1.8s; }
          .confettiH { right: 8%; top: 38%; background: #ffb43c; animation-delay: .75s; }

          @keyframes successPop {
            from { opacity: 0; transform: scale(.65) rotate(-7deg); }
            to { opacity: 1; transform: scale(1) rotate(0); }
          }

          @keyframes successGlow {
            0%, 100% { box-shadow: 0 0 0 14px rgba(34,197,94,.08), 0 18px 50px rgba(34,197,94,.18); }
            50% { box-shadow: 0 0 0 22px rgba(34,197,94,.13), 0 20px 60px rgba(34,197,94,.32); }
          }

          @keyframes pulseCard {
            0%, 100% { transform: scale(1); box-shadow: 0 0 34px rgba(39,137,255,.22); }
            50% { transform: scale(1.025); box-shadow: 0 0 48px rgba(39,137,255,.52); }
          }

          @keyframes softBlink {
            0%, 100% { opacity: 1; transform: translateY(0); }
            50% { opacity: .62; transform: translateY(-2px); }
          }

          @keyframes sparkle {
            0%, 100% { opacity: .35; transform: scale(.7); }
            50% { opacity: 1; transform: scale(1.6); }
          }

          @keyframes confettiFall {
            0% { transform: translateY(-12px) rotate(0deg); opacity: 0; }
            15% { opacity: .9; }
            100% { transform: translateY(82vh) rotate(430deg); opacity: 0; }
          }

          @media (max-width: 900px) {
            .sprintSuccessShell {
              grid-template-columns: 1fr !important;
            }

            .sprintSuccessShell aside {
              min-height: auto !important;
              padding: 34px 24px !important;
            }

            .sprintSuccessShell main {
              min-height: auto !important;
              padding: 38px 20px 54px !important;
            }
          }
        `}</style>
      </div>
    );
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
    </form>
  );
}

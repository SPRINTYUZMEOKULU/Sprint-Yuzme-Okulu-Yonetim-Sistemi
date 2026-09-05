"use client";

import Image from "next/image";

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

type FormField = {
  id: string;
  field_key: string;
  label: string;
  placeholder?: string | null;
  help_text?: string | null;
  is_visible: boolean;
  is_required: boolean;
  applies_to: "all" | "child" | "adult";
};

type Options = {
  branches: Branch[];
  groups: Group[];
  schedules: Schedule[];
  packages: Package[];
  levels: Level[];
  formFields: FormField[];
  visibleFormFields: FormField[];
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

function FieldLabel({ text, required }: { text: string; required: boolean }) {
  return <span className="fieldLabelText">{text}{required ? <b aria-label="zorunlu">*</b> : null}</span>;
}

function SuccessIcon({ name, size = 22 }: { name: "users" | "award" | "bolt" | "clock" | "refresh"; size?: number }) {
  const paths = {
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    award: <><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></>,
    bolt: <path d="m13 2-9 12h8l-1 8 9-12h-8z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.2-2L20 12M4 12l2.7 5a7 7 0 0 0 11.2-2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

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
      formFields: [],
      visibleFormFields: [],
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

  function fieldSetting(key: string, fallbackVisible = true, fallbackRequired = false) {
    const field = options.formFields.find((item) => item.field_key === key);
    if (!field) return { visible: fallbackVisible, required: fallbackRequired, label: "" };
    const applicable = field.applies_to === "all" || field.applies_to === registrationFor;
    return {
      visible: field.is_visible && applicable,
      required: field.is_visible && field.is_required && applicable,
      label: field.label,
    };
  }

  function clearFieldErrors(form: HTMLFormElement) {
    form.querySelectorAll(".fieldInvalid").forEach((element) => element.classList.remove("fieldInvalid"));
    form.querySelectorAll(".fieldErrorGroup").forEach((element) => element.classList.remove("fieldErrorGroup"));
  }

  function showMissingField(form: HTMLFormElement, control: HTMLElement, label: string) {
    control.classList.add("fieldInvalid");
    control.closest("label, .requestOptions, .registrationType")?.classList.add("fieldErrorGroup");
    setStatus("error");
    setMessage(`${label} zorunlu alandır. Lütfen kırmızı kutu içerisindeki alanı doldurunuz.`);
    window.setTimeout(() => control.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) control.focus({ preventScroll: true });
  }

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

    const shortName = group.name
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean)
      .find((part) => !options.branches.some((branch) => branch.name === part) && !/\d{1,2}:\d{2}/.test(part) && !/(pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)/i.test(part)) || group.course_type;

    return `${dayText || "Gün tanımsız"} · ${time} · ${shortName}`;
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const formElement =
      event.currentTarget;

    clearFieldErrors(formElement);
    const invalidControl = Array.from(formElement.elements).find((element) => {
      return element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
        ? !element.checkValidity()
        : false;
    }) as HTMLElement | undefined;

    if (invalidControl) {
      const fieldNames: Record<string, string> = {
        firstName: "Öğrenci / katılımcı adı",
        lastName: "Soyadı",
        birthDate: "Doğum tarihi",
        guardianName: "Veli adı soyadı",
        phone: "Telefon",
        email: "E-posta",
        guardianEmail: "Veli e-posta",
        courseType: "Kurs türü",
        branchId: "Şube",
        groupId: "Grup",
        swimmingLevel: "Yüzme seviyesi",
        packageId: "Paket tercihi",
        contactRequest: "İletişim talebi",
        healthDeclaration: "Sağlık beyanı",
        rulesAccepted: "Kurallar onayı",
        whatsappPermission: "WhatsApp bilgilendirme onayı",
      };
      const name = invalidControl.getAttribute("name") || "Bu alan";
      showMissingField(formElement, invalidControl, fieldNames[name] || "Bu alan");
      return;
    }

    setStatus("sending");
    setMessage("Ön kaydınız tamamlanıyor. Bilgileriniz güvenli şekilde kayıt ekibimize iletiliyor…");

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
        const serverField = result.field ? formElement.elements.namedItem(String(result.field)) : null;
        if (serverField instanceof HTMLElement) {
          showMissingField(formElement, serverField, result.error || "Bu alan");
          return;
        }
        throw new Error(result.error || "Kayıt oluşturulamadı.");
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
              <Image src="/sprint-logo.png" alt="Sprint Yüzme Okulu" width={78} height={78} style={{ objectFit: "contain" }} />
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
                Ön Kaydınız Başarıyla Alındı
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
                ["users", "Butik gruplar", "Kontenjan sınırlı eğitim"],
                ["award", "Uzman antrenörler", "Deneyimli ve sertifikalı kadro"],
                ["bolt", "Hızlı dönüş", "Başvurunuz kayıtsız kalmaz"],
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
                    <SuccessIcon name={icon as "users" | "award" | "bolt"} />
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
                Ön Kaydınız Alındı
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
                  <SuccessIcon name="clock" />
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
                Başvurunuz için teşekkür ederiz.
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
                <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 8 }}><SuccessIcon name="refresh" size={18} /></span>
                Yeni Kayıt Oluştur
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
                Sizi en kısa sürede aramızda görmek için sabırsızlanıyoruz.
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
      noValidate
      onInput={(event) => {
        const target = event.target as HTMLElement;
        target.classList.remove("fieldInvalid");
        target.closest("label, .requestOptions, .registrationType")?.classList.remove("fieldErrorGroup");
      }}
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
          {fieldSetting("first_name", true, true).visible ? <label>
            <FieldLabel text={fieldSetting("first_name").label || "Öğrenci / Katılımcı adı"} required={fieldSetting("first_name", true, true).required} />

            <input
              name="firstName"
              required={fieldSetting("first_name", true, true).required}
              maxLength={60}
              placeholder="Adı"
            />
          </label> : null}

          {fieldSetting("last_name", true, true).visible ? <label>
            <FieldLabel text={fieldSetting("last_name").label || "Soyadı"} required={fieldSetting("last_name", true, true).required} />

            <input
              name="lastName"
              required={fieldSetting("last_name", true, true).required}
              maxLength={60}
              placeholder="Soyadı"
            />
          </label> : null}

          {fieldSetting("birth_date", true, true).visible ? <label>
            <FieldLabel text={fieldSetting("birth_date").label || "Doğum tarihi"} required={fieldSetting("birth_date", true, true).required} />

            <input
              name="birthDate"
              type="date"
              required={fieldSetting("birth_date", true, true).required}
            />
          </label> : null}

          {registrationFor ===
            "child" && fieldSetting("guardian_name", true, true).visible && (
            <label>
              <FieldLabel text={fieldSetting("guardian_name").label || "Veli adı soyadı"} required={fieldSetting("guardian_name", true, true).required} />

              <input
                name="guardianName"
                required={fieldSetting("guardian_name", true, true).required}
                maxLength={120}
                placeholder="Veli adı soyadı"
              />
            </label>
          )}

          {fieldSetting("phone", true, true).visible ? <label>
            <FieldLabel text={fieldSetting("phone").label || "Telefon"} required={fieldSetting("phone", true, true).required} />

            <input
              name="phone"
              type="tel"
              required={fieldSetting("phone", true, true).required}
              inputMode="tel"
              autoComplete="tel"
              placeholder="05xx xxx xx xx"
              maxLength={20}
              pattern="(?:\+90|0)?5\d{9}"
              title="Telefon numarasını 05XXXXXXXXX veya +905XXXXXXXXX formatında giriniz."
            />
          </label> : null}

          {fieldSetting("email", false, false).visible ? <label>
            <FieldLabel text={fieldSetting("email").label || "Öğrenci / katılımcı e-posta"} required={fieldSetting("email", false, false).required} />
            <input name="email" type="email" autoComplete="email" required={fieldSetting("email", false, false).required} placeholder="ornek@eposta.com" />
          </label> : null}

          {registrationFor === "child" && fieldSetting("guardian_email", false, false).visible ? <label>
            <FieldLabel text={fieldSetting("guardian_email").label || "Veli e-posta"} required={fieldSetting("guardian_email", false, false).required} />
            <input name="guardianEmail" type="email" autoComplete="email" required={fieldSetting("guardian_email", false, false).required} placeholder="veli@eposta.com" />
          </label> : null}
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
            {fieldSetting("course_type", true, true).visible ? <label>
              <FieldLabel text={fieldSetting("course_type").label || "Kurs türü"} required={fieldSetting("course_type", true, true).required} />

              <select
                name="courseType"
                required={fieldSetting("course_type", true, true).required}
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
            </label> : null}

            {fieldSetting("branch", true, true).visible ? <label>
              <FieldLabel text={fieldSetting("branch").label || "Şube"} required={fieldSetting("branch", true, true).required} />

              <select
                name="branchId"
                required={fieldSetting("branch", true, true).required}
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
            </label> : null}

            {fieldSetting("group", true, true).visible ? <label className="wideGroupSelect">
              <FieldLabel text={fieldSetting("group").label || "Aktif grup, gün ve saat"} required={fieldSetting("group", true, true).required} />

              <select
                name="groupId"
                required={fieldSetting("group", true, true).required}
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
            </label> : null}

            {fieldSetting("swimming_level", true, false).visible ? <label>
              <FieldLabel text={fieldSetting("swimming_level").label || "Yüzme seviyesi"} required={fieldSetting("swimming_level", true, false).required} />

              <select
                name="swimmingLevel"
                required={fieldSetting("swimming_level", true, false).required}
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
            </label> : null}

            {fieldSetting("package", true, true).visible ? <label>
              <FieldLabel text={fieldSetting("package").label || "Paket tercihi"} required={fieldSetting("package", true, true).required} />

              <select
                name="packageId"
                defaultValue=""
                required={fieldSetting("package", true, true).required}
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
            </label> : null}
          </div>
        )}

        {selectedGroup ? (
          <div className="selectedGroupCard">
            <div>
              <span>
                SEÇİLEN GRUP
              </span>

              <strong>{groupLabel(selectedGroup)}</strong>

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

      {fieldSetting("contact_request", true, true).visible ? <section className="formSection">
        <div className="formSectionTitle">
          <b>3</b>

          <div>
            <strong>
              <FieldLabel text={fieldSetting("contact_request").label || "İletişim talebiniz"} required={fieldSetting("contact_request", true, true).required} />
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
              required={fieldSetting("contact_request", true, true).required}
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
      </section> : null}

      {fieldSetting("note", true, false).visible ? <section className="formSection">
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
          <FieldLabel text={fieldSetting("note").label || "Açıklama / özel durum"} required={fieldSetting("note", true, false).required} />

          <textarea
            name="note"
            required={fieldSetting("note", true, false).required}
            rows={4}
            maxLength={1000}
            placeholder="Su korkusu veya kayıtla ilgili eklemek istediğiniz not..."
          />
        </label>
      </section> : null}

      {(fieldSetting("health_declaration", true, true).visible || fieldSetting("health_note", true, false).visible) ? <section className="formSection">
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

        {fieldSetting("health_declaration", true, true).visible ? <label className="consent">
          <input
            type="checkbox"
            name="healthDeclaration"
            value="true"
            required={fieldSetting("health_declaration", true, true).required}
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
        </label> : null}

        {fieldSetting("health_note", true, false).visible ? <label className="fullWidth">
          <FieldLabel text={fieldSetting("health_note").label || "Sağlıkla ilgili açıklama"} required={fieldSetting("health_note", true, false).required} />
          <textarea
            name="healthNote"
            required={fieldSetting("health_note", true, false).required}
            rows={3}
            maxLength={1000}
            placeholder="Varsa alerji, kronik rahatsızlık, özel gereksinim veya antrenörün bilmesi gereken durumu yazınız. Yoksa boş bırakabilirsiniz."
          />
        </label> : null}
      </section> : null}

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

        {fieldSetting("rules_accepted", true, true).visible ? <label className="consent">
          <input
            type="checkbox"
            name="rulesAccepted"
            value="true"
            required={fieldSetting("rules_accepted", true, true).required}
          />

          <span>
            Sprint Yüzme Okulu
            kurallarını okudum,
            anladım ve kabul ediyorum.
          </span>
        </label> : null}

        {fieldSetting("whatsapp_permission", true, true).visible ? <label className="consent">
          <input
            type="checkbox"
            name="whatsappPermission"
            value="true"
            required={fieldSetting("whatsapp_permission", true, true).required}
          />

          <span>
            Kayıt süreci, ders programı ve kurs
            bilgilendirmelerinin bu formda belirttiğim
            telefon numarasına WhatsApp üzerinden
            gönderilmesini kabul ediyorum.
          </span>
        </label> : null}
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

      {status === "error" && message ? (
        <div className="formValidationAlert" role="alert">
          <strong>Eksik veya hatalı bilgi var</strong>
          <span>{message}</span>
        </div>
      ) : null}

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

      {status === "sending" ? (
        <div className="submittingOverlay" role="status" aria-live="polite" aria-modal="true">
          <div className="submittingCard">
            <span className="submitSpinner" aria-hidden="true" />
            <strong>Ön kaydınız tamamlanıyor</strong>
            <p>Bilgileriniz güvenli şekilde kayıt ekibimize iletiliyor. Lütfen bu ekranı kapatmayın.</p>
          </div>
        </div>
      ) : null}
    </form>
  );
}

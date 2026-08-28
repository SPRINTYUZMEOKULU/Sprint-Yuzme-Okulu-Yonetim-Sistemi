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
  course_type: string | null;
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

type RegistrationFor = "child" | "adult";
type FieldErrors = Record<string, string>;

const days = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

const FIELD_LABELS: Record<string, string> = {
  firstName: "Öğrenci / katılımcı adı",
  lastName: "Soyadı",
  guardianName: "Veli adı soyadı",
  phone: "Telefon",
  courseType: "Kurs türü",
  branchId: "Şube",
  groupId: "Aktif grup, gün ve saat",
  packageId: "Paket tercihi",
  contactRequest: "İletişim talebi",
  healthDeclaration: "Sağlık beyanı",
  rulesAccepted: "Kurallar onayı",
  whatsappPermission: "WhatsApp bilgilendirme onayı",
};

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .trim();
}

function matchesRegistrationFor(
  courseType: string,
  registrationFor: RegistrationFor
) {
  const normalized = normalizeText(courseType);

  if (registrationFor === "child") {
    return normalized.includes("cocuk");
  }

  return normalized.includes("yetiskin");
}

function money(value: number) {
  return Number(value || 0).toLocaleString("tr-TR");
}

export default function PreRegistrationForm() {
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const [options, setOptions] = useState<Options>({
    branches: [],
    groups: [],
    schedules: [],
    packages: [],
    levels: [],
  });

  const [loading, setLoading] = useState(true);
  const [registrationFor, setRegistrationFor] =
    useState<RegistrationFor>("child");
  const [courseType, setCourseType] = useState("");
  const [branchId, setBranchId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [packageId, setPackageId] = useState("");

  useEffect(() => {
    fetch("/api/public-registration-options", {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }

        setOptions({
          branches: data.branches || [],
          groups: data.groups || [],
          schedules: data.schedules || [],
          packages: data.packages || [],
          levels: data.levels || [],
        });
      })
      .catch((error) => {
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Grup ve saat seçenekleri yüklenemedi. Lütfen daha sonra tekrar deneyin."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const allCourseTypes = useMemo(
    () =>
      Array.from(
        new Set(
          options.groups
            .map((group) => group.course_type)
            .filter(Boolean)
        )
      ),
    [options.groups]
  );

  const courseTypes = useMemo(() => {
    const matched = allCourseTypes.filter((type) =>
      matchesRegistrationFor(type, registrationFor)
    );

    return matched.length ? matched : allCourseTypes;
  }, [allCourseTypes, registrationFor]);

  useEffect(() => {
    if (!courseTypes.length) return;

    if (!courseTypes.includes(courseType)) {
      setCourseType(courseTypes.length === 1 ? courseTypes[0] : "");
      setBranchId("");
      setGroupId("");
      setPackageId("");
    }
  }, [courseTypes, courseType]);

  const availableBranches = useMemo(
    () =>
      options.branches.filter((branch) =>
        options.groups.some(
          (group) =>
            group.branch_id === branch.id &&
            (!courseType || group.course_type === courseType)
        )
      ),
    [options.branches, options.groups, courseType]
  );

  const availableGroups = useMemo(
    () =>
      options.groups.filter(
        (group) =>
          (!courseType || group.course_type === courseType) &&
          (!branchId || group.branch_id === branchId)
      ),
    [options.groups, courseType, branchId]
  );

  const availablePackages = useMemo(
    () =>
      options.packages.filter(
        (item) => !courseType || item.course_type === courseType
      ),
    [options.packages, courseType]
  );

  const selectedGroup = options.groups.find(
    (group) => group.id === groupId
  );

  const selectedPackage = options.packages.find(
    (item) => item.id === packageId
  );

  const selectedSchedules = options.schedules.filter(
    (schedule) => schedule.group_id === groupId
  );

  const selectedLevel = selectedGroup?.level_id
    ? options.levels.find(
        (level) => level.id === selectedGroup.level_id
      )
    : null;

  function groupLabel(group: Group) {
    const schedules = options.schedules.filter(
      (schedule) => schedule.group_id === group.id
    );

    const dayText = Array.from(
      new Set(
        schedules.map((schedule) => days[schedule.weekday])
      )
    ).join(" – ");

    const time = schedules[0]
      ? `${schedules[0].start_time.slice(0, 5)}–${schedules[0].end_time.slice(0, 5)}`
      : "Saat tanımlanmadı";

    return `${group.name} · ${dayText || "Gün tanımlanmadı"} · ${time}`;
  }

  function clearError(name: string) {
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function errorText(name: string) {
    return errors[name] ? (
      <span className="fieldError" role="alert">
        <span aria-hidden="true">!</span>
        {errors[name]}
      </span>
    ) : null;
  }

  function fieldClass(name: string, extra = "") {
    return `${extra} ${errors[name] ? "hasError" : ""}`.trim();
  }

  function validateForm(form: HTMLFormElement) {
    const nextErrors: FieldErrors = {};
    const required = Array.from(
      form.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("[required]")
    );
    const processedRadioNames = new Set<string>();

    for (const field of required) {
      const name = field.name;
      if (!name) continue;

      if (field instanceof HTMLInputElement && field.type === "radio") {
        if (processedRadioNames.has(name)) continue;
        processedRadioNames.add(name);

        const checked = form.querySelector<HTMLInputElement>(
          `input[type="radio"][name="${name}"]:checked`
        );

        if (!checked) {
          nextErrors[name] = `${FIELD_LABELS[name] || "Bu alan"} seçilmelidir.`;
        }
        continue;
      }

      if (
        field instanceof HTMLInputElement &&
        field.type === "checkbox"
      ) {
        if (!field.checked) {
          nextErrors[name] = `${FIELD_LABELS[name] || "Bu alan"} onaylanmalıdır.`;
        }
        continue;
      }

      if (!field.value.trim()) {
        nextErrors[name] = `${FIELD_LABELS[name] || "Bu alan"} doldurulmalıdır.`;
        continue;
      }

      if (!field.checkValidity()) {
        if (name === "phone") {
          nextErrors[name] =
            "Telefon numarasını 05XXXXXXXXX veya +905XXXXXXXXX formatında giriniz.";
        } else {
          nextErrors[name] = `${FIELD_LABELS[name] || "Bu alan"} geçerli değil.`;
        }
      }
    }

    if (courseType && !availablePackages.length) {
      nextErrors.packageId =
        "Bu kurs türüne bağlı aktif paket bulunmuyor. Lütfen kayıt ekibiyle iletişime geçin.";
    }

    setErrors(nextErrors);

    const firstName = Object.keys(nextErrors)[0];
    if (firstName) {
      window.setTimeout(() => {
        const first = form.querySelector<HTMLElement>(
          `[name="${firstName}"]`
        );
        const wrapper = first?.closest(
          ".fieldWrap, .choiceGroup, .consentWrap"
        );
        (wrapper || first)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        first?.focus({ preventScroll: true });
      }, 80);
      return false;
    }

    return true;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const formElement = event.currentTarget;
    setMessage("");

    if (!validateForm(formElement)) {
      setStatus("error");
      setMessage(
        "Formda eksik veya hatalı bilgiler var. Kırmızı işaretli alanları tamamlayın."
      );
      return;
    }

    setStatus("sending");
    setErrors({});

    const payload = Object.fromEntries(
      new FormData(formElement).entries()
    );

    try {
      const response = await fetch("/api/pre-registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Kayıt oluşturulamadı."
        );
      }

      setStatus("success");
      setMessage(
        "Ön kaydınız başarıyla alınmıştır. Kayıt ekibimiz en kısa sürede sizinle iletişime geçecektir."
      );

      formElement.reset();
      setErrors({});
      setRegistrationFor("child");
      setCourseType("");
      setBranchId("");
      setGroupId("");
      setPackageId("");
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
      <div className="successScreen">
        <div className="successShell">
          <aside className="successAside">
            <div className="brandBox">
              SPRINT
              <small>YÜZME OKULU</small>
            </div>
            <div className="eyebrow">SPRINT YÜZME OKULU</div>
            <h2>
              Yüzmeye ilk adımınız
              <span> burada başlıyor.</span>
            </h2>
            <div className="successInfoCard">
              <strong>🎉 Ön kaydınız başarıyla alındı!</strong>
              <span>
                Başvurunuz kayıt ekibimize ulaştı. En kısa
                sürede sizinle iletişime geçeceğiz.
              </span>
            </div>
            <div className="miniBenefits">
              <div><b>👥</b><span><strong>Butik gruplar</strong><small>Planlı ve kontrollü eğitim</small></span></div>
              <div><b>🏅</b><span><strong>Uzman antrenörler</strong><small>Deneyimli ve sertifikalı kadro</small></span></div>
              <div><b>⚡</b><span><strong>Hızlı dönüş</strong><small>Başvurunuz kayıt ekibine iletildi</small></span></div>
            </div>
          </aside>

          <main className="successMain">
            <section className="successContent">
              <div className="successCheck">✓</div>
              <h1>Ön Kaydınız Alındı! 🎉</h1>
              <p>
                Başvurunuz başarıyla <strong>Sprint Yüzme Okulu</strong>
                {" "}kayıt sistemine iletilmiştir.
              </p>
              <div className="nextStepCard">
                <div>🕒</div>
                <span>
                  Kayıt ekibimiz başvurunuzu inceleyecek ve en kısa
                  sürede sizinle iletişime geçecektir.
                </span>
              </div>
              <button
                type="button"
                className="primaryButton successButton"
                onClick={() => {
                  setStatus("idle");
                  setMessage("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                ↻ Yeni Kayıt Oluştur
              </button>
            </section>
          </main>
        </div>

        <style jsx>{successStyles}</style>
      </div>
    );
  }

  return (
    <form
      className="registrationForm"
      onSubmit={handleSubmit}
      noValidate
      onChange={(event) => {
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        if (target?.name) clearError(target.name);
      }}
    >
      <input
        className="hiddenField"
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
      />

      <div className="formTopNote">
        <div className="formTopIcon">✓</div>
        <div>
          <strong>Akıllı Ön Kayıt Formu</strong>
          <span>
            Seçimlerinize göre yalnızca uygun şube, grup ve paketler gösterilir.
            Eksik bir alan varsa sistem sizi doğrudan ilgili bölüme yönlendirir.
          </span>
        </div>
      </div>

      <section className="formSection">
        <SectionTitle
          number="1"
          title="Öğrenci / Katılımcı bilgileri"
          subtitle="Kimin için kayıt oluşturduğunuzu seçin"
        />

        <div className="registrationType">
          <label className={registrationFor === "child" ? "selected" : ""}>
            <input
              type="radio"
              name="registrationFor"
              value="child"
              checked={registrationFor === "child"}
              onChange={() => {
                setRegistrationFor("child");
                setCourseType("");
                setBranchId("");
                setGroupId("");
                setPackageId("");
              }}
            />
            <span className="choiceCheck">✓</span>
            <strong>Çocuğum için</strong>
            <span>Veli olarak çocuğunuz için ön kayıt oluşturun.</span>
          </label>

          <label className={registrationFor === "adult" ? "selected" : ""}>
            <input
              type="radio"
              name="registrationFor"
              value="adult"
              checked={registrationFor === "adult"}
              onChange={() => {
                setRegistrationFor("adult");
                setCourseType("");
                setBranchId("");
                setGroupId("");
                setPackageId("");
              }}
            />
            <span className="choiceCheck">✓</span>
            <strong>Kendim için / Yetişkin</strong>
            <span>18 yaş ve üzeri katılımcılar için.</span>
          </label>
        </div>

        <div className="formGrid">
          <label className={fieldClass("firstName", "fieldWrap")}>
            <span className="fieldLabel">Öğrenci / Katılımcı adı <b>*</b></span>
            <input name="firstName" required maxLength={60} placeholder="Adı" />
            {errorText("firstName")}
          </label>

          <label className={fieldClass("lastName", "fieldWrap")}>
            <span className="fieldLabel">Soyadı <b>*</b></span>
            <input name="lastName" required maxLength={60} placeholder="Soyadı" />
            {errorText("lastName")}
          </label>

          <label className="fieldWrap">
            <span className="fieldLabel">Doğum tarihi</span>
            <input name="birthDate" type="date" />
          </label>

          {registrationFor === "child" && (
            <label className={fieldClass("guardianName", "fieldWrap")}>
              <span className="fieldLabel">Veli adı soyadı <b>*</b></span>
              <input
                name="guardianName"
                required
                maxLength={120}
                placeholder="Veli adı soyadı"
              />
              {errorText("guardianName")}
            </label>
          )}

          <label className={fieldClass("phone", "fieldWrap")}>
            <span className="fieldLabel">Telefon <b>*</b></span>
            <input
              name="phone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="05xx xxx xx xx"
              maxLength={20}
              pattern="(?:\+90|0)?5\d{9}"
            />
            {errorText("phone")}
          </label>
        </div>
      </section>

      <section className="formSection">
        <SectionTitle
          number="2"
          title="Kurs, grup ve paket tercihi"
          subtitle="Seçiminize uygun seçenekler otomatik olarak filtrelenir"
        />

        {loading ? (
          <div className="optionsLoading">
            <span className="spinner" />
            Aktif kayıt seçenekleri yükleniyor…
          </div>
        ) : (
          <div className="formGrid">
            <label className={fieldClass("courseType", "fieldWrap")}>
              <span className="fieldLabel">Kurs türü <b>*</b></span>
              <select
                name="courseType"
                required
                value={courseType}
                onChange={(event) => {
                  setCourseType(event.target.value);
                  setBranchId("");
                  setGroupId("");
                  setPackageId("");
                }}
              >
                <option value="" disabled>Seçiniz</option>
                {courseTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <small className="fieldHelp">
                {registrationFor === "child"
                  ? "Çocuk kaydı için uygun kurslar gösteriliyor."
                  : "Yetişkin kaydı için uygun kurslar gösteriliyor."}
              </small>
              {errorText("courseType")}
            </label>

            <label className={fieldClass("branchId", "fieldWrap")}>
              <span className="fieldLabel">Şube <b>*</b></span>
              <select
                name="branchId"
                required
                value={branchId}
                disabled={!courseType}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setGroupId("");
                }}
              >
                <option value="" disabled>
                  {courseType ? "Şube seçin" : "Önce kurs türünü seçin"}
                </option>
                {availableBranches.map((branch) => (
                  <option value={branch.id} key={branch.id}>{branch.name}</option>
                ))}
              </select>
              {errorText("branchId")}
            </label>

            <label className={fieldClass("groupId", "fieldWrap wideGroupSelect")}>
              <span className="fieldLabel">Aktif grup, gün ve saat <b>*</b></span>
              <select
                name="groupId"
                required
                value={groupId}
                disabled={!branchId}
                onChange={(event) => setGroupId(event.target.value)}
              >
                <option value="" disabled>
                  {branchId ? "Grup seçin" : "Önce şube seçin"}
                </option>
                {availableGroups.map((group) => (
                  <option value={group.id} key={group.id}>{groupLabel(group)}</option>
                ))}
              </select>
              {errorText("groupId")}
            </label>

            <label className="fieldWrap">
              <span className="fieldLabel">Yüzme seviyesi</span>
              <select name="swimmingLevel" defaultValue="">
                <option value="">Seçiniz</option>
                {options.levels.map((level) => (
                  <option key={level.id} value={level.name}>{level.name}</option>
                ))}
                <option value="Bilmiyorum">Bilmiyorum</option>
              </select>
            </label>

            <label className={fieldClass("packageId", "fieldWrap")}>
              <span className="fieldLabel">Paket tercihi <b>*</b></span>
              <select
                name="packageId"
                required
                value={packageId}
                disabled={!courseType || !availablePackages.length}
                onChange={(event) => setPackageId(event.target.value)}
              >
                <option value="" disabled>
                  {!courseType
                    ? "Önce kurs türünü seçin"
                    : availablePackages.length
                      ? "Paket seçin"
                      : "Bu kurs için aktif paket yok"}
                </option>
                {availablePackages.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.lesson_count} ders
                    {item.price ? ` · ${money(item.price)} ₺` : ""}
                  </option>
                ))}
              </select>
              <small className="fieldHelp">
                Yalnızca <strong>{courseType || "seçtiğiniz kurs türüne"}</strong> bağlı aktif paketler gösterilir.
              </small>
              {errorText("packageId")}
            </label>
          </div>
        )}

        {selectedGroup && (
          <div className="selectedGroupCard">
            <div className="selectedGroupHead">
              <div>
                <span>SEÇİLEN GRUP</span>
                <strong>{selectedGroup.name}</strong>
                <small>
                  {options.branches.find((branch) => branch.id === selectedGroup.branch_id)?.name}
                  {" · "}{selectedGroup.course_type}
                </small>
              </div>
              <div className="selectedBadge">✓ Seçildi</div>
            </div>

            <div className="selectedSchedule">
              {selectedSchedules.map((schedule) => (
                <span key={schedule.id}>
                  <b>{days[schedule.weekday]}</b>
                  {schedule.start_time.slice(0, 5)}–{schedule.end_time.slice(0, 5)}
                </span>
              ))}
            </div>

            <div className="selectedMeta">
              <span>Kontenjan: <b>{selectedGroup.capacity} kişi</b></span>
              <span>Seviye: <b>{selectedLevel?.name || "Tüm seviyeler"}</b></span>
            </div>

            {selectedGroup.description ? <p>{selectedGroup.description}</p> : null}

            <input
              type="hidden"
              name="branchName"
              value={options.branches.find((branch) => branch.id === selectedGroup.branch_id)?.name || ""}
            />
            <input
              type="hidden"
              name="preferredDays"
              value={selectedSchedules.map((schedule) => days[schedule.weekday]).join(" - ")}
            />
            <input
              type="hidden"
              name="preferredTime"
              value={
                selectedSchedules[0]
                  ? `${selectedSchedules[0].start_time.slice(0, 5)} - ${selectedSchedules[0].end_time.slice(0, 5)}`
                  : ""
              }
            />
          </div>
        )}

        {selectedPackage && (
          <div className="selectedPackageCard">
            <div>
              <span>SEÇİLEN PAKET</span>
              <strong>{selectedPackage.name}</strong>
              <small>{selectedPackage.lesson_count} ders · {selectedPackage.course_type}</small>
            </div>
            <b>{money(selectedPackage.price)} ₺</b>
          </div>
        )}

        {!loading && !options.groups.length && (
          <div className="noGroupWarning">
            Şu anda ön kayda açık grup bulunmuyor. Kayıt ekibimizle iletişime geçebilirsiniz.
          </div>
        )}
      </section>

      <section className="formSection">
        <SectionTitle
          number="3"
          title="İletişim talebiniz"
          subtitle="Ekibimizin size nasıl dönüş yapmasını istediğinizi seçin"
        />

        <div className={fieldClass("contactRequest", "choiceGroup requestOptions")}>
          {[
            ["call_me", "📞", "Beni aramanızı istiyorum"],
            ["whatsapp_info", "💬", "WhatsApp üzerinden detaylı bilgi almak istiyorum"],
            ["ready_to_start", "🏊", "Kaydım tamamlandığında doğrudan kursa başlayacağım"],
            ["need_information", "ℹ️", "Karar vermeden önce detaylı bilgi almak istiyorum"],
          ].map(([value, icon, label], index) => (
            <label key={value}>
              <input
                type="radio"
                name="contactRequest"
                value={value}
                required={index === 0}
              />
              <span className="optionIcon">{icon}</span>
              <span>{label}</span>
              <span className="radioMark">✓</span>
            </label>
          ))}
          {errorText("contactRequest")}
        </div>
      </section>

      <section className="formSection">
        <SectionTitle
          number="4"
          title="Ek bilgiler"
          subtitle="Özel durum ve beklentilerinizi paylaşabilirsiniz"
        />

        <label className="fieldWrap fullWidth">
          <span className="fieldLabel">Açıklama / özel durum</span>
          <textarea
            name="note"
            rows={4}
            maxLength={1000}
            placeholder="Su korkusu veya kayıtla ilgili eklemek istediğiniz not..."
          />
        </label>
      </section>

      <section className="formSection healthSection">
        <SectionTitle
          number="5"
          title="Sağlık beyanı"
          subtitle="Antrenörün bilmesi gereken bir durum varsa ayrıntısını yazın"
        />

        <div className={fieldClass("healthDeclaration", "consentWrap")}>
          <label className="consent">
            <input
              type="checkbox"
              name="healthDeclaration"
              value="true"
              required
            />
            <span className="checkVisual">✓</span>
            <span>
              Öğrenci / katılımcının yüzme eğitimine katılmasına engel teşkil eden,
              antrenörün bilmesi gereken veya güvenliği etkileyebilecek bir sağlık durumu
              varsa aşağıdaki alanda eksiksiz belirteceğimi; aksi durumda bilinen bir engel
              bulunmadığını beyan ediyorum.
            </span>
          </label>
          {errorText("healthDeclaration")}
        </div>

        <div className="healthHint">
          <b>Önemli:</b> Bu kutunun işaretlenmesi “sağlık sorunu var” anlamına gelmez.
          Sağlıkla ilgili özel bir durum varsa aşağıdaki açıklama alanına yazın.
        </div>

        <label className="fieldWrap fullWidth">
          <span className="fieldLabel">Sağlıkla ilgili açıklama</span>
          <textarea
            name="healthNote"
            rows={3}
            maxLength={1000}
            placeholder="Varsa alerji, kronik rahatsızlık, özel gereksinim veya antrenörün bilmesi gereken durumu yazınız. Yoksa boş bırakabilirsiniz."
          />
          <small className="fieldHelp healthHelp">
            Buraya yazılan not SprintOS ön kayıt detayında ayrıca görüntülenecektir.
          </small>
        </label>
      </section>

      <section className="formSection">
        <SectionTitle
          number="6"
          title="Kurallar ve onaylar"
          subtitle="Başvurunuzu tamamlamadan önce bilgilendirmeleri inceleyin"
        />

        <details className="rulesDetails">
          <summary>Sprint Yüzme Okulu Kurallarını Görüntüle</summary>
          <div className="rulesContent">
            <p><strong>1. Telafi dersi:</strong> Hastalık, tatil, izin, şehir dışı veya benzeri bireysel nedenlerle kaçırılan dersler için telafi dersi uygulanmaz. Telafi yalnızca tesis / havuz kaynaklı olarak dersin yapılamadığı durumlarda tanımlanır.</p>
            <p><strong>2. Kayıt dondurma ve ders ekleme:</strong> Bireysel nedenlerle kayıt dondurma, kullanılmayan dersleri ileri tarihe aktarma veya pakete ek ders tanımlama yapılmaz.</p>
            <p><strong>3. Ücret ve indirim:</strong> Başlanan veya planlanan kurs paketlerinde bireysel devamsızlıklara bağlı ücret indirimi, ders başına ücret düşümü veya geriye dönük indirim uygulanmaz.</p>
            <p><strong>4. Grup ve saat düzeni:</strong> Eğitim kalitesi, seviye dengesi, tesis programı ve operasyon ihtiyacına göre grup, saat, kulvar veya antrenör planlaması Sprint Yüzme Okulu tarafından güncellenebilir.</p>
            <p><strong>5. Sağlık ve güvenlik:</strong> Öğrenci / katılımcının antrenör tarafından bilinmesi gereken sağlık, alerji, özel gereksinim veya güvenliği etkileyebilecek durumları kayıt öncesinde bildirmek kursiyer / veli sorumluluğundadır.</p>
            <p><strong>6. Ön kayıt:</strong> Bu formun gönderilmesi kesin kayıt, kesin kontenjan veya ödeme onayı anlamına gelmez. Kesin kayıt, kayıt ekibinin teyidiyle tamamlanır.</p>
          </div>
        </details>

        <div className={fieldClass("rulesAccepted", "consentWrap")}>
          <label className="consent">
            <input type="checkbox" name="rulesAccepted" value="true" required />
            <span className="checkVisual">✓</span>
            <span>Sprint Yüzme Okulu kurallarını okudum, anladım ve kabul ediyorum.</span>
          </label>
          {errorText("rulesAccepted")}
        </div>

        <div className={fieldClass("whatsappPermission", "consentWrap")}>
          <label className="consent">
            <input type="checkbox" name="whatsappPermission" value="true" required />
            <span className="checkVisual">✓</span>
            <span>
              Kayıt süreci, ders programı ve kurs bilgilendirmelerinin bu formda belirttiğim
              telefon numarasına WhatsApp üzerinden gönderilmesini kabul ediyorum.
            </span>
          </label>
          {errorText("whatsappPermission")}
        </div>
      </section>

      <div className="afterSubmitInfo">
        <div>🔄</div>
        <span>
          <strong>Başvurunuz gönderildikten sonra:</strong>{" "}
          Seçtiğiniz şube, grup ve paket bilgileri SprintOS kayıt ekranına otomatik düşer.
          Kayıt ekibimiz başvuruyu kontrol ederek sizinle iletişime geçer.
        </span>
      </div>

      {status === "error" && message && (
        <div className="formMessage error" role="alert">
          <b>!</b>
          <span>{message}</span>
        </div>
      )}

      <div className="submitRow">
        <button
          className="submitButton"
          disabled={status === "sending" || loading || !options.groups.length}
          type="submit"
        >
          {status === "sending" ? (
            <><span className="spinner light" /> Başvurunuz gönderiliyor...</>
          ) : (
            <>Ön Kaydı Tamamla <span>→</span></>
          )}
        </button>
        <small>
          Gönder butonuna bastığınızda eksik alan varsa sistem sizi doğrudan ilgili alana götürür.
        </small>
      </div>

      <style jsx>{formStyles}</style>
    </form>
  );
}

function SectionTitle({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="formSectionTitle">
      <b>{number}</b>
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

const formStyles = `
  .registrationForm {
    width: 100%;
    display: grid;
    gap: 18px;
    color: #0f2440;
  }

  .hiddenField {
    position: absolute !important;
    left: -9999px !important;
    width: 1px !important;
    height: 1px !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }

  .formTopNote {
    display: grid;
    grid-template-columns: 46px 1fr;
    gap: 14px;
    align-items: center;
    padding: 16px 18px;
    border: 1px solid #cfe2ff;
    border-radius: 18px;
    background: linear-gradient(135deg, #f6faff, #eef6ff);
    box-shadow: 0 8px 24px rgba(28, 88, 160, .08);
  }

  .formTopIcon {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: linear-gradient(135deg, #075ee9, #1f7dff);
    color: white;
    font-size: 22px;
    font-weight: 1000;
    box-shadow: 0 10px 24px rgba(7, 94, 233, .25);
  }

  .formTopNote strong,
  .formTopNote span {
    display: block;
  }

  .formTopNote strong {
    font-size: 15px;
    color: #0a438d;
    margin-bottom: 3px;
  }

  .formTopNote span {
    font-size: 13px;
    line-height: 1.55;
    color: #55708f;
  }

  .formSection {
    padding: 24px;
    border: 1px solid #e2eaf4;
    border-radius: 22px;
    background: #ffffff;
    box-shadow: 0 12px 34px rgba(15, 40, 72, .07);
  }

  .formSectionTitle {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 14px;
    align-items: center;
    margin-bottom: 20px;
  }

  .formSectionTitle > b {
    width: 48px;
    height: 48px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(135deg, #073f91, #0b6ff4);
    box-shadow: 0 10px 24px rgba(7, 63, 145, .22);
    font-size: 18px;
  }

  .formSectionTitle strong,
  .formSectionTitle span {
    display: block;
  }

  .formSectionTitle strong {
    font-size: 18px;
    color: #0b315f;
    letter-spacing: -.01em;
  }

  .formSectionTitle span {
    margin-top: 3px;
    color: #71839a;
    font-size: 13px;
    line-height: 1.45;
  }

  .registrationType,
  .requestOptions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .registrationType label,
  .requestOptions label {
    position: relative;
    min-height: 96px;
    padding: 18px;
    border: 1.5px solid #dce6f2;
    border-radius: 18px;
    background: #f9fbfd;
    cursor: pointer;
    transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease;
    user-select: none;
  }

  .registrationType label:hover,
  .requestOptions label:hover {
    transform: translateY(-2px);
    border-color: #8ab9ff;
    box-shadow: 0 12px 24px rgba(29, 95, 180, .12);
  }

  .registrationType label:active,
  .requestOptions label:active {
    transform: translateY(1px) scale(.995);
  }

  .registrationType input,
  .requestOptions input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .registrationType label.selected,
  .requestOptions label:has(input:checked) {
    color: #fff;
    border-color: #0b6ff4;
    background: linear-gradient(135deg, #075ee9, #1878ff);
    box-shadow: 0 14px 30px rgba(11, 111, 244, .25);
  }

  .registrationType label > strong {
    display: block;
    font-size: 15px;
    margin-bottom: 5px;
  }

  .registrationType label > span:last-child {
    display: block;
    font-size: 12px;
    line-height: 1.5;
    color: #70849b;
  }

  .registrationType label.selected > span:last-child {
    color: rgba(255,255,255,.84);
  }

  .choiceCheck,
  .radioMark {
    position: absolute;
    right: 14px;
    top: 14px;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgba(255,255,255,.20);
    color: transparent;
    font-weight: 1000;
  }

  .registrationType label.selected .choiceCheck,
  .requestOptions label:has(input:checked) .radioMark {
    background: white;
    color: #0b6ff4;
  }

  .formGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-top: 18px;
  }

  .fieldWrap {
    display: block;
  }

  .wideGroupSelect,
  .fullWidth {
    grid-column: 1 / -1;
  }

  .fieldLabel {
    display: block;
    margin-bottom: 8px;
    color: #263e5d;
    font-size: 13px;
    font-weight: 850;
  }

  .fieldLabel b {
    color: #ef4444;
  }

  .fieldWrap input,
  .fieldWrap select,
  .fieldWrap textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1.5px solid #dce6f2;
    border-radius: 14px;
    background: #fbfdff;
    color: #17365f;
    font: inherit;
    font-size: 14px;
    outline: none;
    transition: border-color .16s ease, box-shadow .16s ease, background .16s ease, transform .16s ease;
  }

  .fieldWrap input,
  .fieldWrap select {
    min-height: 50px;
    padding: 0 14px;
  }

  .fieldWrap textarea {
    min-height: 112px;
    padding: 14px;
    line-height: 1.55;
    resize: vertical;
  }

  .fieldWrap input:focus,
  .fieldWrap select:focus,
  .fieldWrap textarea:focus {
    border-color: #0b6ff4;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(11, 111, 244, .11);
  }

  .fieldWrap select:disabled {
    cursor: not-allowed;
    background: #f1f5f9;
    color: #94a3b8;
  }

  .fieldWrap.hasError input,
  .fieldWrap.hasError select,
  .fieldWrap.hasError textarea,
  .choiceGroup.hasError,
  .consentWrap.hasError .consent {
    border-color: #ef4444 !important;
    background: #fff7f7 !important;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, .08) !important;
  }

  .fieldError {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 7px;
    color: #c62828;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.4;
  }

  .fieldError > span {
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #ef4444;
    color: white;
    font-size: 11px;
  }

  .fieldHelp {
    display: block;
    margin-top: 6px;
    color: #7a8ea5;
    font-size: 11px;
    line-height: 1.45;
  }

  .optionsLoading {
    min-height: 78px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 1px dashed #bdd4f2;
    border-radius: 16px;
    color: #55708f;
    background: #f8fbff;
    font-weight: 700;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #bed3f2;
    border-top-color: #0b6ff4;
    animation: spin .7s linear infinite;
  }

  .spinner.light {
    border-color: rgba(255,255,255,.45);
    border-top-color: #fff;
  }

  .selectedGroupCard,
  .selectedPackageCard {
    margin-top: 18px;
    border-radius: 18px;
    border: 1px solid #cfe1fb;
    background: linear-gradient(135deg, #f7fbff, #eef6ff);
    box-shadow: 0 10px 26px rgba(20, 77, 145, .08);
  }

  .selectedGroupCard {
    padding: 18px;
  }

  .selectedGroupHead,
  .selectedPackageCard {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .selectedGroupHead span,
  .selectedPackageCard span {
    display: block;
    color: #0b6ff4;
    font-size: 10px;
    letter-spacing: .12em;
    font-weight: 1000;
  }

  .selectedGroupHead strong,
  .selectedPackageCard strong {
    display: block;
    margin-top: 4px;
    color: #0a376f;
    font-size: 17px;
  }

  .selectedGroupHead small,
  .selectedPackageCard small {
    display: block;
    margin-top: 3px;
    color: #72869f;
  }

  .selectedBadge {
    padding: 8px 12px;
    border-radius: 999px;
    color: #0a7a3d;
    background: #e9faef;
    border: 1px solid #b9e9c9;
    font-size: 12px;
    font-weight: 900;
    white-space: nowrap;
  }

  .selectedSchedule {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  .selectedSchedule span {
    display: inline-flex;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 10px;
    color: #274b77;
    background: #fff;
    border: 1px solid #d8e5f4;
    font-size: 12px;
  }

  .selectedMeta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 14px;
    color: #627991;
    font-size: 12px;
  }

  .selectedGroupCard p {
    margin: 14px 0 0;
    color: #61768e;
    font-size: 12px;
    line-height: 1.55;
  }

  .selectedPackageCard {
    padding: 16px 18px;
  }

  .selectedPackageCard > b {
    color: #0b6ff4;
    font-size: 19px;
  }

  .requestOptions {
    position: relative;
  }

  .requestOptions label {
    min-height: 74px;
    display: grid;
    grid-template-columns: 34px 1fr 28px;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 800;
  }

  .optionIcon {
    font-size: 22px;
  }

  .requestOptions .fieldError {
    grid-column: 1 / -1;
  }

  .healthSection {
    border-color: #f3d5a4;
    background: linear-gradient(180deg, #fffdf9, #fff);
  }

  .consentWrap {
    margin-top: 12px;
  }

  .consent {
    position: relative;
    display: grid;
    grid-template-columns: 30px 1fr;
    gap: 12px;
    align-items: start;
    padding: 15px 16px;
    border: 1.5px solid #dce6f2;
    border-radius: 16px;
    background: #fbfdff;
    cursor: pointer;
    transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease, background .16s ease;
  }

  .consent:hover {
    border-color: #8ab9ff;
    box-shadow: 0 8px 20px rgba(29,95,180,.09);
  }

  .consent:active {
    transform: scale(.997);
  }

  .consent input {
    position: absolute;
    opacity: 0;
  }

  .checkVisual {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    border: 2px solid #b9c8da;
    background: white;
    color: transparent;
    font-weight: 1000;
    transition: all .16s ease;
  }

  .consent:has(input:checked) {
    border-color: #0b6ff4;
    background: #f3f8ff;
    box-shadow: 0 8px 20px rgba(11,111,244,.08);
  }

  .consent:has(input:checked) .checkVisual {
    border-color: #0b6ff4;
    background: #0b6ff4;
    color: white;
    box-shadow: 0 6px 16px rgba(11,111,244,.24);
  }

  .consent > span:last-child {
    color: #536b86;
    font-size: 12px;
    line-height: 1.6;
    font-weight: 650;
  }

  .healthHint {
    margin: 12px 0 16px;
    padding: 12px 14px;
    border-radius: 13px;
    border: 1px solid #f3d19a;
    background: #fff8eb;
    color: #8a5a13;
    font-size: 12px;
    line-height: 1.55;
  }

  .healthHelp {
    color: #9a6411;
  }

  .rulesDetails {
    margin-bottom: 14px;
    border: 1px solid #dce6f2;
    border-radius: 16px;
    overflow: hidden;
    background: #fbfdff;
  }

  .rulesDetails summary {
    padding: 15px 16px;
    color: #0b5dc9;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    transition: background .16s ease;
  }

  .rulesDetails summary:hover {
    background: #f1f7ff;
  }

  .rulesContent {
    padding: 0 16px 14px;
    color: #61738a;
    font-size: 12px;
    line-height: 1.6;
  }

  .rulesContent p {
    margin: 10px 0;
  }

  .afterSubmitInfo {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 12px;
    align-items: center;
    padding: 15px 16px;
    border: 1px solid #bfdbfe;
    border-radius: 16px;
    background: #eff6ff;
    color: #274c7f;
    font-size: 12px;
    line-height: 1.55;
  }

  .afterSubmitInfo > div {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 6px 16px rgba(28,88,160,.08);
  }

  .formMessage {
    display: grid;
    grid-template-columns: 30px 1fr;
    gap: 10px;
    align-items: center;
    padding: 14px 16px;
    border-radius: 15px;
    font-size: 13px;
    font-weight: 800;
  }

  .formMessage.error {
    color: #a51f1f;
    background: #fff2f2;
    border: 1px solid #ffc7c7;
  }

  .formMessage b {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #ef4444;
    color: white;
  }

  .submitRow {
    display: grid;
    gap: 9px;
    text-align: center;
  }

  .submitButton,
  .primaryButton {
    min-height: 58px;
    border: 0;
    border-radius: 16px;
    background: linear-gradient(90deg, #075ee9 0%, #1878ff 100%);
    color: white;
    font-size: 15px;
    font-weight: 950;
    cursor: pointer;
    box-shadow: 0 14px 30px rgba(11,111,244,.25);
    transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
  }

  .submitButton:hover,
  .primaryButton:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 34px rgba(11,111,244,.32);
    filter: saturate(1.08);
  }

  .submitButton:active,
  .primaryButton:active {
    transform: translateY(1px) scale(.995);
    box-shadow: 0 8px 18px rgba(11,111,244,.20);
  }

  .submitButton:disabled {
    cursor: not-allowed;
    opacity: .65;
    transform: none;
    box-shadow: none;
  }

  .submitButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
  }

  .submitRow small {
    color: #8494a8;
    font-size: 11px;
  }

  .noGroupWarning {
    margin-top: 14px;
    padding: 14px 16px;
    border-radius: 14px;
    color: #9a5b09;
    background: #fff7e8;
    border: 1px solid #f2d096;
    font-size: 12px;
    font-weight: 750;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 720px) {
    .formSection {
      padding: 18px;
      border-radius: 18px;
    }

    .formGrid,
    .registrationType,
    .requestOptions {
      grid-template-columns: 1fr;
    }

    .formSectionTitle {
      grid-template-columns: 42px 1fr;
    }

    .formSectionTitle > b {
      width: 42px;
      height: 42px;
      border-radius: 13px;
    }

    .selectedGroupHead,
    .selectedPackageCard {
      align-items: flex-start;
      flex-direction: column;
    }

    .selectedPackageCard > b {
      font-size: 18px;
    }
  }
`;

const successStyles = `
  .successScreen {
    position: fixed;
    inset: 0;
    z-index: 9999;
    overflow-y: auto;
    background: #f7fbff;
  }

  .successShell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: minmax(300px, .9fr) minmax(520px, 1.7fr);
  }

  .successAside {
    padding: 52px 40px;
    color: white;
    background: radial-gradient(circle at 40% 24%, rgba(56,145,255,.40), transparent 28%), linear-gradient(180deg,#031f49,#073f91 58%,#032454);
  }

  .brandBox {
    width: 92px;
    height: 92px;
    display: grid;
    place-items: center;
    align-content: center;
    border-radius: 22px;
    background: white;
    color: #0b4e9c;
    font-weight: 1000;
    letter-spacing: .03em;
    box-shadow: 0 16px 45px rgba(0,0,0,.22);
  }

  .brandBox small {
    display: block;
    margin-top: 3px;
    font-size: 9px;
  }

  .eyebrow {
    margin-top: 34px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: .22em;
    opacity: .86;
  }

  .successAside h2 {
    margin: 18px 0 0;
    max-width: 430px;
    font-size: clamp(38px, 4vw, 62px);
    line-height: 1.07;
    letter-spacing: -.045em;
  }

  .successAside h2 span {
    color: #ff9a1f;
  }

  .successInfoCard {
    margin-top: 28px;
    max-width: 430px;
    padding: 18px 20px;
    border-radius: 18px;
    background: rgba(255,255,255,.10);
    border: 1px solid rgba(255,255,255,.18);
    box-shadow: 0 12px 34px rgba(0,0,0,.10);
  }

  .successInfoCard strong,
  .successInfoCard span {
    display: block;
  }

  .successInfoCard strong {
    font-size: 18px;
    margin-bottom: 7px;
  }

  .successInfoCard span {
    font-size: 13px;
    line-height: 1.6;
    opacity: .88;
  }

  .miniBenefits {
    display: grid;
    gap: 10px;
    margin-top: 24px;
    max-width: 430px;
  }

  .miniBenefits > div {
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    border-radius: 15px;
    background: rgba(37,127,225,.20);
    border: 1px solid rgba(255,255,255,.10);
  }

  .miniBenefits b {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: #0b6ff4;
  }

  .miniBenefits strong,
  .miniBenefits small {
    display: block;
  }

  .miniBenefits strong { font-size: 14px; }
  .miniBenefits small { margin-top: 2px; font-size: 11px; opacity: .75; }

  .successMain {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 46px 30px;
    background: radial-gradient(circle at 50% 30%, rgba(103,232,162,.14), transparent 26%), linear-gradient(180deg,#f9fbff,#fff);
  }

  .successContent {
    width: min(100%, 700px);
    text-align: center;
  }

  .successCheck {
    width: 124px;
    height: 124px;
    margin: 0 auto 30px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: white;
    border: 10px solid #dffbe8;
    color: #22c55e;
    font-size: 68px;
    font-weight: 1000;
    box-shadow: 0 0 0 14px rgba(34,197,94,.09), 0 18px 50px rgba(34,197,94,.20);
    animation: pop .55s cubic-bezier(.2,.9,.3,1.3) both;
  }

  .successContent h1 {
    margin: 0;
    color: #07356f;
    font-size: clamp(36px, 5vw, 60px);
    line-height: 1.08;
    letter-spacing: -.04em;
  }

  .successContent p {
    margin: 20px auto 0;
    max-width: 600px;
    color: #64748b;
    font-size: 16px;
    line-height: 1.7;
  }

  .successContent p strong { color: #0b6ff4; }

  .nextStepCard {
    margin: 26px auto 0;
    max-width: 620px;
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 14px;
    align-items: center;
    padding: 18px 20px;
    text-align: left;
    border: 1px solid #dfe7f1;
    border-radius: 18px;
    background: white;
    box-shadow: 0 12px 36px rgba(15,23,42,.08);
  }

  .nextStepCard > div {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: #e9fbef;
    font-size: 22px;
  }

  .nextStepCard span {
    color: #334155;
    font-size: 14px;
    line-height: 1.55;
    font-weight: 700;
  }

  .primaryButton {
    width: min(100%, 620px);
    margin-top: 28px;
  }

  @keyframes pop {
    from { opacity: 0; transform: scale(.68) rotate(-6deg); }
    to { opacity: 1; transform: scale(1) rotate(0); }
  }

  @media (max-width: 900px) {
    .successShell { grid-template-columns: 1fr; }
    .successAside { padding: 34px 24px; }
    .successMain { min-height: auto; padding: 42px 20px 56px; }
  }
`;

"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   TYPES
   ========================================================= */

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

type FieldOption = {
  value: string;
  label: string;
};

type FormField = {
  id: string;
  field_key: string;
  section_key: string;
  label: string;
  field_type:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "phone"
    | "select"
    | "radio"
    | "checkbox"
    | "multiselect"
    | "info";

  placeholder: string | null;
  help_text: string | null;

  options:
    | FieldOption[]
    | null;

  is_visible: boolean;
  is_required: boolean;
  is_system: boolean;
  is_deletable: boolean;

  applies_to:
    | "all"
    | "child"
    | "adult";

  sort_order: number;
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

type SubmitStatus =
  | "idle"
  | "sending"
  | "success"
  | "error";

/* =========================================================
   SABİTLER
   ========================================================= */

const days = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

const fallbackFieldSettings: Record<
  string,
  Partial<FormField>
> = {
  registration_for: {
    label: "Kimin İçin Kayıt?",
    is_visible: true,
    is_required: true,
  },

  first_name: {
    label:
      "Öğrenci / Katılımcı Adı",
    is_visible: true,
    is_required: true,
  },

  last_name: {
    label: "Soyadı",
    is_visible: true,
    is_required: true,
  },

  birth_date: {
    label: "Doğum Tarihi",
    is_visible: true,
    is_required: true,
  },

  guardian_name: {
    label: "Veli Adı Soyadı",
    is_visible: true,
    is_required: true,
  },

  phone: {
    label: "Telefon",
    is_visible: true,
    is_required: true,
  },

  course_type: {
    label: "Kurs Türü",
    is_visible: true,
    is_required: true,
  },

  branch: {
    label: "Şube",
    is_visible: true,
    is_required: true,
  },

  group: {
    label:
      "Aktif Grup, Gün ve Saat",
    is_visible: true,
    is_required: true,
  },

  swimming_level: {
    label: "Yüzme Seviyesi",
    is_visible: true,
    is_required: false,
  },

  package: {
    label: "Paket Tercihi",
    is_visible: true,
    is_required: true,
  },

  contact_request: {
    label: "İletişim Talebiniz",
    is_visible: true,
    is_required: true,
  },

  general_note: {
    label:
      "Açıklama / Özel Durum",
    is_visible: true,
    is_required: false,
  },

  health_declaration: {
    label: "Sağlık Beyanı",
    is_visible: true,
    is_required: true,
  },

  health_note: {
    label:
      "Bildirilmesi Gereken Sağlık Bilgisi",
    is_visible: true,
    is_required: false,
  },

  rules_accepted: {
    label:
      "Sprint Yüzme Okulu Kuralları",
    is_visible: true,
    is_required: true,
  },

  whatsapp_permission: {
    label:
      "WhatsApp Bilgilendirme İzni",
    is_visible: true,
    is_required: true,
  },
};

/* =========================================================
   YARDIMCI FONKSİYONLAR
   ========================================================= */

function RequiredMark({
  required,
}: {
  required: boolean;
}) {
  if (!required) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      style={{
        color: "#e53935",
        marginLeft: 4,
        fontWeight: 900,
      }}
    >
      *
    </span>
  );
}

function formatBirthDateInput(
  value: string
) {
  const digits =
    value
      .replace(/\D/g, "")
      .slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(
      0,
      2
    )}/${digits.slice(2)}`;
  }

  return `${digits.slice(
    0,
    2
  )}/${digits.slice(
    2,
    4
  )}/${digits.slice(4)}`;
}

function normalizeBirthDate(
  value: string
) {
  if (!value.trim()) {
    return null;
  }

  const match =
    value.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/
    );

  if (!match) {
    return null;
  }

  const day =
    Number(match[1]);

  const month =
    Number(match[2]);

  const year =
    Number(match[3]);

  if (
    day < 1 ||
    month < 1 ||
    month > 12 ||
    year < 1900
  ) {
    return null;
  }

  const test =
    new Date(
      year,
      month - 1,
      day
    );

  if (
    test.getFullYear() !== year ||
    test.getMonth() !==
      month - 1 ||
    test.getDate() !== day
  ) {
    return null;
  }

  return `${String(
    year
  ).padStart(
    4,
    "0"
  )}-${String(
    month
  ).padStart(
    2,
    "0"
  )}-${String(
    day
  ).padStart(
    2,
    "0"
  )}`;
}

function safeOptions(
  value: unknown
): FieldOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (
        typeof item ===
        "string"
      ) {
        return {
          value: item,
          label: item,
        };
      }

      if (
        item &&
        typeof item ===
          "object"
      ) {
        const row =
          item as Record<
            string,
            unknown
          >;

        return {
          value: String(
            row.value ?? ""
          ),
          label: String(
            row.label ??
              row.value ??
              ""
          ),
        };
      }

      return {
        value: "",
        label: "",
      };
    })
    .filter(
      (item) =>
        item.value &&
        item.label
    );
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function PreRegistrationForm() {
  const [
    status,
    setStatus,
  ] =
    useState<SubmitStatus>(
      "idle"
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    options,
    setOptions,
  ] =
    useState<Options>({
      branches: [],
      groups: [],
      schedules: [],
      packages: [],
      levels: [],
      formFields: [],
      visibleFormFields: [],
    });

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    registrationFor,
    setRegistrationFor,
  ] =
    useState<RegistrationFor>(
      "child"
    );

  const [
    courseType,
    setCourseType,
  ] =
    useState("");

  const [
    branchId,
    setBranchId,
  ] =
    useState("");

  const [
    groupId,
    setGroupId,
  ] =
    useState("");

  const [
    packageId,
    setPackageId,
  ] =
    useState("");

  const [
    birthDateInput,
    setBirthDateInput,
  ] =
    useState("");

  /* =======================================================
     API YÜKLE
     ======================================================= */

  useEffect(() => {
    fetch(
      "/api/public-registration-options",
      {
        cache: "no-store",
      }
    )
      .then(async (
        response
      ) => {
        const data =
          await response.json();

        if (
          !response.ok ||
          data.error
        ) {
          throw new Error(
            data.error ||
              "Form seçenekleri yüklenemedi."
          );
        }

        return data;
      })
      .then((data) => {
        setOptions({
          branches:
            data.branches ||
            [],

          groups:
            data.groups ||
            [],

          schedules:
            data.schedules ||
            [],

          packages:
            data.packages ||
            [],

          levels:
            data.levels ||
            [],

          formFields:
            data.formFields ||
            [],

          visibleFormFields:
            data.visibleFormFields ||
            [],
        });
      })
      .catch((error) => {
        console.error(
          error
        );

        setStatus("error");

        setMessage(
          "Ön kayıt formu seçenekleri yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  /* =======================================================
     FIELD AYARLARI
     ======================================================= */

  function getField(
    key: string
  ): FormField | null {
    const fromDatabase =
      options.formFields.find(
        (field) =>
          field.field_key ===
          key
      );

    if (fromDatabase) {
      return {
        ...fromDatabase,
        options:
          safeOptions(
            fromDatabase.options
          ),
      };
    }

    const fallback =
      fallbackFieldSettings[
        key
      ];

    if (!fallback) {
      return null;
    }

    return {
      id:
        `fallback-${key}`,

      field_key:
        key,

      section_key:
        "general",

      label:
        fallback.label ||
        key,

      field_type:
        "text",

      placeholder:
        null,

      help_text:
        null,

      options:
        [],

      is_visible:
        fallback.is_visible !==
        false,

      is_required:
        fallback.is_required ===
        true,

      is_system:
        true,

      is_deletable:
        false,

      applies_to:
        "all",

      sort_order:
        999,
    };
  }

  function appliesToCurrent(
    field:
      | FormField
      | null
  ) {
    if (!field) {
      return false;
    }

    if (
      field.applies_to ===
      "all"
    ) {
      return true;
    }

    return (
      field.applies_to ===
      registrationFor
    );
  }

  function fieldVisible(
    key: string
  ) {
    const field =
      getField(key);

    if (!field) {
      return false;
    }

    return (
      field.is_visible &&
      appliesToCurrent(
        field
      )
    );
  }

  function fieldRequired(
    key: string
  ) {
    const field =
      getField(key);

    if (
      !field ||
      !field.is_visible ||
      !appliesToCurrent(
        field
      )
    ) {
      return false;
    }

    return (
      field.is_required ===
      true
    );
  }

  function fieldLabel(
    key: string,
    fallback: string
  ) {
    return (
      getField(key)?.label ||
      fallback
    );
  }

  function fieldPlaceholder(
    key: string,
    fallback = ""
  ) {
    return (
      getField(key)
        ?.placeholder ||
      fallback
    );
  }

  /* =======================================================
     KURS FİLTRELERİ
     ======================================================= */

  const courseTypes =
    useMemo(
      () =>
        Array.from(
          new Set(
            options.groups
              .map(
                (group) =>
                  group.course_type
              )
              .filter(Boolean)
          )
        ),
      [
        options.groups,
      ]
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
        options.branches,
        options.groups,
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
        options.groups,
        courseType,
        branchId,
      ]
    );

  /*
   * Paket tablosunda henüz course_type bağlantısı
   * olmadığı için isim üzerinden güvenli bir
   * ilk filtre uyguluyoruz.
   *
   * "Yetişkin" yazan paket çocukta,
   * "Çocuk" yazan paket yetişkinde gösterilmez.
   *
   * Daha sonra paket tablosuna course_type
   * kolonu bağlayabiliriz.
   */

  const availablePackages =
    useMemo(
      () =>
        options.packages.filter(
          (item) => {
            const name =
              item.name.toLocaleLowerCase(
                "tr-TR"
              );

            if (
              registrationFor ===
              "child" &&
              name.includes(
                "yetişkin"
              )
            ) {
              return false;
            }

            if (
              registrationFor ===
              "adult" &&
              name.includes(
                "çocuk"
              )
            ) {
              return false;
            }

            return true;
          }
        ),
      [
        options.packages,
        registrationFor,
      ]
    );

  const selectedGroup =
    options.groups.find(
      (group) =>
        group.id ===
        groupId
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

    const timeText =
      schedules.length
        ? Array.from(
            new Set(
              schedules.map(
                (schedule) =>
                  `${schedule.start_time.slice(
                    0,
                    5
                  )}–${schedule.end_time.slice(
                    0,
                    5
                  )}`
              )
            )
          ).join(" / ")
        : "Saat tanımlanmadı";

    return `${group.name} · ${
      dayText ||
      "Gün tanımlanmadı"
    } · ${timeText}`;
  }

  /* =======================================================
     ÖZEL ALANLAR
     ======================================================= */

  const customFields =
    useMemo(
      () =>
        options.formFields
          .filter(
            (field) =>
              !field.is_system &&
              field.is_visible
          )
          .filter(
            (field) =>
              field.applies_to ===
                "all" ||
              field.applies_to ===
                registrationFor
          )
          .sort(
            (a, b) =>
              a.sort_order -
              b.sort_order
          ),
      [
        options.formFields,
        registrationFor,
      ]
    );

  /* =======================================================
     SUBMIT
     ======================================================= */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setStatus("idle");
    setMessage("");

    const formElement =
      event.currentTarget;

    const formData =
      new FormData(
        formElement
      );

    /*
     * DOĞUM TARİHİ
     */

    if (
      fieldVisible(
        "birth_date"
      )
    ) {
      if (
        fieldRequired(
          "birth_date"
        ) &&
        !birthDateInput.trim()
      ) {
        setStatus(
          "error"
        );

        setMessage(
          "Doğum tarihi zorunludur."
        );

        return;
      }

      if (
        birthDateInput.trim()
      ) {
        const normalized =
          normalizeBirthDate(
            birthDateInput
          );

        if (!normalized) {
          setStatus(
            "error"
          );

          setMessage(
            "Doğum tarihini GG/AA/YYYY formatında girin. Örnek: 15/08/2018"
          );

          return;
        }

        formData.set(
          "birthDate",
          normalized
        );
      }
    }

    /*
     * KURS / GRUP
     */

    if (
      fieldVisible(
        "group"
      ) &&
      fieldRequired(
        "group"
      ) &&
      !groupId
    ) {
      setStatus(
        "error"
      );

      setMessage(
        "Lütfen şube ve grup seçimini tamamlayın."
      );

      return;
    }

    /*
     * PAKET
     */

    if (
      fieldVisible(
        "package"
      ) &&
      fieldRequired(
        "package"
      ) &&
      !packageId
    ) {
      setStatus(
        "error"
      );

      setMessage(
        "Lütfen paket tercihini seçin."
      );

      return;
    }

    /*
     * YETİŞKİN
     */

    if (
      registrationFor ===
      "adult"
    ) {
      const firstName =
        String(
          formData.get(
            "firstName"
          ) || ""
        ).trim();

      const lastName =
        String(
          formData.get(
            "lastName"
          ) || ""
        ).trim();

      formData.set(
        "guardianName",
        `${firstName} ${lastName}`.trim()
      );
    }

    formData.set(
      "registrationFor",
      registrationFor
    );

    /*
     * CUSTOM FIELD CEVAPLARI
     *
     * API'nin bir sonraki adımında
     * registration_form_responses tablosuna
     * bunları işleyeceğiz.
     */

    const customResponses:
      Array<{
        field_id: string;
        field_key: string;
        field_label: string;
        value:
          | string
          | string[]
          | boolean;
      }> = [];

    for (
      const field of
      customFields
    ) {
      const name =
        `custom_${field.id}`;

      if (
        field.field_type ===
        "multiselect"
      ) {
        const values =
          formData
            .getAll(name)
            .map(String);

        customResponses.push(
          {
            field_id:
              field.id,

            field_key:
              field.field_key,

            field_label:
              field.label,

            value:
              values,
          }
        );
      } else if (
        field.field_type ===
        "checkbox"
      ) {
        customResponses.push(
          {
            field_id:
              field.id,

            field_key:
              field.field_key,

            field_label:
              field.label,

            value:
              formData.get(
                name
              ) === "true",
          }
        );
      } else {
        customResponses.push(
          {
            field_id:
              field.id,

            field_key:
              field.field_key,

            field_label:
              field.label,

            value:
              String(
                formData.get(
                  name
                ) || ""
              ),
          }
        );
      }
    }

    const payload:
      Record<
        string,
        unknown
      > =
      Object.fromEntries(
        formData.entries()
      );

    payload.customResponses =
      customResponses;

    try {
      setStatus(
        "sending"
      );

      const response =
        await fetch(
          "/api/pre-registrations",
          {
            method:
              "POST",

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

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ||
            "Ön kayıt oluşturulamadı."
        );
      }

      setStatus(
        "success"
      );

      setMessage(
        "Ön kaydınız başarıyla alınmıştır. Kayıt ekibimiz başvurunuzu inceleyerek en kısa sürede sizinle iletişime geçecektir."
      );

      formElement.reset();

      setRegistrationFor(
        "child"
      );

      setCourseType("");
      setBranchId("");
      setGroupId("");
      setPackageId("");
      setBirthDateInput("");

      window.scrollTo({
        top: 0,
        behavior:
          "smooth",
      });
    } catch (error) {
      setStatus(
        "error"
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Bir hata oluştu."
      );
    }
  }

  /* =======================================================
     ÖZEL ALAN RENDER
     ======================================================= */

  function renderCustomField(
    field: FormField
  ) {
    const name =
      `custom_${field.id}`;

    const fieldOptions =
      safeOptions(
        field.options
      );

    if (
      field.field_type ===
      "info"
    ) {
      return (
        <div
          key={
            field.id
          }
          className="optionsLoading"
        >
          <strong>
            {field.label}
          </strong>

          {field.help_text && (
            <p
              style={{
                margin:
                  "5px 0 0",
              }}
            >
              {
                field.help_text
              }
            </p>
          )}
        </div>
      );
    }

    if (
      field.field_type ===
      "textarea"
    ) {
      return (
        <label
          key={
            field.id
          }
          className="fullWidth"
        >
          <span>
            {field.label}

            <RequiredMark
              required={
                field.is_required
              }
            />
          </span>

          <textarea
            name={
              name
            }
            required={
              field.is_required
            }
            rows={4}
            placeholder={
              field.placeholder ||
              ""
            }
          />

          {field.help_text && (
            <small>
              {
                field.help_text
              }
            </small>
          )}
        </label>
      );
    }

    if (
      field.field_type ===
      "select"
    ) {
      return (
        <label
          key={
            field.id
          }
        >
          <span>
            {field.label}

            <RequiredMark
              required={
                field.is_required
              }
            />
          </span>

          <select
            name={
              name
            }
            required={
              field.is_required
            }
            defaultValue=""
          >
            <option
              value=""
              disabled={
                field.is_required
              }
            >
              Seçiniz
            </option>

            {fieldOptions.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {
                    option.label
                  }
                </option>
              )
            )}
          </select>

          {field.help_text && (
            <small>
              {
                field.help_text
              }
            </small>
          )}
        </label>
      );
    }

    if (
      field.field_type ===
      "radio"
    ) {
      return (
        <div
          key={
            field.id
          }
          className="fullWidth"
        >
          <label>
            <span>
              {field.label}

              <RequiredMark
                required={
                  field.is_required
                }
              />
            </span>
          </label>

          <div className="requestOptions">
            {fieldOptions.map(
              (
                option,
                index
              ) => (
                <label
                  key={
                    option.value
                  }
                >
                  <input
                    type="radio"
                    name={
                      name
                    }
                    value={
                      option.value
                    }
                    required={
                      field.is_required &&
                      index ===
                        0
                    }
                  />

                  <span>
                    {
                      option.label
                    }
                  </span>
                </label>
              )
            )}
          </div>

          {field.help_text && (
            <small>
              {
                field.help_text
              }
            </small>
          )}
        </div>
      );
    }

    if (
      field.field_type ===
      "checkbox"
    ) {
      return (
        <label
          key={
            field.id
          }
          className="consent"
        >
          <input
            type="checkbox"
            name={
              name
            }
            value="true"
            required={
              field.is_required
            }
          />

          <span>
            {field.label}

            <RequiredMark
              required={
                field.is_required
              }
            />

            {field.help_text && (
              <>
                <br />

                <small>
                  {
                    field.help_text
                  }
                </small>
              </>
            )}
          </span>
        </label>
      );
    }

    if (
      field.field_type ===
      "multiselect"
    ) {
      return (
        <div
          key={
            field.id
          }
          className="fullWidth"
        >
          <label>
            <span>
              {field.label}

              <RequiredMark
                required={
                  field.is_required
                }
              />
            </span>
          </label>

          <div className="requestOptions">
            {fieldOptions.map(
              (option) => (
                <label
                  key={
                    option.value
                  }
                >
                  <input
                    type="checkbox"
                    name={
                      name
                    }
                    value={
                      option.value
                    }
                  />

                  <span>
                    {
                      option.label
                    }
                  </span>
                </label>
              )
            )}
          </div>
        </div>
      );
    }

    const inputType =
      field.field_type ===
      "number"
        ? "number"
        : field.field_type ===
            "phone"
          ? "tel"
          : field.field_type ===
              "date"
            ? "date"
            : "text";

    return (
      <label
        key={
          field.id
        }
      >
        <span>
          {field.label}

          <RequiredMark
            required={
              field.is_required
            }
          />
        </span>

        <input
          name={
            name
          }
          type={
            inputType
          }
          required={
            field.is_required
          }
          placeholder={
            field.placeholder ||
            ""
          }
        />

        {field.help_text && (
          <small>
            {
              field.help_text
            }
          </small>
        )}
      </label>
    );
  }

  /* =======================================================
     SYSTEM FIELDS
     ======================================================= */

  const registrationForField =
    getField(
      "registration_for"
    );

  const contactField =
    getField(
      "contact_request"
    );

  const contactOptions =
    safeOptions(
      contactField?.options
    );

  const finalContactOptions =
    contactOptions.length
      ? contactOptions
      : [
          {
            value:
              "call_me",

            label:
              "Online ön kaydımı oluşturdum, detaylı bilgi için aranmak istiyorum.",
          },

          {
            value:
              "ready_to_start",

            label:
              "Kaydım onaylandıktan sonra kursa başlayacağım.",
          },
        ];

  /* =======================================================
     RETURN
     ======================================================= */

  return (
    <form
      className="registrationForm"
      onSubmit={
        handleSubmit
      }
    >
      <input
        className="hiddenField"
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
      />

      {/* ===================================================
          1 · KATILIMCI
          =================================================== */}

      <section className="formSection">
        <div className="formSectionTitle">
          <b>1</b>

          <div>
            <strong>
              Öğrenci /
              Katılımcı
              Bilgileri
            </strong>

            <span>
              Ön kayıt için
              temel bilgileri
              doldurun
            </span>
          </div>
        </div>

        {registrationForField?.is_visible !==
          false && (
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
                onChange={() => {
                  setRegistrationFor(
                    "child"
                  );

                  setPackageId(
                    ""
                  );
                }}
              />

              <strong>
                Çocuğum İçin
              </strong>

              <span>
                Veli olarak
                çocuğunuz için
                ön kayıt
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
                onChange={() => {
                  setRegistrationFor(
                    "adult"
                  );

                  setPackageId(
                    ""
                  );
                }}
              />

              <strong>
                Kendim İçin /
                Yetişkin
              </strong>

              <span>
                18 yaş ve üzeri
                katılımcılar
                için.
              </span>
            </label>
          </div>
        )}

        <div className="formGrid">
          {fieldVisible(
            "first_name"
          ) && (
            <label>
              <span>
                {fieldLabel(
                  "first_name",
                  "Öğrenci / Katılımcı Adı"
                )}

                <RequiredMark
                  required={fieldRequired(
                    "first_name"
                  )}
                />
              </span>

              <input
                name="firstName"
                required={fieldRequired(
                  "first_name"
                )}
                maxLength={60}
                placeholder={fieldPlaceholder(
                  "first_name",
                  "Adı"
                )}
                autoComplete="given-name"
              />
            </label>
          )}

          {fieldVisible(
            "last_name"
          ) && (
            <label>
              <span>
                {fieldLabel(
                  "last_name",
                  "Soyadı"
                )}

                <RequiredMark
                  required={fieldRequired(
                    "last_name"
                  )}
                />
              </span>

              <input
                name="lastName"
                required={fieldRequired(
                  "last_name"
                )}
                maxLength={60}
                placeholder={fieldPlaceholder(
                  "last_name",
                  "Soyadı"
                )}
                autoComplete="family-name"
              />
            </label>
          )}

          {fieldVisible(
            "birth_date"
          ) && (
            <label>
              <span>
                {fieldLabel(
                  "birth_date",
                  "Doğum Tarihi"
                )}

                <RequiredMark
                  required={fieldRequired(
                    "birth_date"
                  )}
                />
              </span>

              <input
                type="text"
                name="birthDateDisplay"
                inputMode="numeric"
                maxLength={10}
                placeholder={fieldPlaceholder(
                  "birth_date",
                  "GG/AA/YYYY"
                )}
                value={
                  birthDateInput
                }
                onChange={(
                  event
                ) =>
                  setBirthDateInput(
                    formatBirthDateInput(
                      event.target.value
                    )
                  )
                }
              />

              <small>
                Örnek:
                15/08/2018
              </small>
            </label>
          )}

          {fieldVisible(
            "guardian_name"
          ) &&
            registrationFor ===
              "child" && (
              <label>
                <span>
                  {fieldLabel(
                    "guardian_name",
                    "Veli Adı Soyadı"
                  )}

                  <RequiredMark
                    required={fieldRequired(
                      "guardian_name"
                    )}
                  />
                </span>

                <input
                  name="guardianName"
                  required={fieldRequired(
                    "guardian_name"
                  )}
                  maxLength={120}
                  placeholder={fieldPlaceholder(
                    "guardian_name",
                    "Veli adı soyadı"
                  )}
                  autoComplete="name"
                />
              </label>
            )}

          {fieldVisible(
            "phone"
          ) && (
            <label>
              <span>
                {fieldLabel(
                  "phone",
                  "Telefon"
                )}

                <RequiredMark
                  required={fieldRequired(
                    "phone"
                  )}
                />
              </span>

              <input
                name="phone"
                type="tel"
                inputMode="tel"
                required={fieldRequired(
                  "phone"
                )}
                placeholder={fieldPlaceholder(
                  "phone",
                  "05xx xxx xx xx"
                )}
                maxLength={20}
                autoComplete="tel"
              />
            </label>
          )}
        </div>
      </section>

      {/* ===================================================
          2 · KURS
          =================================================== */}

      <section className="formSection">
        <div className="formSectionTitle">
          <b>2</b>

          <div>
            <strong>
              Kurs, Grup ve
              Paket Tercihi
            </strong>

            <span>
              Aktif seçenekler
              sistemden otomatik
              gelir
            </span>
          </div>
        </div>

        {loading ? (
          <div className="optionsLoading">
            Aktif seçenekler
            yükleniyor…
          </div>
        ) : (
          <div className="formGrid">
            {fieldVisible(
              "course_type"
            ) && (
              <label>
                <span>
                  {fieldLabel(
                    "course_type",
                    "Kurs Türü"
                  )}

                  <RequiredMark
                    required={fieldRequired(
                      "course_type"
                    )}
                  />
                </span>

                <select
                  name="courseType"
                  required={fieldRequired(
                    "course_type"
                  )}
                  value={
                    courseType
                  }
                  onChange={(
                    event
                  ) => {
                    setCourseType(
                      event.target.value
                    );

                    setBranchId(
                      ""
                    );

                    setGroupId(
                      ""
                    );
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
                        key={
                          type
                        }
                        value={
                          type
                        }
                      >
                        {type}
                      </option>
                    )
                  )}
                </select>
              </label>
            )}

            {fieldVisible(
              "branch"
            ) && (
              <label>
                <span>
                  {fieldLabel(
                    "branch",
                    "Şube"
                  )}

                  <RequiredMark
                    required={fieldRequired(
                      "branch"
                    )}
                  />
                </span>

                <select
                  name="branchId"
                  required={fieldRequired(
                    "branch"
                  )}
                  value={
                    branchId
                  }
                  onChange={(
                    event
                  ) => {
                    setBranchId(
                      event.target.value
                    );

                    setGroupId(
                      ""
                    );
                  }}
                >
                  <option
                    value=""
                    disabled
                  >
                    Şube seçin
                  </option>

                  {availableBranches.map(
                    (
                      branch
                    ) => (
                      <option
                        key={
                          branch.id
                        }
                        value={
                          branch.id
                        }
                      >
                        {
                          branch.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>
            )}

            {fieldVisible(
              "group"
            ) && (
              <label className="wideGroupSelect">
                <span>
                  {fieldLabel(
                    "group",
                    "Aktif Grup, Gün ve Saat"
                  )}

                  <RequiredMark
                    required={fieldRequired(
                      "group"
                    )}
                  />
                </span>

                <select
                  name="groupId"
                  required={fieldRequired(
                    "group"
                  )}
                  value={
                    groupId
                  }
                  onChange={(
                    event
                  ) =>
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
                        key={
                          group.id
                        }
                        value={
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
            )}

            {fieldVisible(
              "swimming_level"
            ) && (
              <label>
                <span>
                  {fieldLabel(
                    "swimming_level",
                    "Yüzme Seviyesi"
                  )}

                  <RequiredMark
                    required={fieldRequired(
                      "swimming_level"
                    )}
                  />
                </span>

                <select
                  name="swimmingLevel"
                  required={fieldRequired(
                    "swimming_level"
                  )}
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
                        value={
                          level.name
                        }
                      >
                        {
                          level.name
                        }
                      </option>
                    )
                  )}

                  <option value="Bilmiyorum">
                    Bilmiyorum
                  </option>
                </select>
              </label>
            )}

            {fieldVisible(
              "package"
            ) && (
              <label>
                <span>
                  {fieldLabel(
                    "package",
                    "Paket Tercihi"
                  )}

                  <RequiredMark
                    required={fieldRequired(
                      "package"
                    )}
                  />
                </span>

                <select
                  name="packageId"
                  required={fieldRequired(
                    "package"
                  )}
                  value={
                    packageId
                  }
                  onChange={(
                    event
                  ) =>
                    setPackageId(
                      event.target.value
                    )
                  }
                >
                  <option
                    value=""
                    disabled
                  >
                    Paket seçin
                  </option>

                  {availablePackages.map(
                    (item) => (
                      <option
                        value={
                          item.id
                        }
                        key={
                          item.id
                        }
                      >
                        {
                          item.name
                        }{" "}
                        ·{" "}
                        {
                          item.lesson_count
                        }{" "}
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
            )}
          </div>
        )}

        {selectedGroup ? (
          <div className="selectedGroupCard">
            <div>
              <span>
                SEÇİLEN GRUP
              </span>

              <strong>
                {
                  selectedGroup.name
                }
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
                (
                  schedule
                ) => (
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
                )?.name ||
                ""
              }
            />

            <input
              type="hidden"
              name="preferredDays"
              value={selectedSchedules
                .map(
                  (
                    schedule
                  ) =>
                    days[
                      schedule.weekday
                    ]
                )
                .join(
                  " - "
                )}
            />

            <input
              type="hidden"
              name="preferredTime"
              value={
                selectedSchedules.length
                  ? selectedSchedules
                      .map(
                        (
                          schedule
                        ) =>
                          `${schedule.start_time.slice(
                            0,
                            5
                          )}-${schedule.end_time.slice(
                            0,
                            5
                          )}`
                      )
                      .join(
                        " / "
                      )
                  : ""
              }
            />
          </div>
        ) : null}
      </section>

      {/* ===================================================
          3 · İLETİŞİM
          =================================================== */}

      {fieldVisible(
        "contact_request"
      ) && (
        <section className="formSection">
          <div className="formSectionTitle">
            <b>3</b>

            <div>
              <strong>
                {fieldLabel(
                  "contact_request",
                  "İletişim Talebiniz"
                )}

                <RequiredMark
                  required={fieldRequired(
                    "contact_request"
                  )}
                />
              </strong>

              <span>
                Ön kayıt
                sonrasında nasıl
                ilerlemek
                istediğinizi seçin
              </span>
            </div>
          </div>

          <div className="requestOptions">
            {finalContactOptions.map(
              (
                option,
                index
              ) => (
                <label
                  key={
                    option.value
                  }
                >
                  <input
                    type="radio"
                    name="contactRequest"
                    value={
                      option.value
                    }
                    required={
                      fieldRequired(
                        "contact_request"
                      ) &&
                      index ===
                        0
                    }
                  />

                  <span>
                    {
                      option.label
                    }
                  </span>
                </label>
              )
            )}
          </div>
        </section>
      )}

      {/* ===================================================
          4 · EK BİLGİLER
          =================================================== */}

      {(fieldVisible(
        "general_note"
      ) ||
        customFields.some(
          (field) =>
            field.section_key ===
            "additional"
        )) && (
        <section className="formSection">
          <div className="formSectionTitle">
            <b>4</b>

            <div>
              <strong>
                Ek Bilgiler
              </strong>

              <span>
                Özel durum ve
                beklentilerinizi
                paylaşabilirsiniz
              </span>
            </div>
          </div>

          <div className="formGrid">
            {fieldVisible(
              "general_note"
            ) && (
              <label className="fullWidth">
                <span>
                  {fieldLabel(
                    "general_note",
                    "Açıklama / Özel Durum"
                  )}

                  <RequiredMark
                    required={fieldRequired(
                      "general_note"
                    )}
                  />
                </span>

                <textarea
                  name="note"
                  required={fieldRequired(
                    "general_note"
                  )}
                  rows={4}
                  maxLength={1000}
                  placeholder={fieldPlaceholder(
                    "general_note",
                    "Kayıt ekibimizin bilmesini istediğiniz bir not varsa yazabilirsiniz."
                  )}
                />
              </label>
            )}

            {customFields
              .filter(
                (field) =>
                  field.section_key ===
                  "additional"
              )
              .map(
                renderCustomField
              )}
          </div>
        </section>
      )}

      {/* ===================================================
          5 · SAĞLIK
          =================================================== */}

      {(fieldVisible(
        "health_declaration"
      ) ||
        fieldVisible(
          "health_note"
        ) ||
        customFields.some(
          (field) =>
            field.section_key ===
            "health"
        )) && (
        <section className="formSection">
          <div className="formSectionTitle">
            <b>5</b>

            <div>
              <strong>
                Sağlık Bilgileri
              </strong>

              <span>
                Güvenli eğitim için
                gerekli sağlık
                bilgilerini paylaşın
              </span>
            </div>
          </div>

          {fieldVisible(
            "health_declaration"
          ) && (
            <label className="consent">
              <input
                type="checkbox"
                name="healthDeclaration"
                value="true"
                required={fieldRequired(
                  "health_declaration"
                )}
              />

              <span>
                {getField(
                  "health_declaration"
                )?.help_text ||
                  "Öğrencinin / katılımcının yüzme eğitimine katılmasına engel teşkil eden bilinen bir sağlık problemi bulunmadığını beyan ediyorum."}

                <RequiredMark
                  required={fieldRequired(
                    "health_declaration"
                  )}
                />
              </span>
            </label>
          )}

          {fieldVisible(
            "health_note"
          ) && (
            <label className="fullWidth">
              <span>
                {fieldLabel(
                  "health_note",
                  "Bildirilmesi Gereken Sağlık Bilgisi"
                )}

                <RequiredMark
                  required={fieldRequired(
                    "health_note"
                  )}
                />
              </span>

              <textarea
                name="healthNote"
                required={fieldRequired(
                  "health_note"
                )}
                rows={3}
                maxLength={1000}
                placeholder={fieldPlaceholder(
                  "health_note",
                  "Alerji, kronik rahatsızlık, kullanılan ilaç veya bilinmesi gereken sağlık durumunu yazabilirsiniz."
                )}
              />
            </label>
          )}

          <div className="formGrid">
            {customFields
              .filter(
                (field) =>
                  field.section_key ===
                  "health"
              )
              .map(
                renderCustomField
              )}
          </div>
        </section>
      )}

      {/* ===================================================
          6 · KURALLAR
          =================================================== */}

      {(fieldVisible(
        "rules_accepted"
      ) ||
        fieldVisible(
          "whatsapp_permission"
        ) ||
        customFields.some(
          (field) =>
            field.section_key ===
            "consent"
        )) && (
        <section className="formSection">
          <div className="formSectionTitle">
            <b>6</b>

            <div>
              <strong>
                Kurallar ve
                Onaylar
              </strong>

              <span>
                Başvuruyu
                tamamlamadan önce
                bilgilendirmeleri
                okuyunuz
              </span>
            </div>
          </div>

          {fieldVisible(
            "rules_accepted"
          ) && (
            <>
              <details className="rulesDetails">
                <summary>
                  Sprint Yüzme Okulu
                  Kurallarını
                  Görüntüle
                </summary>

                <div className="rulesContent">
                  <p>
                    <strong>
                      1. Ön Kayıt ve
                      Kesin Kayıt
                    </strong>
                  </p>

                  <p>
                    Bu form üzerinden
                    oluşturulan başvuru
                    ön kayıt
                    niteliğindedir.
                    Tek başına kesin
                    kayıt anlamına
                    gelmez.
                  </p>

                  <p>
                    Kayıt ekibimizin
                    başvurunuzu
                    onaylamasının
                    ardından gerekli
                    kayıt ve ödeme
                    işlemlerinin
                    tamamlanmasıyla
                    kayıt işleminiz
                    tamamlanmış ve
                    kesinleşmiş sayılır.
                  </p>

                  <p>
                    <strong>
                      2. Ücret İadesi
                    </strong>
                  </p>

                  <p>
                    Kesin kayıt
                    işlemleri
                    tamamlandıktan
                    sonra kurs
                    ücretlerinde iade
                    uygulaması
                    bulunmamaktadır.
                  </p>

                  <p>
                    <strong>
                      3. Telafi
                      Dersleri
                    </strong>
                  </p>

                  <p>
                    Bireysel
                    nedenlerle
                    kaçırılan
                    derslerde{" "}
                    <strong>
                      (hastalık,
                      tatil, izin, iş
                      durumu ve
                      benzeri kişisel
                      nedenler dahil)
                    </strong>{" "}
                    telafi dersi
                    uygulanmamaktadır.
                  </p>

                  <p>
                    Telafi yalnızca
                    tesis veya Sprint
                    Yüzme Okulu
                    kaynaklı olarak
                    planlanan dersin
                    gerçekleştirilemediği
                    durumlarda
                    uygulanır.
                  </p>

                  <p>
                    <strong>
                      4. Kayıt
                      Dondurma
                    </strong>
                  </p>

                  <p>
                    Hastalık, tatil,
                    izin, şehir
                    dışında bulunma,
                    iş durumu veya
                    benzeri bireysel
                    nedenlerle kayıt
                    dondurma, ders
                    ekleme veya ücret
                    indirimi
                    uygulanmaz.
                  </p>

                  <p>
                    <strong>
                      5. Grup, Saat
                      ve Antrenör
                    </strong>
                  </p>

                  <p>
                    Eğitim kalitesi,
                    seviye uyumu,
                    kontenjan ve
                    operasyonel
                    ihtiyaçlar
                    doğrultusunda
                    grup, saat ve
                    antrenör
                    planlamalarında
                    gerekli
                    düzenlemeler
                    Sprint Yüzme
                    Okulu tarafından
                    yapılabilir.
                  </p>

                  <p>
                    <strong>
                      6. Sağlık
                      Bilgileri
                    </strong>
                  </p>

                  <p>
                    Kursiyerin yüzme
                    eğitimine
                    katılımını
                    etkileyebilecek
                    sağlık
                    durumlarının
                    kayıt sırasında
                    eksiksiz
                    bildirilmesi
                    gerekmektedir.
                  </p>
                </div>
              </details>

              <label className="consent">
                <input
                  type="checkbox"
                  name="rulesAccepted"
                  value="true"
                  required={fieldRequired(
                    "rules_accepted"
                  )}
                />

                <span>
                  {getField(
                    "rules_accepted"
                  )?.help_text ||
                    "Sprint Yüzme Okulu kurallarını okudum, anladım ve kabul ediyorum."}

                  <RequiredMark
                    required={fieldRequired(
                      "rules_accepted"
                    )}
                  />
                </span>
              </label>
            </>
          )}

          {fieldVisible(
            "whatsapp_permission"
          ) && (
            <label className="consent">
              <input
                type="checkbox"
                name="whatsappPermission"
                value="true"
                required={fieldRequired(
                  "whatsapp_permission"
                )}
              />

              <span>
                {getField(
                  "whatsapp_permission"
                )?.help_text ||
                  "Kayıt sürecine ilişkin bilgilendirmelerin WhatsApp üzerinden tarafıma gönderilmesini kabul ediyorum."}

                <RequiredMark
                  required={fieldRequired(
                    "whatsapp_permission"
                  )}
                />
              </span>
            </label>
          )}

          <div className="formGrid">
            {customFields
              .filter(
                (field) =>
                  field.section_key ===
                  "consent"
              )
              .map(
                renderCustomField
              )}
          </div>
        </section>
      )}

      {/* ===================================================
          DİĞER ÖZEL ALANLAR
          =================================================== */}

      {customFields.filter(
        (field) =>
          ![
            "additional",
            "health",
            "consent",
          ].includes(
            field.section_key
          )
      ).length >
        0 && (
        <section className="formSection">
          <div className="formSectionTitle">
            <b>+</b>

            <div>
              <strong>
                Ek Form Alanları
              </strong>

              <span>
                Yönetim tarafından
                eklenen ek sorular
              </span>
            </div>
          </div>

          <div className="formGrid">
            {customFields
              .filter(
                (field) =>
                  ![
                    "additional",
                    "health",
                    "consent",
                  ].includes(
                    field.section_key
                  )
              )
              .map(
                renderCustomField
              )}
          </div>
        </section>
      )}

      {/* ===================================================
          GÖNDER
          =================================================== */}

      <div className="submitRow">
        <button
          className="submitButton"
          disabled={
            status ===
              "sending" ||
            loading
          }
          type="submit"
        >
          {status ===
          "sending"
            ? "Başvurunuz gönderiliyor..."
            : "Ön Kaydı Tamamla"}
        </button>
      </div>

      <p
        style={{
          margin:
            "-8px 0 0",
          color:
            "#7b8799",
          fontSize:
            11,
          fontWeight:
            600,
        }}
      >
        <span
          style={{
            color:
              "#e53935",
            fontWeight:
              900,
          }}
        >
          *
        </span>{" "}
        işaretli alanlar
        zorunludur.
      </p>

      {message && (
        <p
          className={
            status ===
            "success"
              ? "formMessage success"
              : "formMessage error"
          }
          role="status"
        >
          {message}
        </p>
      )}
    </form>
  );
}

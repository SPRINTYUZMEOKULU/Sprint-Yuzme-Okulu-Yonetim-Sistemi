"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  createCustomField,
  deleteCustomField,
  toggleFieldRequired,
  toggleFieldVisibility,
  updateField,
} from "./actions";

export type FormField = {
  id: string;
  field_key: string;
  section_key: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  help_text: string | null;
  options: unknown;
  is_visible: boolean;
  is_required: boolean;
  is_system: boolean;
  is_deletable: boolean;
  applies_to: string;
  sort_order: number;
};

type Props = {
  fields: FormField[];
};

const sectionNames: Record<
  string,
  string
> = {
  participant: "Katılımcı Bilgileri",
  course: "Kurs ve Grup Bilgileri",
  communication: "İletişim Talebi",
  additional: "Ek Bilgiler",
  health: "Sağlık Bilgileri",
  consent: "Kurallar ve Onaylar",
  general: "Genel Alanlar",
};

const fieldTypeNames: Record<
  string,
  string
> = {
  text: "Kısa Metin",
  textarea: "Uzun Metin",
  number: "Sayı",
  date: "Tarih",
  phone: "Telefon",
  select: "Açılır Liste",
  radio: "Tek Seçim",
  checkbox: "Onay Kutusu",
  multiselect: "Çoklu Seçim",
  info: "Bilgilendirme Metni",
};

export default function FormSettingsClient({
  fields,
}: Props) {
  const [
    showNewField,
    setShowNewField,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null
  );

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const sections =
    Array.from(
      new Set(
        fields.map(
          (field) =>
            field.section_key
        )
      )
    );

  function runAction(
    action: (
      formData: FormData
    ) => Promise<void>,
    formData: FormData
  ) {
    startTransition(
      async () => {
        try {
          await action(
            formData
          );
        } catch (error) {
          alert(
            error instanceof Error
              ? error.message
              : "İşlem sırasında bir hata oluştu."
          );
        }
      }
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#1672f3",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 1.5,
              marginBottom: 7,
            }}
          >
            FORM YÖNETİMİ
          </div>

          <h2
            style={{
              margin: 0,
              color: "#10264b",
              fontSize: 27,
            }}
          >
            Ön Kayıt Formu
            Alanları
          </h2>

          <p
            style={{
              margin:
                "7px 0 0",
              color: "#66758f",
              lineHeight: 1.5,
            }}
          >
            Formda hangi
            alanların
            görüneceğini ve
            hangilerinin zorunlu
            olacağını buradan
            yönetin.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowNewField(
              (value) =>
                !value
            )
          }
          style={{
            border: 0,
            borderRadius: 12,
            padding:
              "13px 20px",
            background:
              "#1672f3",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {showNewField
            ? "Yeni Alanı Kapat"
            : "+ Yeni Alan Ekle"}
        </button>
      </div>

      {showNewField && (
        <form
          action={async (
            formData
          ) => {
            await createCustomField(
              formData
            );

            setShowNewField(
              false
            );
          }}
          style={{
            background:
              "#ffffff",
            border:
              "1px solid #dce5f2",
            borderRadius: 18,
            padding: 22,
            boxShadow:
              "0 12px 30px rgba(26,55,100,.06)",
          }}
        >
          <h3
            style={{
              margin:
                "0 0 18px",
              color: "#10264b",
            }}
          >
            Yeni Form Alanı
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",
              gap: 16,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              Alan Başlığı *

              <input
                name="label"
                required
                placeholder="Örn. Daha önce yüzme eğitimi aldı mı?"
                style={
                  inputStyle
                }
              />
            </label>

            <label
              style={
                labelStyle
              }
            >
              Alan Tipi *

              <select
                name="field_type"
                required
                defaultValue="text"
                style={
                  inputStyle
                }
              >
                {Object.entries(
                  fieldTypeNames
                ).map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      value={
                        value
                      }
                      key={
                        value
                      }
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label
              style={
                labelStyle
              }
            >
              Bölüm

              <select
                name="section_key"
                defaultValue="additional"
                style={
                  inputStyle
                }
              >
                <option value="participant">
                  Katılımcı
                  Bilgileri
                </option>

                <option value="course">
                  Kurs ve Grup
                  Bilgileri
                </option>

                <option value="communication">
                  İletişim
                  Talebi
                </option>

                <option value="additional">
                  Ek Bilgiler
                </option>

                <option value="health">
                  Sağlık
                  Bilgileri
                </option>

                <option value="consent">
                  Kurallar ve
                  Onaylar
                </option>
              </select>
            </label>

            <label
              style={
                labelStyle
              }
            >
              Kimler İçin?

              <select
                name="applies_to"
                defaultValue="all"
                style={
                  inputStyle
                }
              >
                <option value="all">
                  Herkes
                </option>

                <option value="child">
                  Çocuk
                  Kayıtları
                </option>

                <option value="adult">
                  Yetişkin
                  Kayıtları
                </option>
              </select>
            </label>

            <label
              style={
                labelStyle
              }
            >
              Placeholder

              <input
                name="placeholder"
                placeholder="Kutuda görünecek açıklama"
                style={
                  inputStyle
                }
              />
            </label>

            <label
              style={
                labelStyle
              }
            >
              Sıralama

              <input
                name="sort_order"
                type="number"
                defaultValue={900}
                style={
                  inputStyle
                }
              />
            </label>
          </div>

          <label
            style={{
              ...labelStyle,
              marginTop: 16,
            }}
          >
            Yardım Metni

            <textarea
              name="help_text"
              rows={2}
              placeholder="Alan altında gösterilecek kısa açıklama"
              style={{
                ...inputStyle,
                resize:
                  "vertical",
              }}
            />
          </label>

          <label
            style={{
              ...labelStyle,
              marginTop: 16,
            }}
          >
            Seçenekler

            <textarea
              name="options"
              rows={4}
              placeholder={
                "Seçenekli alan kullanıyorsanız her satıra bir seçenek yazın.\nÖrn:\nEvet\nHayır\nBilmiyorum"
              }
              style={{
                ...inputStyle,
                resize:
                  "vertical",
              }}
            />

            <small
              style={{
                color:
                  "#7a879b",
                fontWeight: 500,
              }}
            >
              Açılır liste,
              tek seçim veya
              çoklu seçim
              alanlarında
              kullanılır.
            </small>
          </label>

          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 18,
              flexWrap: "wrap",
            }}
          >
            <label
              style={
                checkStyle
              }
            >
              <input
                type="checkbox"
                name="is_visible"
                defaultChecked
              />
              Formda Göster
            </label>

            <label
              style={
                checkStyle
              }
            >
              <input
                type="checkbox"
                name="is_required"
              />
              Zorunlu Alan
            </label>
          </div>

          <button
            type="submit"
            disabled={
              isPending
            }
            style={{
              marginTop: 20,
              border: 0,
              borderRadius: 12,
              padding:
                "13px 22px",
              background:
                "#ff8a00",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Yeni Alanı Kaydet
          </button>
        </form>
      )}

      {!fields.length && (
        <div
          style={{
            padding: 24,
            background:
              "#fff7e9",
            border:
              "1px solid #ffdca7",
            borderRadius: 16,
            color: "#855000",
            fontWeight: 700,
          }}
        >
          Henüz form alanı
          bulunmuyor. Supabase
          kurulum SQL&apos;inin
          çalıştırıldığından emin
          olun.
        </div>
      )}

      {sections.map(
        (section) => {
          const sectionFields =
            fields.filter(
              (field) =>
                field.section_key ===
                section
            );

          return (
            <section
              key={
                section
              }
              style={{
                background:
                  "#ffffff",
                border:
                  "1px solid #dce5f2",
                borderRadius: 18,
                padding: 22,
                boxShadow:
                  "0 12px 30px rgba(26,55,100,.05)",
              }}
            >
              <div
                style={{
                  marginBottom: 17,
                }}
              >
                <div
                  style={{
                    color:
                      "#1672f3",
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 1.3,
                  }}
                >
                  FORM BÖLÜMÜ
                </div>

                <h3
                  style={{
                    margin:
                      "5px 0 0",
                    color:
                      "#10264b",
                    fontSize: 21,
                  }}
                >
                  {sectionNames[
                    section
                  ] ||
                    section}
                </h3>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {sectionFields.map(
                  (field) => (
                    <div
                      key={
                        field.id
                      }
                      style={{
                        border:
                          "1px solid #e1e8f2",
                        borderRadius: 15,
                        padding: 17,
                        background:
                          field.is_visible
                            ? "#fff"
                            : "#f7f9fc",
                        opacity:
                          field.is_visible
                            ? 1
                            : 0.72,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: 15,
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <div
                          style={{
                            minWidth:
                              220,
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap: 8,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <strong
                              style={{
                                color:
                                  "#10264b",
                                fontSize:
                                  16,
                              }}
                            >
                              {
                                field.label
                              }

                              {field.is_required && (
                                <span
                                  style={{
                                    color:
                                      "#e53935",
                                    marginLeft:
                                      5,
                                  }}
                                >
                                  *
                                </span>
                              )}
                            </strong>

                            {field.is_system && (
                              <span
                                style={
                                  badgeStyle
                                }
                              >
                                Sistem
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              marginTop:
                                5,
                              color:
                                "#7a879b",
                              fontSize:
                                13,
                            }}
                          >
                            {fieldTypeNames[
                              field
                                .field_type
                            ] ||
                              field.field_type}
                            {" · "}
                            {field.applies_to ===
                            "child"
                              ? "Çocuk"
                              : field.applies_to ===
                                  "adult"
                                ? "Yetişkin"
                                : "Herkes"}
                            {" · "}
                            Sıra{" "}
                            {
                              field.sort_order
                            }
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <form
                            action={(
                              formData
                            ) =>
                              runAction(
                                toggleFieldVisibility,
                                formData
                              )
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                field.id
                              }
                            />

                            <input
                              type="hidden"
                              name="next_visible"
                              value={
                                field.is_visible
                                  ? "false"
                                  : "true"
                              }
                            />

                            <button
                              type="submit"
                              disabled={
                                isPending
                              }
                              style={
                                field.is_visible
                                  ? greenButton
                                  : grayButton
                              }
                            >
                              {field.is_visible
                                ? "✓ Gösteriliyor"
                                : "Gizli"}
                            </button>
                          </form>

                          <form
                            action={(
                              formData
                            ) =>
                              runAction(
                                toggleFieldRequired,
                                formData
                              )
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                field.id
                              }
                            />

                            <input
                              type="hidden"
                              name="next_required"
                              value={
                                field.is_required
                                  ? "false"
                                  : "true"
                              }
                            />

                            <button
                              type="submit"
                              disabled={
                                isPending
                              }
                              style={
                                field.is_required
                                  ? orangeButton
                                  : grayButton
                              }
                            >
                              {field.is_required
                                ? "★ Zorunlu"
                                : "Opsiyonel"}
                            </button>
                          </form>

                          <button
                            type="button"
                            onClick={() =>
                              setEditingId(
                                editingId ===
                                  field.id
                                  ? null
                                  : field.id
                              )
                            }
                            style={
                              blueOutlineButton
                            }
                          >
                            Düzenle
                          </button>

                          {!field.is_system &&
                            field.is_deletable && (
                              <form
                                action={async (
                                  formData
                                ) => {
                                  if (
                                    !window.confirm(
                                      `"${field.label}" alanını silmek istediğinize emin misiniz?`
                                    )
                                  ) {
                                    return;
                                  }

                                  runAction(
                                    deleteCustomField,
                                    formData
                                  );
                                }}
                              >
                                <input
                                  type="hidden"
                                  name="id"
                                  value={
                                    field.id
                                  }
                                />

                                <button
                                  type="submit"
                                  style={
                                    redOutlineButton
                                  }
                                >
                                  Sil
                                </button>
                              </form>
                            )}
                        </div>
                      </div>

                      {field.help_text && (
                        <p
                          style={{
                            margin:
                              "10px 0 0",
                            color:
                              "#697992",
                            fontSize:
                              13,
                            lineHeight:
                              1.5,
                          }}
                        >
                          {
                            field.help_text
                          }
                        </p>
                      )}

                      {editingId ===
                        field.id && (
                        <form
                          action={async (
                            formData
                          ) => {
                            await updateField(
                              formData
                            );

                            setEditingId(
                              null
                            );
                          }}
                          style={{
                            marginTop:
                              17,
                            paddingTop:
                              17,
                            borderTop:
                              "1px solid #e5ebf4",
                          }}
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              field.id
                            }
                          />

                          <div
                            style={{
                              display:
                                "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit,minmax(200px,1fr))",
                              gap: 13,
                            }}
                          >
                            <label
                              style={
                                labelStyle
                              }
                            >
                              Alan
                              Başlığı

                              <input
                                name="label"
                                defaultValue={
                                  field.label
                                }
                                required
                                style={
                                  inputStyle
                                }
                              />
                            </label>

                            <label
                              style={
                                labelStyle
                              }
                            >
                              Kimler
                              İçin?

                              <select
                                name="applies_to"
                                defaultValue={
                                  field.applies_to
                                }
                                style={
                                  inputStyle
                                }
                              >
                                <option value="all">
                                  Herkes
                                </option>
                                <option value="child">
                                  Çocuk
                                </option>
                                <option value="adult">
                                  Yetişkin
                                </option>
                              </select>
                            </label>

                            <label
                              style={
                                labelStyle
                              }
                            >
                              Sıralama

                              <input
                                type="number"
                                name="sort_order"
                                defaultValue={
                                  field.sort_order
                                }
                                style={
                                  inputStyle
                                }
                              />
                            </label>

                            <label
                              style={
                                labelStyle
                              }
                            >
                              Placeholder

                              <input
                                name="placeholder"
                                defaultValue={
                                  field.placeholder ||
                                  ""
                                }
                                style={
                                  inputStyle
                                }
                              />
                            </label>
                          </div>

                          <label
                            style={{
                              ...labelStyle,
                              marginTop:
                                13,
                            }}
                          >
                            Yardım
                            Metni

                            <textarea
                              name="help_text"
                              rows={2}
                              defaultValue={
                                field.help_text ||
                                ""
                              }
                              style={{
                                ...inputStyle,
                                resize:
                                  "vertical",
                              }}
                            />
                          </label>

                          <div
                            style={{
                              display:
                                "flex",
                              gap: 10,
                              marginTop:
                                14,
                            }}
                          >
                            <button
                              type="submit"
                              style={
                                saveButton
                              }
                            >
                              Değişiklikleri
                              Kaydet
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingId(
                                  null
                                )
                              }
                              style={
                                grayButton
                              }
                            >
                              Vazgeç
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )
                )}
              </div>
            </section>
          );
        }
      )}
    </div>
  );
}

const labelStyle = {
  display: "grid",
  gap: 7,
  color: "#253858",
  fontSize: 13,
  fontWeight: 800,
} as const;

const inputStyle = {
  width: "100%",
  boxSizing:
    "border-box",
  border:
    "1px solid #d7e0ed",
  borderRadius: 10,
  padding: "11px 12px",
  background: "#fff",
  color: "#15284a",
  outline: "none",
  fontSize: 14,
} as const;

const checkStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#253858",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const badgeStyle = {
  padding: "4px 7px",
  borderRadius: 999,
  background: "#eef4ff",
  color: "#2868d7",
  fontSize: 10,
  fontWeight: 900,
} as const;

const baseButton = {
  borderRadius: 9,
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
} as const;

const greenButton = {
  ...baseButton,
  border:
    "1px solid #b9ead5",
  background: "#eafaf3",
  color: "#138252",
};

const orangeButton = {
  ...baseButton,
  border:
    "1px solid #ffd9aa",
  background: "#fff5e8",
  color: "#c56b00",
};

const grayButton = {
  ...baseButton,
  border:
    "1px solid #dbe3ee",
  background: "#f7f9fc",
  color: "#52627b",
};

const blueOutlineButton = {
  ...baseButton,
  border:
    "1px solid #bfd6ff",
  background: "#f5f9ff",
  color: "#1469e8",
};

const redOutlineButton = {
  ...baseButton,
  border:
    "1px solid #ffd0d0",
  background: "#fff7f7",
  color: "#d23c3c",
};

const saveButton = {
  ...baseButton,
  border: 0,
  background: "#1672f3",
  color: "#fff",
  padding: "10px 15px",
};

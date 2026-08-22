"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/dashboard-icons";

type SearchResult = {
  id: string;
  name: string;
  type: "student" | "guardian" | "group";
  subtitle?: string;

  studentNumber?: string | null;

  phone?: string | null;
  guardianPhone?: string | null;
  guardianName?: string | null;

  email?: string | null;
  guardianEmail?: string | null;

  swimmingLevel?: string | null;
  status?: string | null;

  groupName?: string | null;
  branchName?: string | null;

  href: string;
};

function durumMetni(status?: string | null) {
  if (!status) return "Durum belirtilmemiş";

  const map: Record<string, string> = {
    active: "Aktif Öğrenci",
    passive: "Pasif Öğrenci",
    pre_registration: "Ön Kayıt",
    pending: "Bekliyor",
    cancelled: "İptal",
    completed: "Tamamlandı",
  };

  return map[status] || status;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const [selected, setSelected] =
    useState<SearchResult | null>(null);

  const router = useRouter();

  const wrapperRef =
    useRef<HTMLDivElement>(null);

  /*
   * =========================================================
   * DIŞARI TIKLAYINCA KAPAT
   * =========================================================
   */
  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
        setSelected(null);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutside
      );
    };
  }, []);

  /*
   * =========================================================
   * ARAMA
   * =========================================================
   */
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      setSelected(null);

      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/global-search?q=${encodeURIComponent(
            trimmed
          )}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          setResults([]);
          setOpen(true);
          return;
        }

        const data =
          await response.json();

        setResults(
          Array.isArray(data.results)
            ? data.results
            : []
        );

        setOpen(true);
      } catch (error) {
        console.error(
          "Arama yapılamadı:",
          error
        );

        setResults([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () =>
      clearTimeout(timer);
  }, [query]);

  /*
   * =========================================================
   * SONUCA TIKLANDIĞINDA
   * SAYFA DEĞİŞTİRME.
   * HIZLI ÖN İZLEME AÇ.
   * =========================================================
   */
  function selectResult(
    result: SearchResult
  ) {
    setSelected(result);
    setOpen(true);
  }

  function closePreview() {
    setSelected(null);
  }

  /*
   * =========================================================
   * KLAVYE KISAYOLU
   * CMD + K / CTRL + K
   * =========================================================
   */
  const inputRef =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    function keyboardShortcut(
      event: KeyboardEvent
    ) {
      if (
        (event.metaKey ||
          event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        inputRef.current?.focus();

        if (
          query.trim().length >= 2
        ) {
          setOpen(true);
        }
      }

      if (
        event.key === "Escape"
      ) {
        setOpen(false);
        setSelected(null);
      }
    }

    window.addEventListener(
      "keydown",
      keyboardShortcut
    );

    return () =>
      window.removeEventListener(
        "keydown",
        keyboardShortcut
      );
  }, [query]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "560px",
      }}
    >
      {/* =====================================================
          ARAMA KUTUSU
      ===================================================== */}

      <div
        className="searchBox"
        style={{
          width: "100%",
          cursor: "text",
          position: "relative",
        }}
        onClick={() =>
          inputRef.current?.focus()
        }
      >
        <Icons.search />

        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(
              event.target.value
            );

            setSelected(null);
          }}
          onFocus={() => {
            if (
              query.trim().length >= 2
            ) {
              setOpen(true);
            }
          }}
          placeholder="Öğrenci, veli, telefon veya öğrenci numarası ara..."
          autoComplete="off"
          style={{
            flex: 1,
            width: "100%",
            border: 0,
            outline: "none",
            background:
              "transparent",
            color: "#17233b",
            fontSize: "14px",
            minWidth: 0,
          }}
        />

        {loading ? (
          <span
            style={{
              fontSize: "11px",
              color: "#64748b",
              whiteSpace: "nowrap",
            }}
          >
            Aranıyor...
          </span>
        ) : query ? (
          <button
            type="button"
            title="Aramayı Temizle"
            onClick={(event) => {
              event.stopPropagation();

              setQuery("");
              setResults([]);
              setSelected(null);
              setOpen(false);

              inputRef.current?.focus();
            }}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#64748b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent:
                "center",
              fontSize: "16px",
            }}
          >
            ×
          </button>
        ) : (
          <kbd>⌘ K</kbd>
        )}
      </div>

      {/* =====================================================
          SONUÇ PENCERESİ
      ===================================================== */}

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 9px)",
            left: 0,
            right: 0,

            background: "#ffffff",

            border:
              "1px solid #dfe7f1",

            borderRadius: "16px",

            boxShadow:
              "0 22px 55px rgba(15,23,42,0.18)",

            zIndex: 9999,

            overflow: "hidden",

            maxHeight: "520px",
          }}
        >
          {/* =================================================
              ÖĞRENCİ ÖN İZLEME
          ================================================= */}

          {selected ? (
            <div>
              {/* ÜST */}

              <div
                style={{
                  padding:
                    "17px 18px",

                  background:
                    "linear-gradient(135deg,#f7faff,#eef5ff)",

                  borderBottom:
                    "1px solid #e8eef6",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "flex-start",
                    justifyContent:
                      "space-between",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems:
                        "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius:
                          "14px",

                        background:
                          "#e7f1ff",

                        display: "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",

                        color:
                          "#1769e8",

                        flexShrink: 0,
                      }}
                    >
                      <Icons.child />
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize:
                            "11px",
                          fontWeight:
                            800,

                          letterSpacing:
                            "1px",

                          color:
                            "#1769e8",

                          marginBottom:
                            "4px",
                        }}
                      >
                        ÖĞRENCİ HIZLI
                        KARTI
                      </div>

                      <strong
                        style={{
                          display:
                            "block",

                          fontSize:
                            "17px",

                          color:
                            "#13233f",
                        }}
                      >
                        {selected.name}
                      </strong>

                      <small
                        style={{
                          color:
                            "#64748b",
                        }}
                      >
                        {durumMetni(
                          selected.status
                        )}
                      </small>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closePreview
                    }
                    title="Geri"
                    style={{
                      border:
                        "1px solid #dfe7f1",

                      background:
                        "#ffffff",

                      borderRadius:
                        "9px",

                      padding:
                        "7px 10px",

                      cursor:
                        "pointer",

                      color:
                        "#475569",

                      fontWeight:
                        700,
                    }}
                  >
                    ← Sonuçlar
                  </button>
                </div>
              </div>

              {/* BİLGİLER */}

              <div
                style={{
                  padding:
                    "16px 18px",
                }}
              >
                <div
                  style={{
                    display: "grid",

                    gridTemplateColumns:
                      "repeat(2,minmax(0,1fr))",

                    gap: "10px",
                  }}
                >
                  <InfoBox
                    title="Şube"
                    value={
                      selected.branchName ||
                      "Belirtilmemiş"
                    }
                  />

                  <InfoBox
                    title="Grup"
                    value={
                      selected.groupName ||
                      "Belirtilmemiş"
                    }
                  />

                  <InfoBox
                    title="Seviye"
                    value={
                      selected.swimmingLevel ||
                      "Belirtilmemiş"
                    }
                  />

                  <InfoBox
                    title="Öğrenci No"
                    value={
                      selected.studentNumber ||
                      "—"
                    }
                  />

                  <InfoBox
                    title="Veli"
                    value={
                      selected.guardianName ||
                      "Belirtilmemiş"
                    }
                  />

                  <InfoBox
                    title="Telefon"
                    value={
                      selected.guardianPhone ||
                      selected.phone ||
                      "Belirtilmemiş"
                    }
                  />
                </div>

                {/* İŞLEMLER */}

                <div
                  style={{
                    marginTop: "17px",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "11px",

                      fontWeight:
                        800,

                      color:
                        "#64748b",

                      letterSpacing:
                        ".9px",

                      marginBottom:
                        "9px",
                    }}
                  >
                    HIZLI İŞLEMLER
                  </div>

                  <div
                    style={{
                      display: "grid",

                      gridTemplateColumns:
                        "repeat(2,minmax(0,1fr))",

                      gap: "8px",
                    }}
                  >
                    <ActionButton
                      text="Öğrenci Dosyası"
                      onClick={() =>
                        router.push(
                          `/ogrenciler?ogrenci=${encodeURIComponent(
                            selected.id
                          )}`
                        )
                      }
                    />

                    <ActionButton
                      text="Yoklama"
                      onClick={() =>
                        router.push(
                          `/yoklama?ogrenci=${encodeURIComponent(
                            selected.id
                          )}`
                        )
                      }
                    />

                    <ActionButton
                      text="Ödemeler"
                      onClick={() =>
                        router.push(
                          `/odemeler?ogrenci=${encodeURIComponent(
                            selected.id
                          )}`
                        )
                      }
                    />

                    <ActionButton
                      text="Mesaj Gönder"
                      onClick={() =>
                        router.push(
                          `/hazir-mesajlar?ogrenci=${encodeURIComponent(
                            selected.id
                          )}`
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* SONUÇ BAŞLIĞI */}

              <div
                style={{
                  padding:
                    "12px 15px",

                  borderBottom:
                    "1px solid #edf1f6",

                  background:
                    "#fafcff",

                  display: "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "space-between",
                }}
              >
                <strong
                  style={{
                    fontSize:
                      "12px",

                    color:
                      "#475569",
                  }}
                >
                  ARAMA SONUÇLARI
                </strong>

                {!loading &&
                results.length >
                  0 ? (
                  <span
                    style={{
                      fontSize:
                        "11px",

                      color:
                        "#94a3b8",
                    }}
                  >
                    {results.length}{" "}
                    kayıt
                  </span>
                ) : null}
              </div>

              {/* SONUÇLAR */}

              <div
                style={{
                  maxHeight:
                    "410px",

                  overflowY:
                    "auto",
                }}
              >
                {loading ? (
                  <div
                    style={{
                      padding:
                        "24px 18px",

                      textAlign:
                        "center",

                      color:
                        "#64748b",

                      fontSize:
                        "13px",
                    }}
                  >
                    Öğrenciler
                    aranıyor...
                  </div>
                ) : results.length ===
                  0 ? (
                  <div
                    style={{
                      padding:
                        "25px 18px",

                      textAlign:
                        "center",
                    }}
                  >
                    <div
                      style={{
                        width:
                          "44px",

                        height:
                          "44px",

                        margin:
                          "0 auto 9px",

                        borderRadius:
                          "13px",

                        background:
                          "#f1f5f9",

                        display:
                          "flex",

                        alignItems:
                          "center",

                        justifyContent:
                          "center",

                        color:
                          "#64748b",
                      }}
                    >
                      <Icons.search />
                    </div>

                    <strong
                      style={{
                        display:
                          "block",

                        color:
                          "#334155",

                        fontSize:
                          "13px",
                      }}
                    >
                      Sonuç bulunamadı
                    </strong>

                    <small
                      style={{
                        display:
                          "block",

                        marginTop:
                          "5px",

                        color:
                          "#94a3b8",
                      }}
                    >
                      Ad, soyad,
                      veli veya
                      telefonla
                      tekrar
                      deneyebilirsiniz.
                    </small>
                  </div>
                ) : (
                  results.map(
                    (result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        type="button"
                        onClick={() =>
                          selectResult(
                            result
                          )
                        }
                        style={{
                          display:
                            "flex",

                          width:
                            "100%",

                          alignItems:
                            "center",

                          gap: "12px",

                          padding:
                            "13px 15px",

                          border: 0,

                          borderBottom:
                            "1px solid #eef2f7",

                          background:
                            "#ffffff",

                          cursor:
                            "pointer",

                          textAlign:
                            "left",
                        }}
                      >
                        <span
                          style={{
                            width:
                              "40px",

                            height:
                              "40px",

                            borderRadius:
                              "12px",

                            background:
                              "#edf5ff",

                            display:
                              "flex",

                            alignItems:
                              "center",

                            justifyContent:
                              "center",

                            color:
                              "#1769e8",

                            flexShrink: 0,
                          }}
                        >
                          <Icons.child />
                        </span>

                        <span
                          style={{
                            display:
                              "flex",

                            flexDirection:
                              "column",

                            minWidth: 0,

                            flex: 1,
                          }}
                        >
                          <strong
                            style={{
                              color:
                                "#13233f",

                              fontSize:
                                "14px",

                              overflow:
                                "hidden",

                              textOverflow:
                                "ellipsis",

                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {result.name}
                          </strong>

                          {result.subtitle ? (
                            <small
                              style={{
                                color:
                                  "#64748b",

                                marginTop:
                                  "3px",

                                overflow:
                                  "hidden",

                                textOverflow:
                                  "ellipsis",

                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {
                                result.subtitle
                              }
                            </small>
                          ) : null}
                        </span>

                        <span
                          style={{
                            color:
                              "#94a3b8",

                            fontSize:
                              "18px",
                          }}
                        >
                          ›
                        </span>
                      </button>
                    )
                  )
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/*
 * =========================================================
 * BİLGİ KUTUSU
 * =========================================================
 */

function InfoBox({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div
      style={{
        border:
          "1px solid #e7edf5",

        borderRadius:
          "11px",

        padding:
          "10px 11px",

        background:
          "#fbfcfe",
      }}
    >
      <small
        style={{
          display:
            "block",

          color:
            "#94a3b8",

          fontSize:
            "10px",

          fontWeight:
            800,

          letterSpacing:
            ".5px",

          marginBottom:
            "4px",
        }}
      >
        {title.toUpperCase()}
      </small>

      <strong
        style={{
          display:
            "block",

          color:
            "#334155",

          fontSize:
            "12px",

          overflow:
            "hidden",

          textOverflow:
            "ellipsis",

          whiteSpace:
            "nowrap",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

/*
 * =========================================================
 * HIZLI İŞLEM BUTONU
 * =========================================================
 */

function ActionButton({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight:
          "42px",

        border:
          "1px solid #dce5f2",

        borderRadius:
          "11px",

        background:
          "#ffffff",

        color:
          "#1769e8",

        fontSize:
          "12px",

        fontWeight:
          750,

        cursor:
          "pointer",

        padding:
          "9px 11px",

        textAlign:
          "center",
      }}
    >
      {text}
    </button>
  );
} getir bebeğim

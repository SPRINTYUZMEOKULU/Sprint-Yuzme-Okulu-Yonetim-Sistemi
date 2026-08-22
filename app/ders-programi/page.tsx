import Link from "next/link";
import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import DersProgramiFormu from "./DersProgramiFormu";

export const dynamic = "force-dynamic";

const GUNLER = [
  { id: 1, ad: "Pazartesi" },
  { id: 2, ad: "Salı" },
  { id: 3, ad: "Çarşamba" },
  { id: 4, ad: "Perşembe" },
  { id: 5, ad: "Cuma" },
  { id: 6, ad: "Cumartesi" },
  { id: 7, ad: "Pazar" },
];

function gunAdi(value: number) {
  return GUNLER.find(
    (gun) => gun.id === value
  )?.ad || `Gün ${value}`;
}

function saat(
  value?: string | null
) {
  if (!value) return "—";

  return String(value).slice(0, 5);
}

/* =========================================================
   YENİ DERS PROGRAMI OLUŞTUR
========================================================= */

async function dersOlustur(
  formData: FormData
) {
  "use server";

  const profile =
    await requireProfile([
      "owner",
      "admin",
      "branch_manager",
    ]);

  const organizationId =
    profile.organization_id;

  if (!organizationId) {
    throw new Error(
      "Organizasyon bilgisi bulunamadı."
    );
  }

  const branchId = String(
    formData.get("branch_id") || ""
  );

  const groupId = String(
    formData.get("group_id") || ""
  );

  const coachValue = String(
    formData.get("coach_id") || ""
  );

  const coachId =
    coachValue || null;

  const startTime = String(
    formData.get("start_time") || ""
  );

  const endTime = String(
    formData.get("end_time") || ""
  );

  const weekdays = Array.from(
    new Set(
      formData
        .getAll("weekday")
        .map((item) =>
          Number(item)
        )
        .filter(
          (item) =>
            Number.isInteger(item) &&
            item >= 1 &&
            item <= 7
        )
    )
  );

  if (!branchId) {
    throw new Error(
      "Havuz / şube seçilmelidir."
    );
  }

  if (!groupId) {
    throw new Error(
      "Grup seçilmelidir."
    );
  }

  if (
    !startTime ||
    !endTime
  ) {
    throw new Error(
      "Başlangıç ve bitiş saatleri girilmelidir."
    );
  }

  if (
    startTime >= endTime
  ) {
    throw new Error(
      "Bitiş saati başlangıç saatinden sonra olmalıdır."
    );
  }

  if (
    weekdays.length === 0
  ) {
    throw new Error(
      "En az bir ders günü seçilmelidir."
    );
  }

  const supabase =
    await createClient();

  /*
   * Seçilen grubun gerçekten
   * bu organizasyona ait olduğunu
   * kontrol ediyoruz.
   */
  const {
    data: group,
    error: groupError,
  } = await supabase
    .from("training_groups")
    .select(
      "id,branch_id,name"
    )
    .eq(
      "organization_id",
      organizationId
    )
    .eq("id", groupId)
    .single();

  if (
    groupError ||
    !group
  ) {
    throw new Error(
      "Seçilen grup bulunamadı."
    );
  }

  if (
    group.branch_id &&
    group.branch_id !== branchId
  ) {
    throw new Error(
      "Seçilen grup bu şubeye ait değil."
    );
  }

  /*
   * Aynı grup + gün + başlangıç
   * saatinin ikinci kez oluşturulmasını
   * engelliyoruz.
   */
  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("lesson_schedules")
    .select(
      "id,group_id,weekday,start_time,is_active"
    )
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "group_id",
      groupId
    )
    .in(
      "weekday",
      weekdays
    );

  if (existingError) {
    throw new Error(
      `Mevcut program kontrol edilemedi: ${existingError.message}`
    );
  }

  const rows =
    weekdays
      .filter(
        (weekday) => {
          const duplicate =
            (
              existing || []
            ).some(
              (item: any) =>
                Number(
                  item.weekday
                ) ===
                  weekday &&
                saat(
                  item.start_time
                ) ===
                  saat(
                    startTime
                  ) &&
                item.is_active ===
                  true
            );

          return !duplicate;
        }
      )
      .map(
        (weekday) => ({
          organization_id:
            organizationId,

          branch_id:
            branchId,

          group_id:
            groupId,

          coach_id:
            coachId,

          weekday,

          start_time:
            startTime,

          end_time:
            endTime,

          is_active:
            true,
        })
      );

  if (
    rows.length === 0
  ) {
    throw new Error(
      "Seçtiğiniz gün ve saatte bu grubun aktif programı zaten bulunuyor."
    );
  }

  const { error } =
    await supabase
      .from(
        "lesson_schedules"
      )
      .insert(rows);

  if (error) {
    throw new Error(
      `Ders programı oluşturulamadı: ${error.message}`
    );
  }

  revalidatePath(
    "/ders-programi"
  );

  revalidatePath(
    "/operasyon-plani"
  );

  revalidatePath("/");
}

/* =========================================================
   SEANSI PASİF YAP
========================================================= */

async function seansPasifYap(
  formData: FormData
) {
  "use server";

  const profile =
    await requireProfile([
      "owner",
      "admin",
      "branch_manager",
    ]);

  const organizationId =
    profile.organization_id;

  const scheduleId =
    String(
      formData.get(
        "schedule_id"
      ) || ""
    );

  if (
    !organizationId ||
    !scheduleId
  ) {
    throw new Error(
      "Seans bilgisi bulunamadı."
    );
  }

  const supabase =
    await createClient();

  const { error } =
    await supabase
      .from(
        "lesson_schedules"
      )
      .update({
        is_active: false,
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        scheduleId
      );

  if (error) {
    throw new Error(
      `Seans pasif yapılamadı: ${error.message}`
    );
  }

  revalidatePath(
    "/ders-programi"
  );

  revalidatePath(
    "/operasyon-plani"
  );

  revalidatePath("/");
}

/* =========================================================
   SEANSI TEKRAR AKTİF ET
========================================================= */

async function seansAktifYap(
  formData: FormData
) {
  "use server";

  const profile =
    await requireProfile([
      "owner",
      "admin",
      "branch_manager",
    ]);

  const organizationId =
    profile.organization_id;

  const scheduleId =
    String(
      formData.get(
        "schedule_id"
      ) || ""
    );

  if (
    !organizationId ||
    !scheduleId
  ) {
    throw new Error(
      "Seans bilgisi bulunamadı."
    );
  }

  const supabase =
    await createClient();

  const { error } =
    await supabase
      .from(
        "lesson_schedules"
      )
      .update({
        is_active: true,
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "id",
        scheduleId
      );

  if (error) {
    throw new Error(
      `Seans tekrar etkinleştirilemedi: ${error.message}`
    );
  }

  revalidatePath(
    "/ders-programi"
  );

  revalidatePath(
    "/operasyon-plani"
  );

  revalidatePath("/");
}

/* =========================================================
   DERS PROGRAMI SAYFASI
========================================================= */

export default async function DersProgramiPage() {
  const profile =
    await requireProfile([
      "owner",
      "admin",
      "branch_manager",
      "registration_staff",
      "accounting",
      "coach",
    ]);

  const organizationId =
    profile.organization_id;

  if (!organizationId) {
    return (
      <main style={pageStyle}>
        <div
          style={containerStyle}
        >
          <h1>
            Ders Programı
          </h1>

          <div
            style={errorStyle}
          >
            Kullanıcının organizasyon
            bilgisi bulunamadı.
          </div>

          <Link
            href="/"
            style={backStyle}
          >
            ← Ana Sayfa
          </Link>
        </div>
      </main>
    );
  }

  const supabase =
    await createClient();

  /*
   * Ders Programı için gereken
   * tüm kaynakları paralel çekiyoruz.
   */
  const [
    branchesResult,
    groupsResult,
    coachesResult,
    studentsResult,
    membershipsResult,
    schedulesResult,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select(
        "id,name,is_active"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "is_active",
        true
      )
      .order("name"),

    supabase
      .from(
        "training_groups"
      )
      .select(
        "id,branch_id,name,course_type,capacity,primary_coach_id,is_active"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "is_active",
        true
      )
      .order("name"),

    supabase
      .from("profiles")
      .select(
        "id,full_name,email,role,is_active"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "role",
        "coach"
      )
      .eq(
        "is_active",
        true
      )
      .order(
        "full_name"
      ),

    supabase
      .from("students")
      .select(
        "id,first_name,last_name,preferred_days"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "is_deleted",
        false
      )
      .order(
        "first_name"
      ),

    supabase
      .from(
        "student_group_memberships"
      )
      .select(
        "id,student_id,group_id,is_active"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "is_active",
        true
      ),

    supabase
      .from(
        "lesson_schedules"
      )
      .select(
        "id,branch_id,group_id,coach_id,weekday,start_time,end_time,is_active"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order(
        "weekday",
        {
          ascending: true,
        }
      )
      .order(
        "start_time",
        {
          ascending: true,
        }
      ),
  ]);

  const loadError =
    branchesResult.error ||
    groupsResult.error ||
    coachesResult.error ||
    studentsResult.error ||
    membershipsResult.error ||
    schedulesResult.error;

  if (loadError) {
    return (
      <main style={pageStyle}>
        <div
          style={containerStyle}
        >
          <Link
            href="/"
            style={backStyle}
          >
            ← Ana Sayfa
          </Link>

          <h1>
            Ders Programı
          </h1>

          <div
            style={errorStyle}
          >
            Veriler yüklenemedi:{" "}
            {loadError.message}
          </div>
        </div>
      </main>
    );
  }

  const branches =
    branchesResult.data ||
    [];

  const groups =
    groupsResult.data ||
    [];

  const coaches =
    coachesResult.data ||
    [];

  const students =
    studentsResult.data ||
    [];

  const memberships =
    membershipsResult.data ||
    [];

  const schedules =
    schedulesResult.data ||
    [];

  const branchMap =
    new Map(
      branches.map(
        (item: any) => [
          item.id,
          item,
        ]
      )
    );

  const groupMap =
    new Map(
      groups.map(
        (item: any) => [
          item.id,
          item,
        ]
      )
    );

  const coachMap =
    new Map(
      coaches.map(
        (item: any) => [
          item.id,
          item,
        ]
      )
    );

  const activeSchedules =
    schedules.filter(
      (item: any) =>
        item.is_active ===
        true
    );

  const passiveSchedules =
    schedules.filter(
      (item: any) =>
        item.is_active !==
        true
    );

  const canEdit = [
    "owner",
    "admin",
    "branch_manager",
  ].includes(
    profile.role
  );

  return (
    <main style={pageStyle}>
      <div
        style={containerStyle}
      >
        {/* ==========================================
            BAŞLIK
        ========================================== */}

        <header
          style={headerStyle}
        >
          <div>
            <div
              style={
                eyebrowStyle
              }
            >
              SPRİNT YÜZME OKULU ·
              EĞİTİM
            </div>

            <h1
              style={titleStyle}
            >
              Ders Programı
            </h1>

            <p
              style={
                subtitleStyle
              }
            >
              Haftalık ders
              programını oluşturun.
              Öğrenci kayıt günleri,
              gruplar ve eğitmenler
              sistemden otomatik
              alınır.
            </p>
          </div>

          <div
            style={
              headerButtonsStyle
            }
          >
            <Link
              href="/operasyon-plani"
              style={
                secondaryButtonStyle
              }
            >
              Operasyon Planı
            </Link>

            <Link
              href="/"
              style={
                primaryButtonStyle
              }
            >
              Ana Sayfa
            </Link>
          </div>
        </header>

        {/* ==========================================
            ÖZET KARTLARI
        ========================================== */}

        <section
          style={
            summaryGridStyle
          }
        >
          <SummaryCard
            title="Aktif Seans"
            value={
              activeSchedules.length
            }
          />

          <SummaryCard
            title="Aktif Grup"
            value={
              groups.length
            }
          />

          <SummaryCard
            title="Aktif Eğitmen"
            value={
              coaches.length
            }
          />

          <SummaryCard
            title="Aktif Öğrenci"
            value={
              students.length
            }
          />

          <SummaryCard
            title="Havuz / Şube"
            value={
              branches.length
            }
          />
        </section>

        {/* ==========================================
            PROGRAM OLUŞTURMA
        ========================================== */}

        {canEdit && (
          <section
            style={
              createCardStyle
            }
          >
            <div
              style={
                sectionHeaderStyle
              }
            >
              <div>
                <div
                  style={
                    smallBlueStyle
                  }
                >
                  YENİ PROGRAM
                </div>

                <h2
                  style={
                    sectionTitleStyle
                  }
                >
                  Ders / Seans
                  Oluştur
                </h2>

                <p
                  style={
                    sectionSubtitleStyle
                  }
                >
                  Havuz ve grup
                  seçildiğinde
                  öğrencilerin kayıt
                  günleri analiz
                  edilerek uygun ders
                  günleri otomatik
                  önerilir.
                </p>
              </div>
            </div>

            <DersProgramiFormu
              branches={
                branches
              }
              groups={groups}
              coaches={
                coaches
              }
              students={
                students
              }
              memberships={
                memberships
              }
              action={
                dersOlustur
              }
            />
          </section>
        )}

        {/* ==========================================
            HAFTALIK PROGRAM
        ========================================== */}

        <section
          style={
            programCardStyle
          }
        >
          <div
            style={
              sectionHeaderStyle
            }
          >
            <div>
              <div
                style={
                  smallBlueStyle
                }
              >
                HAFTALIK PLAN
              </div>

              <h2
                style={
                  sectionTitleStyle
                }
              >
                Aktif Ders
                Programı
              </h2>

              <p
                style={
                  sectionSubtitleStyle
                }
              >
                Oluşturulan
                programlar
                Operasyon Planına
                otomatik aktarılır.
              </p>
            </div>

            <Link
              href="/operasyon-plani"
              style={
                operationLinkStyle
              }
            >
              Operasyon Planında
              Gör →
            </Link>
          </div>

          {activeSchedules.length ===
          0 ? (
            <div
              style={emptyStyle}
            >
              <strong>
                Henüz aktif ders
                programı
                oluşturulmamış.
              </strong>

              <span>
                Yukarıdaki formdan
                ilk programı
                oluşturabilirsiniz.
              </span>
            </div>
          ) : (
            <div
              style={
                weekGridStyle
              }
            >
              {GUNLER.map(
                (gun) => {
                  const daySchedules =
                    activeSchedules.filter(
                      (
                        item: any
                      ) =>
                        Number(
                          item.weekday
                        ) ===
                        gun.id
                    );

                  return (
                    <div
                      key={
                        gun.id
                      }
                      style={
                        dayColumnStyle
                      }
                    >
                      <div
                        style={
                          dayHeaderStyle
                        }
                      >
                        <strong>
                          {
                            gun.ad
                          }
                        </strong>

                        <span>
                          {
                            daySchedules.length
                          }{" "}
                          seans
                        </span>
                      </div>

                      {daySchedules.length ===
                      0 ? (
                        <div
                          style={
                            noLessonStyle
                          }
                        >
                          Ders yok
                        </div>
                      ) : (
                        daySchedules.map(
                          (
                            schedule: any
                          ) => {
                            const branch =
                              branchMap.get(
                                schedule.branch_id
                              );

                            const group =
                              groupMap.get(
                                schedule.group_id
                              );

                            const coach =
                              coachMap.get(
                                schedule.coach_id
                              );

                            return (
                              <article
                                key={
                                  schedule.id
                                }
                                style={
                                  lessonCardStyle
                                }
                              >
                                <div
                                  style={
                                    lessonTimeStyle
                                  }
                                >
                                  {saat(
                                    schedule.start_time
                                  )}{" "}
                                  –{" "}
                                  {saat(
                                    schedule.end_time
                                  )}
                                </div>

                                <strong
                                  style={
                                    lessonGroupStyle
                                  }
                                >
                                  {group?.name ||
                                    "Grup Atanmamış"}
                                </strong>

                                <div
                                  style={
                                    lessonMetaStyle
                                  }
                                >
                                  {branch?.name ||
                                    "Şube Atanmamış"}
                                </div>

                                <div
                                  style={
                                    coachStyle
                                  }
                                >
                                  Ana Eğitmen:{" "}
                                  <b>
                                    {coach?.full_name ||
                                      "Henüz atanmadı"}
                                  </b>
                                </div>

                                {group?.course_type && (
                                  <div
                                    style={
                                      typeBadgeStyle
                                    }
                                  >
                                    {
                                      group.course_type
                                    }
                                  </div>
                                )}

                                <div
                                  style={
                                    lessonActionsStyle
                                  }
                                >
                                  <Link
                                    href="/operasyon-plani"
                                    style={
                                      detailButtonStyle
                                    }
                                  >
                                    Seansı Aç
                                  </Link>

                                  {canEdit && (
                                    <form
                                      action={
                                        seansPasifYap
                                      }
                                    >
                                      <input
                                        type="hidden"
                                        name="schedule_id"
                                        value={
                                          schedule.id
                                        }
                                      />

                                      <button
                                        type="submit"
                                        style={
                                          disableButtonStyle
                                        }
                                      >
                                        Pasif Yap
                                      </button>
                                    </form>
                                  )}
                                </div>
                              </article>
                            );
                          }
                        )
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* ==========================================
            PASİF SEANSLAR
        ========================================== */}

        {canEdit &&
          passiveSchedules.length >
            0 && (
            <section
              style={
                passiveCardStyle
              }
            >
              <div
                style={
                  sectionHeaderStyle
                }
              >
                <div>
                  <div
                    style={
                      smallOrangeStyle
                    }
                  >
                    ARŞİV
                  </div>

                  <h2
                    style={
                      sectionTitleStyle
                    }
                  >
                    Pasif Seanslar
                  </h2>
                </div>
              </div>

              <div
                style={
                  passiveGridStyle
                }
              >
                {passiveSchedules.map(
                  (
                    schedule: any
                  ) => {
                    const branch =
                      branchMap.get(
                        schedule.branch_id
                      );

                    const group =
                      groupMap.get(
                        schedule.group_id
                      );

                    return (
                      <div
                        key={
                          schedule.id
                        }
                        style={
                          passiveItemStyle
                        }
                      >
                        <div>
                          <strong>
                            {gunAdi(
                              Number(
                                schedule.weekday
                              )
                            )}{" "}
                            ·{" "}
                            {saat(
                              schedule.start_time
                            )}
                          </strong>

                          <span
                            style={
                              passiveMetaStyle
                            }
                          >
                            {group?.name ||
                              "Grup yok"}{" "}
                            ·{" "}
                            {branch?.name ||
                              "Şube yok"}
                          </span>
                        </div>

                        <form
                          action={
                            seansAktifYap
                          }
                        >
                          <input
                            type="hidden"
                            name="schedule_id"
                            value={
                              schedule.id
                            }
                          />

                          <button
                            type="submit"
                            style={
                              activateButtonStyle
                            }
                          >
                            Tekrar Aktif Et
                          </button>
                        </form>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          )}
      </div>
    </main>
  );
}

/* =========================================================
   ÖZET KARTI
========================================================= */

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div
      style={
        summaryCardStyle
      }
    >
      <span
        style={
          summaryTitleStyle
        }
      >
        {title}
      </span>

      <strong
        style={
          summaryValueStyle
        }
      >
        {value}
      </strong>
    </div>
  );
}

/* =========================================================
   STİLLER
========================================================= */

const pageStyle: React.CSSProperties =
  {
    minHeight: "100vh",
    padding: 28,
    background:
      "linear-gradient(180deg,#f5f8fc 0%,#eef3f9 100%)",
    color: "#13233f",
  };

const containerStyle: React.CSSProperties =
  {
    maxWidth: 1550,
    margin: "0 auto",
  };

const headerStyle: React.CSSProperties =
  {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 20,
  };

const eyebrowStyle: React.CSSProperties =
  {
    color: "#1769e8",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.3,
  };

const titleStyle: React.CSSProperties =
  {
    margin: "7px 0 0",
    fontSize: 34,
  };

const subtitleStyle: React.CSSProperties =
  {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
  };

const headerButtonsStyle: React.CSSProperties =
  {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  };

const primaryButtonStyle: React.CSSProperties =
  {
    padding: "11px 16px",
    borderRadius: 11,
    background: "#1769e8",
    color: "#fff",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 850,
  };

const secondaryButtonStyle: React.CSSProperties =
  {
    ...primaryButtonStyle,
    background: "#fff",
    color: "#1769e8",
    border:
      "1px solid #dce5f2",
  };

const backStyle =
  secondaryButtonStyle;

const summaryGridStyle: React.CSSProperties =
  {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(160px,1fr))",
    gap: 10,
    marginBottom: 16,
  };

const summaryCardStyle: React.CSSProperties =
  {
    background: "#fff",
    border:
      "1px solid #e1e8f2",
    borderRadius: 15,
    padding: 16,
  };

const summaryTitleStyle: React.CSSProperties =
  {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 750,
  };

const summaryValueStyle: React.CSSProperties =
  {
    display: "block",
    marginTop: 4,
    fontSize: 25,
  };

const createCardStyle: React.CSSProperties =
  {
    background: "#fff",
    border:
      "1px solid #dfe7f1",
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    boxShadow:
      "0 8px 25px rgba(15,23,42,.04)",
  };

const programCardStyle: React.CSSProperties =
  {
    ...createCardStyle,
  };

const passiveCardStyle: React.CSSProperties =
  {
    ...createCardStyle,
    marginTop: 16,
  };

const sectionHeaderStyle: React.CSSProperties =
  {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
    marginBottom: 18,
  };

const smallBlueStyle: React.CSSProperties =
  {
    color: "#1769e8",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
  };

const smallOrangeStyle: React.CSSProperties =
  {
    ...smallBlueStyle,
    color: "#f97316",
  };

const sectionTitleStyle: React.CSSProperties =
  {
    margin: "5px 0 0",
    fontSize: 20,
  };

const sectionSubtitleStyle: React.CSSProperties =
  {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
  };

const operationLinkStyle: React.CSSProperties =
  {
    textDecoration: "none",
    color: "#1769e8",
    fontSize: 12,
    fontWeight: 850,
  };

const weekGridStyle: React.CSSProperties =
  {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",
    gap: 10,
    alignItems: "start",
  };

const dayColumnStyle: React.CSSProperties =
  {
    background: "#f8fafc",
    border:
      "1px solid #e4eaf3",
    borderRadius: 14,
    padding: 10,
    minHeight: 130,
  };

const dayHeaderStyle: React.CSSProperties =
  {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 5,
    marginBottom: 9,
    padding: "2px 3px 8px",
    borderBottom:
      "1px solid #e4eaf3",
    fontSize: 11,
  };

const noLessonStyle: React.CSSProperties =
  {
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center",
    padding: 20,
  };

const lessonCardStyle: React.CSSProperties =
  {
    background: "#fff",
    border:
      "1px solid #dfe7f1",
    borderRadius: 11,
    padding: 10,
    marginBottom: 7,
  };

const lessonTimeStyle: React.CSSProperties =
  {
    color: "#1769e8",
    fontSize: 13,
    fontWeight: 900,
  };

const lessonGroupStyle: React.CSSProperties =
  {
    display: "block",
    marginTop: 5,
    fontSize: 12,
  };

const lessonMetaStyle: React.CSSProperties =
  {
    marginTop: 4,
    color: "#64748b",
    fontSize: 10,
  };

const coachStyle: React.CSSProperties =
  {
    marginTop: 7,
    fontSize: 10,
    color: "#475569",
  };

const typeBadgeStyle: React.CSSProperties =
  {
    display: "inline-flex",
    marginTop: 7,
    padding: "4px 6px",
    borderRadius: 6,
    background: "#eef5ff",
    color: "#1769e8",
    fontSize: 9,
    fontWeight: 800,
  };

const lessonActionsStyle: React.CSSProperties =
  {
    display: "flex",
    gap: 5,
    flexWrap: "wrap",
    marginTop: 9,
  };

const detailButtonStyle: React.CSSProperties =
  {
    padding: "6px 8px",
    borderRadius: 7,
    background: "#1769e8",
    color: "#fff",
    textDecoration: "none",
    fontSize: 9,
    fontWeight: 800,
  };

const disableButtonStyle: React.CSSProperties =
  {
    padding: "6px 8px",
    borderRadius: 7,
    border:
      "1px solid #fecaca",
    background: "#fff1f2",
    color: "#dc2626",
    fontSize: 9,
    fontWeight: 800,
    cursor: "pointer",
  };

const emptyStyle: React.CSSProperties =
  {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "center",
    textAlign: "center",
    padding: 40,
    border:
      "1px dashed #cbd5e1",
    borderRadius: 14,
    color: "#64748b",
  };

const passiveGridStyle: React.CSSProperties =
  {
    display: "grid",
    gap: 8,
  };

const passiveItemStyle: React.CSSProperties =
  {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 12,
    padding: 12,
    border:
      "1px solid #e4eaf3",
    borderRadius: 11,
    background: "#fafcff",
  };

const passiveMetaStyle: React.CSSProperties =
  {
    display: "block",
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  };

const activateButtonStyle: React.CSSProperties =
  {
    border: 0,
    borderRadius: 8,
    padding: "8px 10px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: 10,
    fontWeight: 850,
    cursor: "pointer",
  };

const errorStyle: React.CSSProperties =
  {
    marginTop: 20,
    padding: 18,
    border:
      "1px solid #fecaca",
    borderRadius: 14,
    background: "#fff1f2",
    color: "#991b1b",
  };

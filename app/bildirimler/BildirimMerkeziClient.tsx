"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "./actions";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  message: string | null;
  category: string | null;
  notification_type: string;
  severity: string | null;
  priority: string | null;
  target_path: string | null;
  is_read: boolean;
  push_required: boolean;
  push_requested: boolean;
  push_sent: boolean;
  push_sent_at: string | null;
  created_at: string;
};

type FilterKey =
  | "all"
  | "unread"
  | "preregistration"
  | "attendance"
  | "finance"
  | "approvals"
  | "system";

type Props = {
  notifications: NotificationItem[];
};

const FILTERS: Array<{
  key: FilterKey;
  label: string;
  icon: string;
}> = [
  {
    key: "all",
    label: "Tümü",
    icon: "▦",
  },
  {
    key: "unread",
    label: "Okunmamış",
    icon: "●",
  },
  {
    key: "preregistration",
    label: "Ön Kayıt",
    icon: "＋",
  },
  {
    key: "attendance",
    label: "Yoklama",
    icon: "✓",
  },
  {
    key: "finance",
    label: "Finans",
    icon: "₺",
  },
  {
    key: "approvals",
    label: "Onaylar",
    icon: "◎",
  },
  {
    key: "system",
    label: "Sistem",
    icon: "⚙",
  },
];

function categoryLabel(category?: string | null) {
  switch (category) {
    case "preregistration":
      return "Ön Kayıt";

    case "students":
      return "Öğrenciler";

    case "attendance":
      return "Yoklama";

    case "finance":
      return "Finans";

    case "payment":
      return "Ödemeler";

    case "cash":
      return "Kasa";

    case "approvals":
      return "Onaylar";

    case "staff":
      return "Personel";

    case "accounts":
      return "Kullanıcılar";

    case "permissions":
      return "Yetkiler";

    case "schedule":
      return "Ders Programı";

    case "operations":
      return "Operasyon";

    case "reports":
      return "Raporlar";

    case "system":
      return "Sistem";

    default:
      return category || "Sistem";
  }
}

function severityLabel(severity?: string | null) {
  switch (severity) {
    case "success":
      return "Başarılı";

    case "warning":
      return "Uyarı";

    case "error":
    case "critical":
      return "Kritik";

    default:
      return "Bilgi";
  }
}

function severityClass(severity?: string | null) {
  switch (severity) {
    case "success":
      return "success";

    case "warning":
      return "warning";

    case "error":
    case "critical":
      return "critical";

    default:
      return "info";
  }
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function categoryMatchesFinance(
  category: string | null
) {
  return [
    "finance",
    "payment",
    "cash",
  ].includes(category ?? "");
}

function filterNotification(
  notification: NotificationItem,
  filter: FilterKey
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "unread") {
    return !notification.is_read;
  }

  if (filter === "finance") {
    return categoryMatchesFinance(
      notification.category
    );
  }

  return notification.category === filter;
}

export default function BildirimMerkeziClient({
  notifications,
}: Props) {
  const [activeFilter, setActiveFilter] =
    useState<FilterKey>("all");

  const [localNotifications, setLocalNotifications] =
    useState<NotificationItem[]>(notifications);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [workingId, setWorkingId] =
    useState<string | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const filteredNotifications = useMemo(() => {
    return localNotifications.filter(
      (notification) =>
        filterNotification(
          notification,
          activeFilter
        )
    );
  }, [
    activeFilter,
    localNotifications,
  ]);

  const unreadCount = useMemo(() => {
    return localNotifications.filter(
      (notification) => !notification.is_read
    ).length;
  }, [localNotifications]);

  const clearFeedbackLater = () => {
    window.setTimeout(() => {
      setFeedback(null);
    }, 3500);
  };

  const handleMarkRead = (
    notificationId: string
  ) => {
    setFeedback(null);
    setWorkingId(notificationId);

    startTransition(async () => {
      const result =
        await markNotificationRead(
          notificationId
        );

      if (result.ok) {
        setLocalNotifications(
          (current) =>
            current.map(
              (notification) =>
                notification.id ===
                notificationId
                  ? {
                      ...notification,
                      is_read: true,
                    }
                  : notification
            )
        );

        setFeedback({
          type: "success",
          text: result.message,
        });
      } else {
        setFeedback({
          type: "error",
          text: result.message,
        });
      }

      setWorkingId(null);
      clearFeedbackLater();
    });
  };

  const handleMarkUnread = (
    notificationId: string
  ) => {
    setFeedback(null);
    setWorkingId(notificationId);

    startTransition(async () => {
      const result =
        await markNotificationUnread(
          notificationId
        );

      if (result.ok) {
        setLocalNotifications(
          (current) =>
            current.map(
              (notification) =>
                notification.id ===
                notificationId
                  ? {
                      ...notification,
                      is_read: false,
                    }
                  : notification
            )
        );

        setFeedback({
          type: "success",
          text: result.message,
        });
      } else {
        setFeedback({
          type: "error",
          text: result.message,
        });
      }

      setWorkingId(null);
      clearFeedbackLater();
    });
  };

  const handleMarkAllRead = () => {
    setFeedback(null);
    setWorkingId("__all__");

    startTransition(async () => {
      const result =
        await markAllNotificationsRead();

      if (result.ok) {
        setLocalNotifications(
          (current) =>
            current.map(
              (notification) => ({
                ...notification,
                is_read: true,
              })
            )
        );

        setFeedback({
          type: "success",
          text: result.message,
        });
      } else {
        setFeedback({
          type: "error",
          text: result.message,
        });
      }

      setWorkingId(null);
      clearFeedbackLater();
    });
  };

  return (
    <>
      <section className="notification-panel">
        <div className="notification-header">
          <div>
            <div className="notification-title-row">
              <h2>Tüm Bildirimler</h2>

              {unreadCount > 0 ? (
                <span className="unread-counter">
                  {unreadCount} okunmamış
                </span>
              ) : (
                <span className="all-read-counter">
                  Tümü okundu
                </span>
              )}
            </div>

            <p>
              SprintOS bildirimlerini filtreleyin ve
              işlem durumlarını yönetin.
            </p>
          </div>

          <button
            type="button"
            className="mark-all-button"
            onClick={handleMarkAllRead}
            disabled={
              isPending ||
              unreadCount === 0
            }
          >
            <span className="button-icon">
              ✓✓
            </span>

            <span>
              {workingId === "__all__"
                ? "İşleniyor..."
                : "Tümünü Okundu Yap"}
            </span>
          </button>
        </div>

        {feedback ? (
          <div
            className={`feedback-box ${feedback.type}`}
          >
            <span className="feedback-icon">
              {feedback.type ===
              "success"
                ? "✓"
                : "!"}
            </span>

            <span>
              {feedback.text}
            </span>
          </div>
        ) : null}

        <div className="filter-wrapper">
          <div className="filter-label">
            Görünüm
          </div>

          <div className="filter-list">
            {FILTERS.map((filter) => {
              const isActive =
                activeFilter === filter.key;

              const count =
                filter.key === "all"
                  ? localNotifications.length
                  : localNotifications.filter(
                      (notification) =>
                        filterNotification(
                          notification,
                          filter.key
                        )
                    ).length;

              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() =>
                    setActiveFilter(filter.key)
                  }
                  className={`filter-button ${
                    isActive ? "active" : ""
                  }`}
                  aria-pressed={isActive}
                >
                  <span className="filter-icon">
                    {filter.icon}
                  </span>

                  <span>
                    {filter.label}
                  </span>

                  <span
                    className={`filter-count ${
                      isActive
                        ? "active"
                        : ""
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="result-bar">
          <div>
            <strong>
              {
                FILTERS.find(
                  (item) =>
                    item.key ===
                    activeFilter
                )?.label
              }
            </strong>

            <span>
              {" "}
              filtresinde{" "}
              {
                filteredNotifications.length
              }{" "}
              bildirim gösteriliyor.
            </span>
          </div>

          {activeFilter !== "all" ? (
            <button
              type="button"
              className="clear-filter-button"
              onClick={() =>
                setActiveFilter("all")
              }
            >
              Filtreyi Temizle
            </button>
          ) : null}
        </div>

        {filteredNotifications.length ===
        0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              🔔
            </div>

            <h3>
              Bu filtrede bildirim yok
            </h3>

            <p>
              Seçtiğiniz kategoriye ait
              görüntülenecek bildirim
              bulunmuyor.
            </p>

            <button
              type="button"
              className="empty-button"
              onClick={() =>
                setActiveFilter("all")
              }
            >
              Tüm Bildirimleri Göster
            </button>
          </div>
        ) : (
          <div className="notification-list">
            {filteredNotifications.map(
              (notification) => {
                const content =
                  notification.body ||
                  notification.message ||
                  "Bildirim ayrıntısı bulunmuyor.";

                const currentlyWorking =
                  workingId ===
                  notification.id;

                return (
                  <article
                    key={notification.id}
                    className={`notification-card ${
                      !notification.is_read
                        ? "unread"
                        : "read"
                    }`}
                  >
                    <div
                      className={`notification-state-icon ${
                        notification.is_read
                          ? "read"
                          : "unread"
                      }`}
                    >
                      {notification.is_read
                        ? "✓"
                        : "🔔"}
                    </div>

                    <div className="notification-content">
                      <div className="notification-meta">
                        <div className="notification-badges">
                          <span className="category-badge">
                            {categoryLabel(
                              notification.category
                            )}
                          </span>

                          <span
                            className={`severity-badge ${severityClass(
                              notification.severity
                            )}`}
                          >
                            {severityLabel(
                              notification.severity
                            )}
                          </span>

                          {!notification.is_read ? (
                            <span className="new-badge">
                              Yeni
                            </span>
                          ) : null}

                          {notification.push_sent ? (
                            <span className="push-badge">
                              📱 Push
                            </span>
                          ) : null}
                        </div>

                        <time>
                          {formatDate(
                            notification.created_at
                          )}
                        </time>
                      </div>

                      <h3>
                        {notification.title}
                      </h3>

                      <p>
                        {content}
                      </p>

                      <div className="notification-actions">
                        {notification.target_path ? (
                          <Link
                            href={
                              notification.target_path
                            }
                            className="open-record-button"
                          >
                            <span>
                              İlgili Kaydı Aç
                            </span>
                            <span>
                              →
                            </span>
                          </Link>
                        ) : null}

                        {!notification.is_read ? (
                          <button
                            type="button"
                            className="state-button read-button"
                            disabled={
                              isPending &&
                              currentlyWorking
                            }
                            onClick={() =>
                              handleMarkRead(
                                notification.id
                              )
                            }
                          >
                            <span>
                              ✓
                            </span>

                            <span>
                              {currentlyWorking
                                ? "İşleniyor..."
                                : "Okundu Yap"}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="state-button unread-button"
                            disabled={
                              isPending &&
                              currentlyWorking
                            }
                            onClick={() =>
                              handleMarkUnread(
                                notification.id
                              )
                            }
                          >
                            <span>
                              ↶
                            </span>

                            <span>
                              {currentlyWorking
                                ? "İşleniyor..."
                                : "Okunmadı Yap"}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>

      <style jsx>{`
        .notification-panel {
          background: linear-gradient(
            180deg,
            #ffffff 0%,
            #fbfdff 100%
          );
          border: 1px solid #dfe7f2;
          border-radius: 24px;
          padding: 24px;
          box-shadow:
            0 18px 50px
              rgba(26, 52, 92, 0.06),
            0 2px 8px
              rgba(26, 52, 92, 0.03);
        }

        .notification-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid
            #edf1f7;
        }

        .notification-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .notification-header h2 {
          margin: 0;
          color: #10213e;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.3px;
        }

        .notification-header p {
          margin: 6px 0 0;
          color: #75839a;
          font-size: 12px;
          line-height: 1.55;
        }

        .unread-counter,
        .all-read-counter {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
        }

        .unread-counter {
          background: #fff0e6;
          color: #d05a16;
          border: 1px solid #ffd9c0;
        }

        .all-read-counter {
          background: #e9f8ef;
          color: #198754;
          border: 1px solid #cdebd9;
        }

        button,
        a {
          -webkit-tap-highlight-color: transparent;
        }

        .mark-all-button {
          min-height: 46px;
          border: 1px solid #d6e4ff;
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            #176be8,
            #0753c8
          );
          color: white;
          padding: 0 17px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          box-shadow:
            0 10px 24px
              rgba(19, 96, 220, 0.22),
            inset 0 1px 0
              rgba(255, 255, 255, 0.2);
          transition:
            transform 0.14s ease,
            box-shadow 0.14s ease,
            background 0.14s ease;
        }

        .mark-all-button:hover:not(
            :disabled
          ) {
          transform: translateY(-2px);
          box-shadow:
            0 14px 28px
              rgba(19, 96, 220, 0.28);
        }

        .mark-all-button:active:not(
            :disabled
          ) {
          transform: translateY(1px)
            scale(0.98);
          box-shadow:
            0 4px 12px
              rgba(19, 96, 220, 0.2),
            inset 0 3px 8px
              rgba(0, 0, 0, 0.12);
        }

        .mark-all-button:disabled {
          background: #d9e1ec;
          color: #93a0b3;
          border-color: #d9e1ec;
          box-shadow: none;
          cursor: not-allowed;
        }

        .button-icon {
          font-size: 14px;
        }

        .feedback-box {
          margin-top: 16px;
          border-radius: 14px;
          padding: 13px 15px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          font-weight: 800;
        }

        .feedback-box.success {
          background: #ebf9f1;
          color: #147a48;
          border: 1px solid #ccebd9;
        }

        .feedback-box.error {
          background: #fff0ee;
          color: #c84035;
          border: 1px solid #ffd4cf;
        }

        .feedback-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(
            255,
            255,
            255,
            0.7
          );
          font-weight: 950;
        }

        .filter-wrapper {
          padding: 20px 0 16px;
        }

        .filter-label {
          color: #8390a5;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }

        .filter-list {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        .filter-button {
          min-height: 40px;
          border: 1px solid #dbe4f0;
          border-radius: 13px;
          background: #ffffff;
          color: #566780;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          box-shadow:
            0 2px 5px
              rgba(26, 52, 92, 0.025);
          transition:
            transform 0.13s ease,
            color 0.13s ease,
            background 0.13s ease,
            border-color 0.13s ease,
            box-shadow 0.13s ease;
        }

        .filter-button:hover {
          color: #135fcf;
          background: #f4f8ff;
          border-color: #bcd3f6;
          transform: translateY(-1px);
          box-shadow:
            0 7px 18px
              rgba(25, 83, 162, 0.08);
        }

        .filter-button:active {
          transform: translateY(1px)
            scale(0.97);
          box-shadow:
            inset 0 3px 7px
              rgba(22, 64, 126, 0.09);
        }

        .filter-button.active {
          background: linear-gradient(
            135deg,
            #176eea,
            #0855cb
          );
          border-color: #0754cb;
          color: #ffffff;
          box-shadow:
            0 10px 23px
              rgba(21, 98, 219, 0.22),
            inset 0 1px 0
              rgba(255, 255, 255, 0.18);
        }

        .filter-button.active:hover {
          color: #ffffff;
          background: linear-gradient(
            135deg,
            #1166df,
            #064cb9
          );
        }

        .filter-icon {
          font-size: 12px;
          font-weight: 950;
        }

        .filter-count {
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          border-radius: 999px;
          background: #f0f3f8;
          color: #7d899b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 950;
        }

        .filter-count.active {
          background: rgba(
            255,
            255,
            255,
            0.2
          );
          color: #ffffff;
        }

        .result-bar {
          min-height: 45px;
          margin-bottom: 12px;
          border-radius: 13px;
          background: #f7f9fc;
          border: 1px solid #edf1f6;
          padding: 0 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #77849a;
          font-size: 10px;
        }

        .result-bar strong {
          color: #364b69;
        }

        .clear-filter-button {
          border: 0;
          background: transparent;
          color: #1264df;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          padding: 8px 4px;
          transition:
            color 0.14s ease,
            transform 0.14s ease;
        }

        .clear-filter-button:hover {
          color: #0746a7;
        }

        .clear-filter-button:active {
          transform: scale(0.95);
        }

        .notification-list {
          display: grid;
          gap: 11px;
        }

        .notification-card {
          position: relative;
          display: flex;
          gap: 14px;
          border-radius: 17px;
          padding: 17px;
          overflow: hidden;
          transition:
            transform 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .notification-card:hover {
          transform: translateY(-1px);
        }

        .notification-card.unread {
          background: linear-gradient(
            135deg,
            #f8fbff 0%,
            #f4f8ff 100%
          );
          border: 1px solid #cbdffc;
          box-shadow:
            0 5px 18px
              rgba(32, 99, 194, 0.06);
        }

        .notification-card.unread::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 4px;
          background: linear-gradient(
            180deg,
            #1773f2,
            #0a55c7
          );
        }

        .notification-card.read {
          background: #ffffff;
          border: 1px solid #e7ecf3;
        }

        .notification-card.read:hover {
          border-color: #d5deea;
          box-shadow:
            0 6px 17px
              rgba(31, 55, 91, 0.05);
        }

        .notification-state-icon {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          font-weight: 900;
        }

        .notification-state-icon.unread {
          background: linear-gradient(
            135deg,
            #e8f2ff,
            #dceaff
          );
          color: #1465dc;
          box-shadow:
            inset 0 0 0 1px #cfe1fb;
        }

        .notification-state-icon.read {
          background: #edf8f2;
          color: #21965e;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .notification-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .category-badge,
        .severity-badge,
        .new-badge,
        .push-badge {
          min-height: 23px;
          padding: 0 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 950;
        }

        .category-badge {
          background: #e6f0ff;
          color: #0e5fd4;
        }

        .severity-badge.info {
          background: #f0f3f7;
          color: #69768a;
        }

        .severity-badge.success {
          background: #e9f8ef;
          color: #18814e;
        }

        .severity-badge.warning {
          background: #fff4df;
          color: #b36a07;
        }

        .severity-badge.critical {
          background: #ffeceb;
          color: #c74338;
        }

        .new-badge {
          background: #fff0e6;
          color: #cf5918;
        }

        .push-badge {
          background: #e9f8ef;
          color: #17804d;
        }

        time {
          color: #98a4b5;
          font-size: 9px;
          font-weight: 700;
        }

        .notification-content h3 {
          color: #152844;
          margin: 10px 0 5px;
          font-size: 14px;
          line-height: 1.4;
          font-weight: 900;
        }

        .notification-content p {
          color: #6d7b91;
          margin: 0;
          font-size: 11px;
          line-height: 1.6;
        }

        .notification-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 13px;
        }

        .open-record-button,
        .state-button {
          min-height: 37px;
          border-radius: 11px;
          padding: 0 11px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 10px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          transition:
            transform 0.13s ease,
            box-shadow 0.13s ease,
            background 0.13s ease,
            border-color 0.13s ease;
        }

        .open-record-button {
          background: #1264e8;
          color: white;
          border: 1px solid #1264e8;
          box-shadow:
            0 6px 14px
              rgba(18, 100, 232, 0.16);
        }

        .open-record-button:hover {
          background: #0758d1;
          box-shadow:
            0 9px 18px
              rgba(18, 100, 232, 0.2);
          transform: translateY(-1px);
        }

        .open-record-button:active {
          transform: translateY(1px)
            scale(0.97);
          box-shadow:
            inset 0 3px 8px
              rgba(0, 0, 0, 0.12);
        }

        .state-button {
          border: 1px solid;
        }

        .read-button {
          background: #ecf8f2;
          color: #187b4c;
          border-color: #caead8;
        }

        .read-button:hover {
          background: #dcf3e7;
          border-color: #a8dbbf;
          transform: translateY(-1px);
          box-shadow:
            0 7px 16px
              rgba(30, 133, 83, 0.1);
        }

        .unread-button {
          background: #f5f7fb;
          color: #5e6f87;
          border-color: #dde4ee;
        }

        .unread-button:hover {
          background: #edf2fa;
          border-color: #cbd8e8;
          color: #2c527d;
          transform: translateY(-1px);
        }

        .state-button:active {
          transform: translateY(1px)
            scale(0.97);
          box-shadow:
            inset 0 3px 7px
              rgba(20, 48, 82, 0.09);
        }

        .state-button:disabled {
          opacity: 0.58;
          cursor: wait;
          transform: none;
        }

        .empty-state {
          padding: 65px 20px;
          border: 1px dashed #dbe3ef;
          border-radius: 18px;
          background: #fbfcfe;
          text-align: center;
        }

        .empty-icon {
          font-size: 32px;
          margin-bottom: 10px;
        }

        .empty-state h3 {
          margin: 0;
          color: #263955;
          font-size: 16px;
          font-weight: 900;
        }

        .empty-state p {
          max-width: 430px;
          margin: 8px auto 16px;
          color: #8490a3;
          font-size: 11px;
          line-height: 1.6;
        }

        .empty-button {
          min-height: 39px;
          border: 1px solid #d8e3f2;
          border-radius: 11px;
          background: white;
          color: #145fcf;
          padding: 0 13px;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.13s ease,
            background 0.13s ease,
            box-shadow 0.13s ease;
        }

        .empty-button:hover {
          background: #f2f7ff;
          box-shadow:
            0 7px 15px
              rgba(17, 83, 166, 0.08);
          transform: translateY(-1px);
        }

        .empty-button:active {
          transform: translateY(1px)
            scale(0.97);
        }

        @media (max-width: 800px) {
          .notification-panel {
            padding: 16px;
            border-radius: 19px;
          }

          .notification-header {
            align-items: stretch;
            flex-direction: column;
          }

          .mark-all-button {
            width: 100%;
          }

          .filter-list {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .filter-button {
            width: 100%;
          }

          .notification-card {
            padding: 14px;
            gap: 10px;
          }

          .notification-state-icon {
            width: 38px;
            height: 38px;
            flex-basis: 38px;
            border-radius: 12px;
          }

          .notification-meta {
            align-items: flex-start;
            flex-direction: column;
            gap: 7px;
          }

          .notification-actions {
            display: grid;
            grid-template-columns:
              1fr;
          }

          .open-record-button,
          .state-button {
            width: 100%;
          }

          .result-bar {
            align-items: flex-start;
            flex-direction: column;
            padding: 10px 12px;
          }
        }

        @media (max-width: 430px) {
          .filter-list {
            grid-template-columns:
              1fr;
          }

          .notification-panel {
            padding: 13px;
          }
        }
      `}</style>
    </>
  );
}

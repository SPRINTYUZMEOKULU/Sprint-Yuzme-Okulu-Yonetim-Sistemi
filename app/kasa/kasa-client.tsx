"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import { useRouter } from "next/navigation";

import {
  approveCashHandover,
  requestCashHandover,
} from "../odemeler/actions";

export type CashPaymentRow = {
  id: string;

  student_id: string | null;
  student_number: string | null;
  student_name: string;
  contact_phone: string | null;

  amount: number;
  currency: string;

  payment_method: string | null;
  payment_status: string | null;
  description: string | null;

  received_at: string | null;
  received_by: string | null;
  received_by_name: string | null;

  cash_handover_status: string | null;
  cash_handover_requested_at: string | null;
  cash_handover_approved_by: string | null;
  cash_handover_approved_at: string | null;

  cancelled_at: string | null;
  cancellation_reason: string | null;
};

type Props = {
  rows: CashPaymentRow[];
  currentProfileId: string;
};

type FilterKey =
  | "all"
  | "cash"
  | "card"
  | "transfer"
  | "with_staff"
  | "handoff_pending"
  | "confirmed"
  | "cancelled";

function money(value: unknown) {
  const number = Number(value ?? 0);

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(
    Number.isFinite(number) ? number : 0
  );
}

function dateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalize(value?: string | null) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function paymentMethodLabel(
  method?: string | null
) {
  switch (method) {
    case "cash":
      return "Nakit";

    case "card":
      return "Kart";

    case "bank_transfer":
      return "Havale";

    case "eft":
      return "EFT";

    case "other":
      return "Diğer";

    default:
      return method || "—";
  }
}

function cashStatusLabel(
  status?: string | null
) {
  switch (status) {
    case "with_staff":
      return "Personelde";

    case "handoff_pending":
      return "Teslim Onayı Bekliyor";

    case "main_cash_confirmed":
      return "Ana Kasaya Teslim";

    default:
      return status || "—";
  }
}

export default function KasaClient({
  rows,
}: Props) {
  const router = useRouter();

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<FilterKey>("all");

  const [
    actionMessage,
    setActionMessage,
  ] = useState("");

  const validRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          !row.cancelled_at &&
          normalize(row.payment_status) !==
            "cancelled"
      ),
    [rows]
  );

  const total = validRows.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  const cash = validRows
    .filter(
      (row) =>
        row.payment_method === "cash"
    )
    .reduce(
      (sum, row) => sum + row.amount,
      0
    );

  const card = validRows
    .filter(
      (row) =>
        row.payment_method === "card"
    )
    .reduce(
      (sum, row) => sum + row.amount,
      0
    );

  const transfer = validRows
    .filter((row) =>
      [
        "bank_transfer",
        "eft",
      ].includes(
        row.payment_method || ""
      )
    )
    .reduce(
      (sum, row) => sum + row.amount,
      0
    );

  const withStaff = validRows
    .filter(
      (row) =>
        row.payment_method ===
          "cash" &&
        row.cash_handover_status ===
          "with_staff"
    )
    .reduce(
      (sum, row) => sum + row.amount,
      0
    );

  const pending = validRows
    .filter(
      (row) =>
        row.payment_method ===
          "cash" &&
        row.cash_handover_status ===
          "handoff_pending"
    )
    .reduce(
      (sum, row) => sum + row.amount,
      0
    );

  const confirmed = validRows
    .filter(
      (row) =>
        row.cash_handover_status ===
          "main_cash_confirmed"
    )
    .reduce(
      (sum, row) => sum + row.amount,
      0
    );

  const filteredRows = useMemo(() => {
    const query = normalize(search);

    let result = rows.filter((row) => {
      if (!query) return true;

      const haystack = normalize(
        [
          row.student_name,
          row.student_number,
          row.contact_phone,
          row.description,
          row.received_by_name,
          paymentMethodLabel(
            row.payment_method
          ),
        ]
          .filter(Boolean)
          .join(" ")
      );

      return haystack.includes(query);
    });

    switch (filter) {
      case "cash":
        result = result.filter(
          (row) =>
            row.payment_method === "cash" &&
            !row.cancelled_at
        );
        break;

      case "card":
        result = result.filter(
          (row) =>
            row.payment_method === "card" &&
            !row.cancelled_at
        );
        break;

      case "transfer":
        result = result.filter(
          (row) =>
            [
              "bank_transfer",
              "eft",
            ].includes(
              row.payment_method || ""
            ) && !row.cancelled_at
        );
        break;

      case "with_staff":
        result = result.filter(
          (row) =>
            row.cash_handover_status ===
              "with_staff" &&
            !row.cancelled_at
        );
        break;

      case "handoff_pending":
        result = result.filter(
          (row) =>
            row.cash_handover_status ===
              "handoff_pending" &&
            !row.cancelled_at
        );
        break;

      case "confirmed":
        result = result.filter(
          (row) =>
            row.cash_handover_status ===
              "main_cash_confirmed" &&
            !row.cancelled_at
        );
        break;

      case "cancelled":
        result = result.filter(
          (row) =>
            !!row.cancelled_at ||
            normalize(
              row.payment_status
            ) === "cancelled"
        );
        break;
    }

    return result;
  }, [rows, search, filter]);

  function requestHandover(
    paymentId: string
  ) {
    setActionMessage("");

    startTransition(async () => {
      const result =
        await requestCashHandover(
          paymentId
        );

      setActionMessage(
        result.message
      );

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function approveHandover(
    paymentId: string
  ) {
    setActionMessage("");

    startTransition(async () => {
      const result =
        await approveCashHandover(
          paymentId
        );

      setActionMessage(
        result.message
      );

      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <>
      <section className="cashSummaryGrid">
        <button
          type="button"
          className="cashSummaryCard"
          onClick={() =>
            setFilter("all")
          }
        >
          <span>
            Bugün Toplam Tahsilat
          </span>
          <strong>{money(total)}</strong>
        </button>

        <button
          type="button"
          className="cashSummaryCard"
          onClick={() =>
            setFilter("cash")
          }
        >
          <span>Nakit</span>
          <strong>{money(cash)}</strong>
        </button>

        <button
          type="button"
          className="cashSummaryCard"
          onClick={() =>
            setFilter("card")
          }
        >
          <span>Kart</span>
          <strong>{money(card)}</strong>
        </button>

        <button
          type="button"
          className="cashSummaryCard"
          onClick={() =>
            setFilter("transfer")
          }
        >
          <span>Havale / EFT</span>
          <strong>
            {money(transfer)}
          </strong>
        </button>

        <button
          type="button"
          className="cashSummaryCard warning"
          onClick={() =>
            setFilter("with_staff")
          }
        >
          <span>Personelde Nakit</span>
          <strong>
            {money(withStaff)}
          </strong>
        </button>

        <button
          type="button"
          className="cashSummaryCard warning"
          onClick={() =>
            setFilter(
              "handoff_pending"
            )
          }
        >
          <span>
            Teslim Onayı Bekleyen
          </span>
          <strong>
            {money(pending)}
          </strong>
        </button>

        <button
          type="button"
          className="cashSummaryCard success"
          onClick={() =>
            setFilter("confirmed")
          }
        >
          <span>
            Ana Kasaya Teslim
          </span>
          <strong>
            {money(confirmed)}
          </strong>
        </button>
      </section>

      <section className="cashToolbar">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Öğrenci, telefon, açıklama veya personel ara..."
        />

        <select
          value={filter}
          onChange={(event) =>
            setFilter(
              event.target
                .value as FilterKey
            )
          }
        >
          <option value="all">
            Tüm Hareketler
          </option>

          <option value="cash">
            Nakit
          </option>

          <option value="card">
            Kart
          </option>

          <option value="transfer">
            Havale / EFT
          </option>

          <option value="with_staff">
            Personelde
          </option>

          <option value="handoff_pending">
            Teslim Onayı Bekleyen
          </option>

          <option value="confirmed">
            Ana Kasaya Teslim
          </option>

          <option value="cancelled">
            İptal Edilenler
          </option>
        </select>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setFilter("all");
          }}
        >
          Filtreleri Temizle
        </button>
      </section>

      {actionMessage ? (
        <div className="cashActionMessage">
          {actionMessage}
        </div>
      ) : null}

      <section className="cashCard">
        <div className="cashCardHeader">
          <div>
            <p>GÜNLÜK HAREKET</p>

            <h2>
              Bugün Alınan Ödemeler
            </h2>
          </div>

          <strong>
            {filteredRows.length} işlem
          </strong>
        </div>

        <div className="responsiveTable">
          <table>
            <thead>
              <tr>
                <th>Saat</th>
                <th>Öğrenci</th>
                <th>Tutar</th>
                <th>Yöntem</th>
                <th>Alan Personel</th>
                <th>Kasa Durumu</th>
                <th>Açıklama</th>
                <th>İşlem</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map(
                (row) => (
                  <tr key={row.id}>
                    <td>
                      {dateTime(
                        row.received_at
                      )}
                    </td>

                    <td>
                      <strong>
                        {row.student_name}
                      </strong>

                      <small>
                        {row.student_number ||
                          row.contact_phone ||
                          "—"}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {money(row.amount)}
                      </strong>
                    </td>

                    <td>
                      {paymentMethodLabel(
                        row.payment_method
                      )}
                    </td>

                    <td>
                      {row.received_by_name ||
                        "—"}
                    </td>

                    <td>
                      <span
                        className={`cashBadge ${
                          row.cash_handover_status ||
                          "unknown"
                        }`}
                      >
                        {cashStatusLabel(
                          row.cash_handover_status
                        )}
                      </span>
                    </td>

                    <td>
                      {row.cancelled_at ? (
                        <span className="cancelledText">
                          İptal:{" "}
                          {row.cancellation_reason ||
                            "Açıklama yok"}
                        </span>
                      ) : (
                        row.description ||
                        "—"
                      )}
                    </td>

                    <td>
                      {row.cancelled_at ? (
                        <span>İptal Edildi</span>
                      ) : row.payment_method !==
                        "cash" ? (
                        <span>
                          Kasa teslimi yok
                        </span>
                      ) : row.cash_handover_status ===
                        "with_staff" ? (
                        <button
                          type="button"
                          disabled={
                            isPending
                          }
                          onClick={() =>
                            requestHandover(
                              row.id
                            )
                          }
                        >
                          Kasaya Teslim Et
                        </button>
                      ) : row.cash_handover_status ===
                        "handoff_pending" ? (
                        <button
                          type="button"
                          disabled={
                            isPending
                          }
                          className="approveButton"
                          onClick={() =>
                            approveHandover(
                              row.id
                            )
                          }
                        >
                          Teslimi Onayla
                        </button>
                      ) : (
                        <span>
                          ✓ Tamamlandı
                        </span>
                      )}
                    </td>
                  </tr>
                )
              )}

              {!filteredRows.length ? (
                <tr>
                  <td
                    colSpan={8}
                    className="tableEmpty"
                  >
                    Seçilen filtreye uygun
                    ödeme hareketi
                    bulunmuyor.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .cashSummaryGrid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 12px;
          margin-bottom: 16px;
        }

        .cashSummaryCard {
          appearance: none;
          border: 1px solid #dbe5f1;
          background: #fff;
          border-radius: 18px;
          min-height: 100px;
          padding: 18px;
          text-align: left;
          cursor: pointer;
        }

        .cashSummaryCard span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .cashSummaryCard strong {
          color: #10213a;
          font-size: 22px;
        }

        .cashSummaryCard.warning {
          border-color: #fed7aa;
        }

        .cashSummaryCard.success {
          border-color: #bbf7d0;
        }

        .cashToolbar,
        .cashCard {
          background: #fff;
          border: 1px solid #dbe5f1;
          border-radius: 18px;
          margin-bottom: 16px;
        }

        .cashToolbar {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            250px
            auto;
          gap: 10px;
          padding: 14px;
        }

        .cashToolbar input,
        .cashToolbar select,
        .cashToolbar button {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe5f1;
          border-radius: 12px;
          background: #fff;
          padding: 11px 13px;
          font: inherit;
          color: #10213a;
        }

        .cashToolbar button {
          width: auto;
          font-weight: 800;
          cursor: pointer;
        }

        .cashActionMessage {
          margin-bottom: 16px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          border-radius: 14px;
          padding: 12px 14px;
          color: #1d4ed8;
          font-weight: 700;
        }

        .cashCard {
          overflow: hidden;
        }

        .cashCardHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 17px 18px;
          border-bottom: 1px solid #e2e8f0;
        }

        .cashCardHeader p {
          margin: 0 0 4px;
          color: #2563eb;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .cashCardHeader h2 {
          margin: 0;
          color: #10213a;
          font-size: 18px;
        }

        .cashCardHeader > strong {
          color: #64748b;
          font-size: 12px;
        }

        .responsiveTable {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1080px;
        }

        th,
        td {
          padding: 13px 14px;
          border-bottom: 1px solid #eef2f7;
          text-align: left;
          color: #334155;
          vertical-align: middle;
          font-size: 12px;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        td strong {
          color: #10213a;
        }

        td small {
          display: block;
          color: #94a3b8;
          margin-top: 3px;
        }

        td button {
          border: 1px solid #dbe5f1;
          background: #fff;
          border-radius: 9px;
          padding: 8px 10px;
          cursor: pointer;
          font-weight: 800;
          color: #10213a;
        }

        td button.approveButton {
          background: #156ff5;
          border-color: #156ff5;
          color: #fff;
        }

        td button:disabled {
          opacity: 0.55;
          cursor: wait;
        }

        .cashBadge {
          display: inline-block;
          border-radius: 999px;
          padding: 6px 9px;
          background: #f1f5f9;
          color: #475569;
          font-weight: 800;
          white-space: nowrap;
        }

        .cashBadge.with_staff {
          background: #fff7ed;
          color: #c2410c;
        }

        .cashBadge.handoff_pending {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .cashBadge.main_cash_confirmed {
          background: #ecfdf3;
          color: #047857;
        }

        .cancelledText {
          color: #b42318;
          font-weight: 700;
        }

        .tableEmpty {
          padding: 35px !important;
          text-align: center;
          color: #64748b;
        }

        @media (max-width: 1100px) {
          .cashSummaryGrid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 720px) {
          .cashToolbar {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .cashSummaryGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

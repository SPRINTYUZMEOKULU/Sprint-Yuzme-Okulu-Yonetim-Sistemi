"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import {
  addLegacyTransferCompensation,
  managerConfirmLegacyTransfer,
} from "./legacy-transfer-actions";

type Props = {
  studentId: string;
  visible: boolean;
  canManagerConfirm: boolean;
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function LegacyTransferControls({
  studentId,
  visible,
  canManagerConfirm,
}: Props) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const searchParams = useSearchParams();
  const addedCount = Number(searchParams.get("legacy_compensation_added") || 0);
  const newEndDate = formatDate(searchParams.get("legacy_compensation_end"));

  useEffect(() => {
    setTarget(document.querySelector<HTMLElement>("#onaylar"));
  }, []);

  if (!visible || !target) return null;

  return createPortal(
    <div
      style={{
        marginTop: 18,
        border: "1px solid #bfdbfe",
        borderRadius: 22,
        padding: 18,
        background: "linear-gradient(180deg,#eff6ff 0%,#ffffff 100%)",
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "grid", gap: 5 }}>
        <small style={{ color: "#2563eb", fontWeight: 900, letterSpacing: ".08em" }}>
          ESKİ SİSTEMDEN AKTARILAN KURSİYER
        </small>
        <strong style={{ color: "#172f4f", fontSize: 20 }}>
          Yönetici Teyidi ile Eksik Kontrolleri Geç
        </strong>
        <span style={{ color: "#64748b", lineHeight: 1.55 }}>
          Ön kayıt elektronik sağlık beyanı veya kural kabul kaydı bulunmayan eski öğrenciler için kullanılır.
          Yönetici teyidi işlem geçmişine kaydedilir ve veli onayı olarak gösterilmez.
        </span>
      </div>

      {addedCount > 0 ? (
        <div
          style={{
            padding: "13px 14px",
            borderRadius: 14,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#166534",
            display: "grid",
            gap: 4,
          }}
        >
          <strong>✓ İşlem başarıyla kaydedildi</strong>
          <span>
            {addedCount} adet telafi dersi eklendi.
            {newEndDate ? ` Telafi sonrası yeni bitiş tarihi: ${newEndDate}.` : ""}
          </span>
        </div>
      ) : null}

      <input type="hidden" name="legacy_student_id" value={studentId} />

      <label style={{ display: "grid", gap: 7 }}>
        <span style={{ color: "#334155", fontWeight: 800 }}>Aktarımdan gelen telafi dersi</span>
        <input
          type="number"
          name="legacy_compensation_count"
          min={0}
          max={100}
          step={1}
          defaultValue={0}
          inputMode="numeric"
          style={{
            minHeight: 48,
            borderRadius: 14,
            border: "1px solid #cbd5e1",
            padding: "0 14px",
            fontSize: 17,
            background: "#fff",
          }}
        />
        <small style={{ color: "#64748b" }}>
          Telafi yoksa 0 bırakın. Eklediğiniz telafi, mevcut planlanan bitiş tarihinin üzerine öğrencinin gerçek ders günlerine göre otomatik eklenir.
        </small>
      </label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 10,
        }}
      >
        <button
          type="submit"
          formAction={addLegacyTransferCompensation}
          style={{
            minHeight: 48,
            borderRadius: 14,
            border: "1px solid #93c5fd",
            background: "#fff",
            color: "#1d4ed8",
            fontWeight: 900,
            padding: "0 14px",
          }}
        >
          Sadece Telafi Ekle
        </button>

        {canManagerConfirm ? (
          <button
            type="submit"
            formAction={managerConfirmLegacyTransfer}
            style={{
              minHeight: 50,
              borderRadius: 14,
              border: 0,
              background: "#2563eb",
              color: "#fff",
              fontWeight: 900,
              padding: "0 16px",
            }}
          >
            Yönetici Teyidi · Kaydı Direkt Aktar
          </button>
        ) : (
          <div
            style={{
              borderRadius: 14,
              padding: "12px 14px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              fontWeight: 800,
              lineHeight: 1.45,
            }}
          >
            Yönetici teyidi yalnızca Owner / Admin hesabından verilebilir.
          </div>
        )}
      </div>
    </div>,
    target
  );
}

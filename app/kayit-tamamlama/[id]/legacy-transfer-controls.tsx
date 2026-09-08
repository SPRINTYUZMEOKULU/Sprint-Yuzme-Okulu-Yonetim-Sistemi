"use client";

import { useEffect, useState } from "react";
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

export default function LegacyTransferControls({
  studentId,
  visible,
  canManagerConfirm,
}: Props) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

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
          Telafi yoksa 0 bırakın. Sadece telafi eklemek için aşağıdaki ayrı butonu kullanabilirsiniz.
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

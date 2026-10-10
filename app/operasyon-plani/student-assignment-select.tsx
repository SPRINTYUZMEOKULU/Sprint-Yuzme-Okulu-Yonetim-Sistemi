"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  action: (data: FormData) => Promise<void>;
  name: string;
  value: string;
  label: string;
  emptyLabel: string;
  allowEmpty?: boolean;
  options: { value: string; label: string }[];
  fields: Record<string, string>;
};

export default function StudentAssignmentSelect(props: Props) {
  const router = useRouter();
  const [value, setValue] = useState(props.value);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (!busy.current && !dirty.current) setValue(props.value);
  }, [props.value]);

  async function save(chosen: string) {
    if (busy.current || (props.allowEmpty === false && !chosen)) return;
    busy.current = true;
    setPending(true);
    setMessage("Kaydediliyor…");
    setError(false);
    const data = new FormData();
    for (const [key, entry] of Object.entries(props.fields)) data.set(key, entry);
    data.set(props.name, chosen);
    try {
      await props.action(data);
      dirty.current = false;
      setMessage("✓ Kaydedildi ve doğrulandı");
      router.refresh();
    } catch (reason) {
      setError(true);
      setMessage(reason instanceof Error ? reason.message : "Kaydedilemedi. Seçiminiz korunuyor; yeniden deneyin.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  // Keep saved values visible even when an older assignment is no longer selectable.
  const options = props.options.some((option) => option.value === value) || !value
    ? props.options : [{ value, label: "Kayıtlı eğitmen (listede yok)" }, ...props.options];

  return <div style={{ width: "100%", minWidth: 0 }}>
    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
      {props.label}
      <select aria-label={props.label} name={props.name} value={value} disabled={pending}
        onChange={(event) => {
          const chosen = event.target.value;
          dirty.current = true;
          setValue(chosen);
          void save(chosen);
        }}
        style={{ display: "block", width: "100%", marginTop: 5, padding: "11px 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#fff", color: "#10213a", fontSize: 14 }}>
        <option value="" disabled={props.allowEmpty === false}>{props.emptyLabel}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <div role="status" aria-live="polite" style={{ minHeight: 22, fontSize: 12, color: error ? "#b91c1c" : "#15803d" }}>
      {message || "Seçiminiz otomatik kaydedilir."}
      {error && <button type="button" disabled={pending} onClick={() => void save(value)} style={{ marginLeft: 8 }}>Yeniden dene</button>}
    </div>
  </div>;
}

"use client";

import { useRef, useState } from "react";

export default function CopyIban({ iban }: { iban: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(iban.replace(/\s/g, ""));
      setMessage("IBAN kopyalandı.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setMessage("IBAN seçildi. Telefonunuzun kopyalama seçeneğini kullanabilirsiniz.");
    }
  }

  return <div className="bank-copy">
    <input ref={input} aria-label="VakıfBank IBAN" value={iban} readOnly />
    <button type="button" onClick={copy}>IBAN’ı Kopyala</button>
    <p role="status">{message}</p>
  </div>;
}

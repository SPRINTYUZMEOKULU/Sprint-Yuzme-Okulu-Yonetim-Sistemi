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

export function CopyAccountOwner({ name }: { name: string }) {
  const [message, setMessage] = useState("");
  async function copyName() {
    try {
      await navigator.clipboard.writeText(name);
      setMessage("Hesap sahibi kopyalandı ✓");
    } catch {
      setMessage("Kopyalanamadı. Hesap sahibinin adını seçerek kopyalayabilirsiniz.");
    }
  }
  return <div className="bank-copy"><strong className="account-owner-name">{name}</strong><button type="button" onClick={copyName}>Hesap Sahibini Kopyala</button><span role="status" className="copy-feedback">{message}</span></div>;
}

export function PaymentBackLink() {
  const [hint, setHint] = useState("");
  function goBack() {
    // External payment links often open in an isolated WhatsApp browser with no history.
    // Never send guardians to the marketing homepage as a fallback.
    const referrer = document.referrer;
    if (referrer) {
      try {
        const url = new URL(referrer);
        const isMarketingSite = ["sprintyuzmekursu.com", "www.sprintyuzmekursu.com"].includes(url.hostname);
        if (!isMarketingSite && url.href !== window.location.href && window.history.length > 1) {
          window.history.back();
          return;
        }
      } catch { /* no usable referrer */ }
    }
    setHint("Bu güvenli bağlantı doğrudan açıldı. Önceki ekrana dönmek için WhatsApp’a veya tarayıcınızın geri tuşuna geçebilirsiniz. Ödeme bilgileriniz bu sayfada korunur.");
  }
  return <nav className="payment-back-nav" aria-label="Sayfa gezinme"><button type="button" onClick={goBack} aria-label="Geri dön">← Geri Dön</button>{hint && <p role="status" className="payment-back-hint">{hint}</p>}</nav>;
}

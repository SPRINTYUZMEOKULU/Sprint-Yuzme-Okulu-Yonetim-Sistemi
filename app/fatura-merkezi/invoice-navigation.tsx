"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InvoiceNavigation({ home = "/" }: { home?: string }) {
  const router = useRouter();
  return <div className="invoice-header-actions" aria-label="Fatura Merkezi gezinme">
    <button type="button" className="invoice-back" onClick={() => {
      if (typeof window !== "undefined" && window.history.length > 1) router.back();
      else router.push(home);
    }} aria-label="Önceki sayfaya geri dön">
      <span aria-hidden="true">←</span> Geri
    </button>
    <Link href={home} className="invoice-home" aria-label="Ana sayfaya dön">⌂ <span>Ana Sayfa</span></Link>
    <button type="button" className="invoice-reload" onClick={() => router.refresh()} aria-label="Fatura Merkezi verilerini yenile">
      <span aria-hidden="true">↻</span> <span>Yenile</span>
    </button>
  </div>;
}

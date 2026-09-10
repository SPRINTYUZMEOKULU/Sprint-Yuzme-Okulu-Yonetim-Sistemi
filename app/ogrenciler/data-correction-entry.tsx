"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DataCorrectionEntry() {
  const pathname = usePathname();
  if (pathname !== "/ogrenciler") return null;
  return (
    <div className="dataCorrectionEntry">
      <div>
        <span>VERİ KALİTE / TOPLU DÜZELTME</span>
        <strong>Eksik öğrenci ve veli bilgilerini Excel üzerinden düzenleyin</strong>
        <small>Ad Soyad + SPR öğrenci numarası birlikte görünür; ödeme, paket, ders, iletişim ve kayıt kontrolleri aynı raporda yer alır.</small>
      </div>
      <Link href="/ogrenciler/veri-duzeltme">Veri Düzeltme Merkezi →</Link>
      <style jsx>{`
        .dataCorrectionEntry{max-width:1500px;margin:0 auto 16px;padding:16px 18px;border:1px solid #b9d7fb;border-radius:18px;background:linear-gradient(135deg,#f7fbff 0%,#edf6ff 100%);display:flex;align-items:center;justify-content:space-between;gap:18px;box-shadow:0 8px 24px rgba(20,78,145,.06)}
        .dataCorrectionEntry div{display:grid;gap:4px}.dataCorrectionEntry span{color:#176de9;font-size:10px;font-weight:950;letter-spacing:.13em}.dataCorrectionEntry strong{color:#10284d;font-size:15px}.dataCorrectionEntry small{color:#71839b;font-size:11px;line-height:1.4}.dataCorrectionEntry :global(a){flex:0 0 auto;padding:12px 16px;border-radius:12px;background:#176de9;color:#fff;text-decoration:none;font-size:12px;font-weight:900;box-shadow:0 7px 18px rgba(23,109,233,.2)}
        @media(max-width:760px){.dataCorrectionEntry{margin:0 14px 14px;align-items:stretch;flex-direction:column}.dataCorrectionEntry :global(a){text-align:center}}
      `}</style>
    </div>
  );
}

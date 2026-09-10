"use client";

import { usePathname } from "next/navigation";
import UstGezinme from "./UstGezinme";

const LOCAL_NAV_PREFIXES = [
  "/kesin-kayit-merkezi",
  "/veliler",
  "/veli-talepleri",
  "/kullanicilar-ve-yetkiler",
  "/denetim-merkezi",
  "/kayit-yenilemeleri",
  "/operasyon-plani",
  "/ogrenciler/veri-duzeltme",
];

const MANAGEMENT_PREFIXES = [
  "/on-kayitlar",
  "/ogrenciler",
  "/baslayacak-kursiyerler",
  "/subeler",
  "/gruplar",
  "/ders-programi",
  "/yoklama",
  "/odemeler",
  "/kasa",
  "/onay-merkezi",
  "/raporlar",
  "/mesajlar",
  "/ayarlar",
];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function GlobalDesktopNav() {
  const pathname = usePathname();

  // Giriş, veli portalı, ön kayıt formu ve ana dashboard gibi özel ekranların
  // kendi yerleşimini bozmayız. Yönetim modüllerinde ortak üst menüyü tek kaynak yaparız.
  if (!startsWithAny(pathname, MANAGEMENT_PREFIXES)) return null;
  if (startsWithAny(pathname, LOCAL_NAV_PREFIXES)) return null;

  return <UstGezinme />;
}

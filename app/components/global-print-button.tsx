"use client";

import { usePathname } from "next/navigation";

export default function GlobalPrintButton() {
  const pathname = usePathname();

  // Bu ekranlarda çıktı butonu görünmesin
  const hiddenRoutes = [
    "/login",
    "/on-kayit",
    "/auth",
  ];

  const hidden = hiddenRoutes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`)
  );

  if (hidden) return null;

  function handlePrint() {
    window.print();
  }

  return (
    <button
      type="button"
      className="sprintGlobalPrintButton no-print"
      onClick={handlePrint}
      aria-label="Sayfanın çıktısını al"
      title="Çıktı Al / PDF Kaydet"
    >
      <span aria-hidden="true">🖨️</span>
      <span>Çıktı Al</span>
    </button>
  );
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",

    name: "SPRİNT YÜZME OKULU · SprintOS",
    short_name: "SprintOS",

    description:
      "Sprint Yüzme Okulu yönetim, öğrenci, ödeme, yoklama ve operasyon sistemi.",

    start_url: "/",
    scope: "/",

    display: "standalone",

    background_color: "#061a42",
    theme_color: "#061a42",

    orientation: "portrait",

    categories: [
      "business",
      "education",
      "productivity",
    ],

    icons: [
      { src: "/icons/sprint-pwa-splash.svg?v=8", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
      {
        src: "/icons/icon-192.png?v=7",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png?v=7",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

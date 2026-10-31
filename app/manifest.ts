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
      { src: "/icons/sprint-pwa-splash.svg?v=9", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icons/sprint-pwa-splash.svg?v=9", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}

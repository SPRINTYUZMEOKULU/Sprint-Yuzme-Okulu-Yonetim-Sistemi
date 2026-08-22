import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",

    name: "SprintOS - Yüzme Okulu Yönetimi",
    short_name: "SprintOS",

    description:
      "Sprint Yüzme Okulu yönetim, öğrenci, ödeme, yoklama ve operasyon sistemi.",

    start_url: "/",
    scope: "/",

    display: "standalone",

    background_color: "#03132f",
    theme_color: "#03132f",

    orientation: "portrait",

    categories: [
      "business",
      "education",
      "productivity",
    ],

    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

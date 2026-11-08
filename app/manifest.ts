import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jatah",
    short_name: "Jatah",
    description: "Pencatat uang pribadi: berapa yang boleh kamu belanjakan hari ini.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F0E4",
    theme_color: "#F6F0E4",
    lang: "id",
    icons: [
      { src: "/ikon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/ikon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/ikon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

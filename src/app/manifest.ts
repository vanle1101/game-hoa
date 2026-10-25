import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "LIFE//LEVEL — Neon Haven", short_name: "LIFE//LEVEL", description: "Cuộc sống của bạn, một thế giới để phát triển.", start_url: "/", scope: "/", display: "standalone", orientation: "any", lang: "vi", background_color: "#080d18", theme_color: "#080d18", icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }, { src: "/icons/maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }] };
}

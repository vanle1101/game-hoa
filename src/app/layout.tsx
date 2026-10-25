import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIFE//LEVEL — Neon Haven",
  description: "Mô phỏng cuộc sống 3D, nhiệm vụ thực tế và hành trình phát triển của riêng bạn.",
  manifest: "/manifest.webmanifest",
  applicationName: "LIFE//LEVEL",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
  appleWebApp: { capable: true, title: "LIFE//LEVEL", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#080d18", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}

import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.LIFELEVEL_BUILD_DIR || ".next",
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com", "*.loca.lt", "*.lhr.life"],
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
    ] }];
  },
};
export default nextConfig;

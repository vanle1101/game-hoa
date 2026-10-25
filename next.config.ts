import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com", "*.loca.lt", "*.lhr.life"],
};
export default nextConfig;

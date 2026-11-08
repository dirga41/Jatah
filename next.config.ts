import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sembunyikan tanda "N" saat npm run dev; error kompilasi dan runtime tetap ditampilkan Next.js.
  devIndicators: false,
  // Service worker selalu dicek ulang ke server, supaya versi barunya cepat terpasang.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// Sembunyikan tanda "N" saat npm run dev; error kompilasi dan runtime tetap ditampilkan Next.js.
const nextConfig: NextConfig = { devIndicators: false };

export default nextConfig;

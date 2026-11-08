import type { Metadata, Viewport } from "next";
import { DM_Sans, Nunito } from "next/font/google";
import { PendaftarSW, Penjaga } from "@/components/ui";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-nunito" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "Jatah",
  description: "Pencatat uang pribadi: berapa yang boleh kamu belanjakan hari ini.",
  icons: { icon: "/ikon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F0E4" },
    { media: "(prefers-color-scheme: dark)", color: "#1F1D18" },
  ],
};

// Dijalankan sebelum halaman tampil supaya tidak ada kilatan layar terang.
// Pilihan "jatah:tema" (terang/gelap) menang; selain itu ikut perangkat. Kalau penyimpanan gagal, ikut perangkat.
const SKRIP_TEMA = `(function(){
var m=window.matchMedia("(prefers-color-scheme: dark)");
window.pasangTema=function(){
  var t=null;try{t=localStorage.getItem("jatah:tema")}catch(e){}
  var tema=t==="terang"||t==="gelap"?t:(m.matches?"gelap":"terang");
  document.documentElement.setAttribute("data-tema",tema);
  var warna=tema==="gelap"?"#1F1D18":"#F6F0E4";
  document.querySelectorAll('meta[name="theme-color"]').forEach(function(x){x.setAttribute("content",warna)});
};
window.pasangTema();
m.addEventListener("change",window.pasangTema);
document.addEventListener("DOMContentLoaded",window.pasangTema);
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${nunito.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body className="font-sans antialiased">
        <Penjaga>{children}</Penjaga>
        <PendaftarSW />
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { akhirBulan, rupiah, tambahHari, type Status } from "@/lib/hitung";
import { muat, useSesi, type Keadaan } from "@/lib/simpan";
import { variabelKurang } from "@/lib/supabase";

export const tombolUtama =
  "min-h-11 rounded-xl bg-hijau px-4 font-semibold text-di-hijau disabled:opacity-50 disabled:cursor-not-allowed";
export const tombolKedua =
  "min-h-11 rounded-xl border border-garis bg-permukaan px-4 font-semibold text-teks disabled:opacity-50 disabled:cursor-not-allowed";
export const kolom = "min-h-11 w-full rounded-xl border border-garis bg-permukaan px-3 text-teks";
export const label = "block text-sm font-semibold text-teks mb-1";

export const warnaStatus: Record<Status, string> = {
  Aman: "text-hijau",
  "Hampir habis": "text-oranye",
  "Lewat jatah": "text-merah",
};
export const latarStatus: Record<Status, string> = {
  Aman: "bg-hijau",
  "Hampir habis": "bg-oranye",
  "Lewat jatah": "bg-merah",
};

const MENU = [
  { href: "/", teks: "Beranda" },
  { href: "/ringkasan", teks: "Ringkasan" },
];

export function MenuBawah() {
  const path = usePathname();
  return (
    <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 border-t border-garis bg-permukaan">
      <ul className="mx-auto flex max-w-[430px] items-center gap-1 px-2 py-2">
        {MENU.map((m) => (
          <li key={m.href} className="flex-1">
            <Link
              href={m.href}
              aria-current={path === m.href ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold ${
                path === m.href ? "bg-garis2 text-teks" : "text-redup"
              }`}
            >
              {m.teks}
            </Link>
          </li>
        ))}
        <li className="flex-1">
          <Link
            href="/catat"
            aria-current={path === "/catat" ? "page" : undefined}
            className="flex min-h-11 items-center justify-center rounded-xl bg-hijau text-sm font-semibold text-di-hijau"
          >
            + Catat
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export function Kartu({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-garis bg-permukaan p-4">
      <h2 className="font-judul text-lg font-bold">{judul}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function Bar({ nilai, maks, warna = "bg-hijau" }: { nilai: number; maks: number; warna?: string }) {
  const persen = maks > 0 ? Math.min(100, Math.max(0, (nilai / maks) * 100)) : 0;
  return (
    <div className="h-3 overflow-hidden rounded-full bg-jalur" aria-hidden="true">
      <div
        className={`h-full rounded-full ${warna} transition-[width] duration-200 motion-reduce:transition-none`}
        style={{ width: `${persen}%` }}
      />
    </div>
  );
}

export function Galat({ id, pesan }: { id: string; pesan: string | null }) {
  return pesan ? (
    <p id={id} className="mt-1 text-sm font-semibold text-merah">
      {pesan}
    </p>
  ) : null;
}

/** Kolom rupiah: hanya angka, titik ribuan muncul saat mengetik. */
export function InputRupiah({
  id,
  teksLabel,
  nilai,
  onUbah,
  galat,
  besar,
}: {
  id: string;
  teksLabel: string;
  nilai: number | null;
  onUbah: (n: number | null) => void;
  galat?: string | null;
  besar?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {teksLabel}
      </label>
      <div className="flex items-center gap-1 rounded-xl border border-garis bg-permukaan px-3 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-teks">
        <span className={besar ? "font-judul text-3xl font-extrabold text-redup" : "text-redup"}>Rp</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={nilai === null ? "" : rupiah(nilai).slice(2)}
          onChange={(e) => {
            const angka = e.target.value.replace(/\D/g, "").slice(0, 13);
            onUbah(angka ? Number(angka) : null);
          }}
          aria-invalid={galat ? true : undefined}
          aria-describedby={galat ? `${id}-galat` : undefined}
          className={`w-full min-w-0 bg-transparent outline-none ${
            besar ? "min-h-16 font-judul text-4xl font-extrabold" : "min-h-11"
          }`}
        />
      </div>
      <Galat id={`${id}-galat`} pesan={galat ?? null} />
    </div>
  );
}

/** Kolom kata sandi dengan tombol Tampilkan/Sembunyikan. */
export function KolomSandi(p: {
  id: string;
  teksLabel: string;
  nilai: string;
  onUbah: (s: string) => void;
  galat?: string;
  autoComplete: string;
}) {
  const [tampil, setTampil] = useState(false);
  return (
    <div>
      <label htmlFor={p.id} className={label}>
        {p.teksLabel}
      </label>
      <div className="flex gap-2">
        <input
          id={p.id}
          type={tampil ? "text" : "password"}
          autoComplete={p.autoComplete}
          className={kolom}
          value={p.nilai}
          onChange={(e) => p.onUbah(e.target.value)}
          aria-invalid={p.galat ? true : undefined}
          aria-describedby={p.galat ? `${p.id}-galat` : undefined}
        />
        <button
          type="button"
          className={`${tombolKedua} shrink-0 text-sm`}
          aria-controls={p.id}
          aria-label={`${tampil ? "Sembunyikan" : "Tampilkan"} ${p.teksLabel.toLowerCase()}`}
          onClick={() => setTampil(!tampil)}
        >
          {tampil ? "Sembunyikan" : "Tampilkan"}
        </button>
      </div>
      <Galat id={`${p.id}-galat`} pesan={p.galat ?? null} />
    </div>
  );
}

/** Kolom tanggal dengan tombol pintas yang mengisi kolomnya. */
export function KolomTanggal(p: {
  id: string;
  teksLabel: string;
  nilai: string;
  onUbah: (t: string) => void;
  galat?: string | null;
  min?: string;
  max?: string;
  pintas: [string, string][];
  keterangan?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={p.id} className={label}>
        {p.teksLabel}
      </label>
      <input
        id={p.id}
        type="date"
        className={kolom}
        value={p.nilai}
        min={p.min}
        max={p.max}
        onChange={(e) => p.onUbah(e.target.value)}
        aria-invalid={p.galat ? true : undefined}
        aria-describedby={[p.galat && `${p.id}-galat`, p.keterangan && `${p.id}-ket`].filter(Boolean).join(" ") || undefined}
      />
      <Galat id={`${p.id}-galat`} pesan={p.galat ?? null} />
      <div className="mt-2 flex flex-wrap gap-2">
        {p.pintas.map(([teks, nilai]) => (
          <button
            key={teks}
            type="button"
            aria-pressed={p.nilai === nilai}
            onClick={() => p.onUbah(nilai)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              p.nilai === nilai ? "border-hijau bg-hijau text-di-hijau" : "border-garis bg-permukaan text-teks"
            }`}
          >
            {teks}
          </button>
        ))}
      </div>
      {p.keterangan && (
        <p id={`${p.id}-ket`} className="mt-2 text-sm text-redup">
          {p.keterangan}
        </p>
      )}
    </div>
  );
}

export const KETERANGAN_TARGET =
  "Tanggal itu ikut dihitung. Kalau uangmu masuk lagi di tanggal tertentu, pilih satu hari sebelumnya.";

/** Tombol pintas tanggal target: 7 hari = hari ini sampai 6 hari ke depan. */
export const pintasTarget = (hari: string): [string, string][] => [
  ["7 hari", tambahHari(hari, 6)],
  ["14 hari", tambahHari(hari, 13)],
  ["Akhir bulan", akhirBulan(hari)],
];

/** Layar untuk keadaan memuat dan gagal mengambil data akun. */
export function LayarKeadaan({ k }: { k: Exclude<Keadaan, { status: "siap" }> }) {
  if (k.status === "memuat")
    return (
      <p role="status" className="mt-10 text-center text-redup">
        Memuat datamu...
      </p>
    );
  return (
    <div role="alert" className="mt-6 rounded-2xl border border-garis bg-permukaan p-4">
      <p>Tidak bisa mengambil datamu. Periksa internet, lalu coba lagi.</p>
      <button type="button" className={`${tombolKedua} mt-4 w-full`} onClick={() => void muat()}>
        Coba lagi
      </button>
    </div>
  );
}

const HALAMAN_TERBUKA = ["/masuk", "/atur-ulang-sandi"];

/**
 * Pelindung halaman: semua halaman selain /masuk dan /atur-ulang-sandi butuh login.
 * Selama status login belum diketahui, hanya "Memuat..." yang tampil supaya tidak ada kilatan halaman.
 */
export function Penjaga({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const sesi = useSesi();
  const terbuka = HALAMAN_TERBUKA.includes(path);
  const arah =
    variabelKurang.length || sesi === undefined ? null : !sesi && !terbuka ? "/masuk" : sesi && path === "/masuk" ? "/" : null;

  useEffect(() => {
    if (arah) router.replace(arah);
  }, [arah, router]);

  let isi = children;
  if (variabelKurang.length) isi = <KonfigurasiKurang />;
  else if (sesi === undefined || arah)
    isi = (
      <p role="status" className="mt-10 text-center text-redup">
        Memuat...
      </p>
    );

  return (
    <>
      <main className="mx-auto max-w-[430px] px-4 pt-6 pb-32">{isi}</main>
      {!variabelKurang.length && sesi && !terbuka && <MenuBawah />}
    </>
  );
}

function KonfigurasiKurang() {
  return (
    <div role="alert" className="mt-6 rounded-2xl border border-garis bg-permukaan p-4">
      <h1 className="font-judul text-xl font-bold">Konfigurasi belum lengkap</h1>
      <p className="mt-2">Jatah belum tahu alamat database Supabase-nya. Variabel lingkungan ini belum diisi:</p>
      <ul className="mt-2 list-disc pl-5 font-semibold">
        {variabelKurang.map((v) => (
          <li key={v}>
            <code>{v}</code>
          </li>
        ))}
      </ul>
      <p className="mt-2">
        Di komputer: isi di file <code>.env.local</code> lalu jalankan ulang <code>npm run dev</code>. Di Vercel: tambahkan di
        Settings &gt; Environment Variables lalu Redeploy. Langkah lengkapnya ada di README.
      </p>
    </div>
  );
}

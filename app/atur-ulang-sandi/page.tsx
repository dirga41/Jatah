"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KolomSandi, tombolUtama } from "@/components/ui";
import { pesanGalat } from "@/lib/pesan";
import { sedangPemulihan, useSesi } from "@/lib/simpan";
import { klien } from "@/lib/supabase";

// Dibaca saat file ini dimuat, sebelum supabase-js membaca lalu membersihkan alamat tautan dari email.
const TAUTAN = typeof window === "undefined" ? "" : location.hash + location.search;

export default function AturUlangSandi() {
  const router = useRouter();
  const sesi = useSesi();
  const [sandi, setSandi] = useState("");
  const [ulang, setUlang] = useState("");
  const [galat, setGalat] = useState<{ sandi?: string; ulang?: string; umum?: string }>({});
  const [menyimpan, setMenyimpan] = useState(false);

  const pemulihan = sedangPemulihan() || /type=recovery/.test(TAUTAN);

  if (!sesi || !pemulihan)
    return (
      <div role="alert" className="mt-6 rounded-2xl border border-garis bg-permukaan p-4">
        <h1 className="font-judul text-xl font-bold">Tautan tidak bisa dipakai</h1>
        <p className="mt-2">
          {/error/.test(TAUTAN)
            ? "Tautan atur ulang kata sandi ini sudah kedaluwarsa atau sudah pernah dipakai."
            : "Halaman ini hanya bisa dibuka dari tautan atur ulang kata sandi yang dikirim ke emailmu."}{" "}
          Minta tautan baru lewat &quot;Lupa kata sandi?&quot; di halaman masuk.
        </p>
        <Link href="/masuk" className="mt-3 flex min-h-11 items-center font-semibold text-hijau underline">
          Ke halaman masuk
        </Link>
      </div>
    );

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    const g: typeof galat = {};
    if (sandi.length < 8) g.sandi = "Kata sandi minimal 8 karakter.";
    if (ulang !== sandi) g.ulang = "Kata sandi tidak sama. Ketik ulang.";
    setGalat(g);
    const kl = klien();
    if (g.sandi || g.ulang || !kl) return;
    setMenyimpan(true);
    try {
      const { error } = await kl.auth.updateUser({ password: sandi });
      if (error) {
        setGalat({ umum: pesanGalat(error) });
        setMenyimpan(false);
      } else router.replace("/");
    } catch (err) {
      setGalat({ umum: pesanGalat(err) });
      setMenyimpan(false);
    }
  };

  return (
    <form onSubmit={kirim} noValidate>
      <h1 className="font-judul text-2xl font-bold">Atur ulang kata sandi</h1>
      <p className="mt-1 text-redup">Untuk akun {sesi.user.email}</p>
      <div className="mt-5">
        <KolomSandi id="sandi-baru" teksLabel="Kata sandi baru" nilai={sandi} onUbah={setSandi} galat={galat.sandi} autoComplete="new-password" />
      </div>
      <div className="mt-4">
        <KolomSandi id="sandi-ulang" teksLabel="Ketik ulang kata sandi baru" nilai={ulang} onUbah={setUlang} galat={galat.ulang} autoComplete="new-password" />
      </div>
      {galat.umum && (
        <p role="alert" className="mt-4 font-semibold text-merah">
          {galat.umum}
        </p>
      )}
      <button type="submit" disabled={menyimpan} className={`${tombolUtama} mt-5 w-full`}>
        {menyimpan ? "Menyimpan..." : "Simpan kata sandi baru"}
      </button>
    </form>
  );
}

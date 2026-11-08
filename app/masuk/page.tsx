"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Galat, KolomSandi, kolom, label, tombolUtama } from "@/components/ui";
import { pesanGalat } from "@/lib/pesan";
import { klien } from "@/lib/supabase";

const MODE = [
  ["masuk", "Masuk"],
  ["daftar", "Daftar"],
] as const;

export default function Masuk() {
  const router = useRouter();
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [galat, setGalat] = useState<{ email?: string; sandi?: string; umum?: string }>({});
  const [info, setInfo] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const emailSah = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfo(null);
    const g: typeof galat = {};
    if (!emailSah) g.email = "Isi email yang benar, misalnya nama@contoh.com.";
    if (sandi.length < 8) g.sandi = "Kata sandi minimal 8 karakter.";
    setGalat(g);
    const kl = klien();
    if (g.email || g.sandi || !kl) return;
    setMenyimpan(true);
    const isian = { email: email.trim(), password: sandi };
    try {
      if (mode === "masuk") {
        const { error } = await kl.auth.signInWithPassword(isian);
        if (error) return setGalat({ umum: pesanGalat(error) });
        router.replace("/");
        return;
      }
      const { data, error } = await kl.auth.signUp({ ...isian, options: { emailRedirectTo: `${location.origin}/` } });
      if (error) return setGalat({ umum: pesanGalat(error) });
      // Kalau "Confirm email" menyala, Supabase tidak membocorkan email terdaftar: user tanpa identitas berarti sudah ada.
      if (data.user && data.user.identities?.length === 0) return setGalat({ umum: pesanGalat({ code: "user_already_exists" }) });
      if (data.session) router.replace("/");
      else setInfo("Cek emailmu untuk konfirmasi, lalu masuk.");
    } catch (err) {
      setGalat({ umum: pesanGalat(err) });
    } finally {
      setMenyimpan(false);
    }
  };

  const lupa = async () => {
    setInfo(null);
    const kl = klien();
    if (!emailSah) return setGalat({ email: "Isi emailmu dulu, lalu tekan Lupa kata sandi lagi." });
    if (!kl) return;
    setGalat({});
    setMenyimpan(true);
    try {
      const { error } = await kl.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/atur-ulang-sandi` });
      if (error) setGalat({ umum: pesanGalat(error) });
      else setInfo("Kalau email itu terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim. Cek emailmu.");
    } catch (err) {
      setGalat({ umum: pesanGalat(err) });
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <form onSubmit={kirim} noValidate>
      <h1 className="font-judul text-2xl font-bold">Jatah</h1>
      <p className="mt-1 text-redup">Masuk supaya datamu sama di HP dan laptop.</p>

      <div role="group" aria-label="Pilih masuk atau daftar" className="mt-5 flex gap-2">
        {MODE.map(([nilai, teks]) => (
          <button
            key={nilai}
            type="button"
            aria-pressed={mode === nilai}
            onClick={() => {
              setMode(nilai);
              setGalat({});
              setInfo(null);
            }}
            className={`min-h-11 rounded-full border px-5 font-semibold ${
              mode === nilai ? "border-hijau bg-hijau text-di-hijau" : "border-garis bg-permukaan text-teks"
            }`}
          >
            {teks}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <label htmlFor="email" className={label}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          className={kolom}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={galat.email ? true : undefined}
          aria-describedby={galat.email ? "email-galat" : undefined}
        />
        <Galat id="email-galat" pesan={galat.email ?? null} />
      </div>

      <div className="mt-4">
        <KolomSandi
          id="sandi"
          teksLabel="Kata sandi"
          nilai={sandi}
          onUbah={setSandi}
          galat={galat.sandi}
          autoComplete={mode === "masuk" ? "current-password" : "new-password"}
        />
      </div>

      {galat.umum && (
        <p role="alert" className="mt-4 font-semibold text-merah">
          {galat.umum}
        </p>
      )}
      {info && (
        <p role="status" className="mt-4 font-semibold text-hijau">
          {info}
        </p>
      )}

      <button type="submit" disabled={menyimpan} className={`${tombolUtama} mt-5 w-full`}>
        {menyimpan ? "Memproses..." : mode === "masuk" ? "Masuk" : "Daftar"}
      </button>
      <button
        type="button"
        disabled={menyimpan}
        onClick={lupa}
        className="mt-3 flex min-h-11 items-center px-1 font-semibold text-hijau underline disabled:opacity-50"
      >
        Lupa kata sandi?
      </button>
    </form>
  );
}

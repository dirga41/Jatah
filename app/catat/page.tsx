"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  InputRupiah,
  KETERANGAN_TARGET,
  KolomTanggal,
  LayarKeadaan,
  kolom,
  label,
  pintasTarget,
  tombolUtama,
} from "@/components/ui";
import {
  KATEGORI_KELUAR,
  SUMBER_MASUK,
  kunciTanggal,
  namaTanggal,
  periksaTarget,
  tambahHari,
  tanggalSah,
  type Transaksi,
} from "@/lib/hitung";
import { tambahTransaksi, useData } from "@/lib/simpan";

export default function Catat() {
  const k = useData();
  const router = useRouter();
  const [jenis, setJenis] = useState<Transaksi["jenis"]>("keluar");
  const [nominal, setNominal] = useState<number | null>(null);
  const pilihan = jenis === "keluar" ? KATEGORI_KELUAR : SUMBER_MASUK;
  const [kategori, setKategori] = useState(pilihan[0]);
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [galatSimpan, setGalatSimpan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const hari = kunciTanggal();
  const [tanggal, setTanggal] = useState(hari);
  const [galatTanggal, setGalatTanggal] = useState<string | null>(null);
  // null = belum disentuh, isi awalnya diambil dari tanggal target yang masih berlaku.
  const [target, setTarget] = useState<string | null>(null);
  const [galatTarget, setGalatTarget] = useState<string | null>(null);

  if (k.status !== "siap") return <LayarKeadaan k={k} />;
  const targetLama = k.data.pengaturan.sampaiTanggal;
  const nilaiTarget = target ?? (targetLama && targetLama >= hari ? targetLama : "");

  const gantiJenis = (j: Transaksi["jenis"]) => {
    setJenis(j);
    setKategori((j === "keluar" ? KATEGORI_KELUAR : SUMBER_MASUK)[0]);
  };

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    const gNominal = !nominal || nominal <= 0 ? "Isi nominal lebih dari Rp0." : null;
    const gTanggal = !tanggalSah(tanggal)
      ? "Pilih tanggal."
      : tanggal > hari
        ? "Tanggal tidak boleh di masa depan."
        : null;
    // Target kosong berarti tanggal target lama tidak diubah.
    const gTarget = jenis === "masuk" && nilaiTarget ? periksaTarget(nilaiTarget, hari) : null;
    setGalat(gNominal);
    setGalatTanggal(gTanggal);
    setGalatTarget(gTarget);
    if (gNominal || gTanggal || gTarget || !nominal) return;
    setGalatSimpan(null);
    setMenyimpan(true);
    const gagal = await tambahTransaksi(
      { tanggal, jenis, nominal, kategori, catatan: catatan.trim() },
      jenis === "masuk" && nilaiTarget ? { ...k.data.pengaturan, sampaiTanggal: nilaiTarget } : undefined,
    );
    if (gagal) {
      // Isian formulir dibiarkan supaya bisa langsung dicoba lagi.
      setGalatSimpan(gagal);
      setMenyimpan(false);
    } else router.push(tanggal === hari ? "/" : `/?tercatat=${tanggal}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      <h1 className="font-judul text-2xl font-bold">Catat</h1>

      <div role="group" aria-label="Jenis catatan" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-garis2 p-1">
        {(
          [
            ["keluar", "Pengeluaran"],
            ["masuk", "Pemasukan"],
          ] as const
        ).map(([j, teks]) => (
          <button
            key={j}
            type="button"
            aria-pressed={jenis === j}
            onClick={() => gantiJenis(j)}
            className={`min-h-11 rounded-lg font-semibold text-teks ${jenis === j ? "bg-permukaan" : ""}`}
          >
            {teks}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <InputRupiah
          id="nominal"
          teksLabel="Nominal"
          nilai={nominal}
          onUbah={(n) => {
            setNominal(n);
            setGalat(null);
          }}
          galat={galat}
          besar
        />
      </div>

      <fieldset className="mt-5">
        <legend className={label}>{jenis === "keluar" ? "Kategori" : "Sumber"}</legend>
        <div className="flex flex-wrap gap-2">
          {pilihan.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={kategori === p}
              onClick={() => setKategori(p)}
              className={`min-h-11 rounded-full border px-4 font-semibold ${
                kategori === p ? "border-hijau bg-hijau text-di-hijau" : "border-garis bg-permukaan text-teks"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <label htmlFor="catatan" className={label}>
          Catatan singkat (opsional)
        </label>
        <input
          id="catatan"
          className={kolom}
          maxLength={80}
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
        />
      </div>

      <div className="mt-5">
        <KolomTanggal
          id="tanggal"
          teksLabel="Tanggal"
          nilai={tanggal}
          onUbah={(t) => {
            setTanggal(t);
            setGalatTanggal(null);
          }}
          galat={galatTanggal}
          max={hari}
          pintas={[
            ["Hari ini", hari],
            ["Kemarin", tambahHari(hari, -1)],
          ]}
          keterangan={tanggalSah(tanggal) && tanggal <= hari ? `Tercatat untuk ${namaTanggal(tanggal)}` : undefined}
        />
      </div>

      {jenis === "masuk" && (
        <div className="mt-5">
          <KolomTanggal
            id="target"
            teksLabel="Uang ini harus cukup sampai tanggal berapa? (opsional)"
            nilai={nilaiTarget}
            onUbah={(t) => {
              setTarget(t);
              setGalatTarget(null);
            }}
            galat={galatTarget}
            min={hari}
            max={tambahHari(hari, 366)}
            pintas={pintasTarget(hari)}
            keterangan={KETERANGAN_TARGET}
          />
        </div>
      )}

      {galatSimpan && (
        <p role="alert" className="mt-3 font-semibold text-merah">
          {galatSimpan}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={menyimpan} className={`${tombolUtama} flex-1`}>
          {menyimpan ? "Menyimpan..." : "Simpan"}
        </button>
        <Link href="/" className="flex min-h-11 items-center px-4 font-semibold text-hijau underline">
          Batal
        </Link>
      </div>
    </form>
  );
}

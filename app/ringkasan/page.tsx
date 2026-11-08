"use client";

import { useState } from "react";
import { Bar, Kartu, LayarKeadaan, tombolKedua } from "@/components/ui";
import {
  arusBulan,
  bulanDari,
  geserBulan,
  kunciTanggal,
  namaBulan,
  namaTanggal,
  perKategori,
  rupiah,
  transaksiBulan,
  type Transaksi,
} from "@/lib/hitung";
import { hapusTransaksi, useData } from "@/lib/simpan";

export default function Ringkasan() {
  const k = useData();
  const bulanIni = bulanDari(kunciTanggal());
  const [bulan, setBulan] = useState(bulanIni);
  const [galat, setGalat] = useState<string | null>(null);
  const [menghapus, setMenghapus] = useState<string | null>(null);

  if (k.status !== "siap") return <LayarKeadaan k={k} />;
  const data = k.data;

  const adaSebelumnya = data.transaksi.some((t) => bulanDari(t.tanggal) < bulan);
  const { masuk, keluar } = arusBulan(data, bulan);
  const kategori = perKategori(data, bulan, "keluar");
  // Terbaru dulu: urut tanggal, lalu urutan dicatat (yang belakangan di array lebih baru).
  const riwayat = transaksiBulan(data, bulan)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => b.t.tanggal.localeCompare(a.t.tanggal) || b.i - a.i)
    .map((x) => x.t);
  const maksArus = Math.max(masuk, keluar);
  const selisih = masuk - keluar;

  const hapus = async (t: Transaksi) => {
    const pesan = `Hapus catatan ${t.kategori} ${rupiah(t.nominal)} tanggal ${namaTanggal(t.tanggal)}?${
      t.tetapId ? " Biaya tetap ini akan kembali berstatus belum dibayar." : ""
    }`;
    if (!confirm(pesan)) return;
    setMenghapus(t.id);
    setGalat(await hapusTransaksi(t.id));
    setMenghapus(null);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={`${tombolKedua} w-11 px-0`}
          onClick={() => setBulan(geserBulan(bulan, -1))}
          disabled={!adaSebelumnya}
          aria-label="Bulan sebelumnya"
        >
          &lsaquo;
        </button>
        <h1 className="text-center font-judul text-xl font-bold" aria-live="polite">
          Ringkasan {namaBulan(bulan)}
        </h1>
        <button
          type="button"
          className={`${tombolKedua} w-11 px-0`}
          onClick={() => setBulan(geserBulan(bulan, 1))}
          disabled={bulan >= bulanIni}
          aria-label="Bulan berikutnya"
        >
          &rsaquo;
        </button>
      </div>

      {galat && (
        <p role="alert" className="mt-3 font-semibold text-merah">
          {galat}
        </p>
      )}

      {riwayat.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-garis bg-permukaan p-4">
          <p>
            Belum ada catatan di {namaBulan(bulan)}, jadi belum ada yang bisa diringkas.
            {bulan === bulanIni
              ? " Catat pemasukan atau pengeluaranmu lewat tombol + Catat, nanti ringkasannya muncul di sini."
              : " Pindah ke bulan lain dengan tombol panah di atas."}
          </p>
        </div>
      ) : (
        <>
          <Kartu judul="Bulan ini uang masuk dan keluar berapa?">
            <div className="flex flex-col gap-3">
              {(
                [
                  ["Masuk", masuk, "bg-hijau"],
                  ["Keluar", keluar, "bg-oranye"],
                ] as const
              ).map(([nama, nilai, warna]) => (
                <div key={nama}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{nama}</span>
                    <span className="font-semibold">{rupiah(nilai)}</span>
                  </div>
                  <Bar nilai={nilai} maks={maksArus} warna={warna} />
                </div>
              ))}
            </div>
            <p className="mt-3">
              {selisih > 0
                ? `Uang masuk ${rupiah(selisih)} lebih banyak dari uang keluar.`
                : selisih < 0
                  ? `Uang keluar ${rupiah(-selisih)} lebih banyak dari uang masuk.`
                  : "Uang masuk dan uang keluar sama besar."}
            </p>
          </Kartu>

          <Kartu judul="Uangku paling banyak habis di mana?">
            {kategori.length === 0 ? (
              <p className="text-redup">Belum ada pengeluaran di bulan ini.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {kategori.map((x) => (
                  <div key={x.nama}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{x.nama}</span>
                      <span className="font-semibold">{rupiah(x.nominal)}</span>
                    </div>
                    <Bar nilai={x.nominal} maks={kategori[0].nominal} warna="bg-oranye" />
                  </div>
                ))}
              </div>
            )}
          </Kartu>

          <Kartu judul="Riwayat transaksi">
            <ul className="divide-y divide-garis2">
              {riwayat.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-semibold">{t.kategori}</span>
                    <span className="block text-sm text-redup">
                      {namaTanggal(t.tanggal)}
                      {t.catatan && ` · ${t.catatan}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`font-semibold ${t.jenis === "masuk" ? "text-hijau" : ""}`}>
                      {t.jenis === "masuk" ? "+" : "-"}
                      {rupiah(t.nominal)}
                    </span>
                    <button
                      type="button"
                      className={`${tombolKedua} text-sm`}
                      disabled={menghapus !== null}
                      onClick={() => hapus(t)}
                      aria-label={`Hapus ${t.kategori} ${rupiah(t.nominal)}`}
                    >
                      {menghapus === t.id ? "Menyimpan..." : "Hapus"}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </Kartu>
        </>
      )}
    </>
  );
}

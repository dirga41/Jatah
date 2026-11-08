"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Bar,
  KETERANGAN_TARGET,
  Kartu,
  KolomTanggal,
  LayarKeadaan,
  latarStatus,
  pintasTarget,
  tombolKedua,
  tombolUtama,
  warnaStatus,
} from "@/components/ui";
import {
  akhirBulan,
  hitungBeranda,
  kunciTanggal,
  namaTanggal,
  periksaTarget,
  rupiah,
  tambahHari,
  tanggalPendek,
  tanggalSah,
  type Data,
  type Tagihan,
} from "@/lib/hitung";
import { dataLokalLama, pindahkanDataLama, simpanPengaturan, tambahTransaksi, useData } from "@/lib/simpan";

const KUNCI_TUNDA = "jatah:pindah-nanti";

// useSearchParams butuh Suspense supaya halaman tetap bisa dibuat statis saat build.
export default function Halaman() {
  return (
    <Suspense fallback={<LayarKeadaan k={{ status: "memuat" }} />}>
      <Beranda />
    </Suspense>
  );
}

function Beranda() {
  const k = useData();
  const router = useRouter();
  const tercatat = useSearchParams().get("tercatat");
  const [galat, setGalat] = useState<string | null>(null);
  const [membayar, setMembayar] = useState<string | null>(null);
  const [memindah, setMemindah] = useState(false);
  // "Nanti saja" hanya berlaku untuk sesi browser ini.
  const [ditunda, setDitunda] = useState(() => {
    try {
      return sessionStorage.getItem(KUNCI_TUNDA) === "1";
    } catch {
      return false;
    }
  });
  // Tawarkan pindah data lama hanya kalau akun benar-benar belum punya data, supaya tidak menimpa.
  const dataLama = k.status === "siap" && k.kosong && !ditunda ? dataLokalLama() : null;
  const belumSiap = k.status === "siap" && !k.data.pengaturan.siap && !dataLama;

  useEffect(() => {
    if (belumSiap) router.replace("/pengaturan");
  }, [belumSiap, router]);

  if (k.status !== "siap") return <LayarKeadaan k={k} />;
  if (belumSiap) return <LayarKeadaan k={{ status: "memuat" }} />;

  if (dataLama)
    return (
      <section className="mt-4 rounded-2xl border border-garis bg-permukaan p-5">
        <h1 className="font-judul text-xl font-bold">Ada data lama di perangkat ini. Pindahkan ke akunmu?</h1>
        <p className="mt-2 text-redup">
          {dataLama.transaksi.length} transaksi dan pengaturan dari Jatah versi sebelumnya. Data di perangkat ini tidak
          dihapus.
        </p>
        {galat && (
          <p role="alert" className="mt-3 font-semibold text-merah">
            {galat}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={memindah}
            className={`${tombolUtama} flex-1`}
            onClick={async () => {
              setMemindah(true);
              setGalat(await pindahkanDataLama(dataLama));
              setMemindah(false);
            }}
          >
            {memindah ? "Menyimpan..." : "Pindahkan"}
          </button>
          <button
            type="button"
            disabled={memindah}
            className={tombolKedua}
            onClick={() => {
              try {
                sessionStorage.setItem(KUNCI_TUNDA, "1");
              } catch {}
              setGalat(null);
              setDitunda(true);
            }}
          >
            Nanti saja
          </button>
        </div>
      </section>
    );

  const hari = kunciTanggal();
  const h = hitungBeranda(k.data, hari);
  const lewat = h.sisaJatah < 0;
  const angka = rupiah(Math.abs(h.sisaJatah));

  const bayar = async (b: Tagihan) => {
    setMembayar(`${b.id}-${b.bulan}`);
    setGalat(
      await tambahTransaksi({
        tanggal: hari,
        jenis: "keluar",
        nominal: b.nominal,
        kategori: "Biaya tetap",
        catatan: b.nama,
        tetapId: b.id,
        untukBulan: b.bulan,
      }),
    );
    setMembayar(null);
  };

  return (
    <>
      <header className="flex items-center justify-between">
        <p className="font-semibold text-redup">{namaTanggal(hari)}</p>
        <Link href="/pengaturan" className="flex min-h-11 items-center px-2 font-semibold text-hijau underline">
          Pengaturan
        </Link>
      </header>

      {tercatat && tanggalSah(tercatat) && tercatat !== hari && (
        <p role="status" className="mt-3 rounded-xl border border-garis bg-permukaan p-3 font-semibold text-hijau">
          Tercatat untuk {namaTanggal(tercatat)}
        </p>
      )}

      {galat && (
        <p role="alert" className="mt-3 font-semibold text-merah">
          {galat}
        </p>
      )}

      <section className="mt-4 rounded-2xl border border-garis bg-permukaan p-5">
        <h1 className="font-judul text-xl font-bold">Jatah hari ini</h1>
        <p
          className={`mt-2 font-judul leading-none font-extrabold ${warnaStatus[h.status]} ${
            angka.length > 10 ? "text-[48px]" : "text-[68px]"
          }`}
        >
          {angka}
        </p>
        <p className={`mt-3 text-lg font-bold ${warnaStatus[h.status]}`}>{h.status}</p>
        <p className="mt-1">
          {lewat ? `Melebihi jatah ${rupiah(h.jatah)}.` : `Sisa dari jatah ${rupiah(h.jatah)}.`}
        </p>
        <div className="mt-3">
          <Bar nilai={h.terpakai} maks={h.jatah} warna={latarStatus[h.status]} />
        </div>
        <p className="mt-2 text-sm text-redup">
          Terpakai {rupiah(h.terpakai)} dari jatah {rupiah(h.jatah)}
        </p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-garis bg-permukaan p-4">
          <p className="text-sm text-redup">Sisa uang</p>
          <p className="mt-1 font-judul text-xl font-extrabold break-all">{rupiah(h.uangDiTangan)}</p>
        </div>
        <div className="rounded-2xl border border-garis bg-permukaan p-4">
          <p className="text-sm text-redup">Sisa hari</p>
          <p className="mt-1 font-judul text-xl font-extrabold">{h.sisaHari} hari</p>
        </div>
      </div>
      {h.tetapBelumDibayar > 0 && (
        <p className="mt-2 text-sm text-redup">
          {rupiah(h.tetapBelumDibayar)} dari sisa uang itu sudah dipisah untuk biaya tetap.
        </p>
      )}
      <BarisTarget data={k.data} hari={hari} targetLewat={h.targetLewat} />

      <Kartu judul="Pengeluaran hari ini">
        {h.pengeluaranHariIni.length === 0 ? (
          <p className="text-redup">Belum ada pengeluaran hari ini.</p>
        ) : (
          <ul className="divide-y divide-garis2">
            {[...h.pengeluaranHariIni].reverse().map((t) => (
              <li key={t.id} className="flex justify-between gap-3 py-2">
                <span>
                  {t.kategori}
                  {t.catatan && <span className="block text-sm text-redup">{t.catatan}</span>}
                </span>
                <span className="font-semibold">{rupiah(t.nominal)}</span>
              </li>
            ))}
          </ul>
        )}
      </Kartu>

      {h.belumDibayar.length > 0 && (
        <Kartu judul="Biaya tetap belum dibayar">
          <ul className="divide-y divide-garis2">
            {h.belumDibayar.map((b) => (
              <li key={`${b.id}-${b.bulan}`} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold">{b.nama}</span>
                  <span className="block text-sm text-redup">
                    {rupiah(b.nominal)} · jatuh tempo {tanggalPendek(b.jatuhTempo)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={membayar !== null}
                  className={`${tombolKedua} shrink-0 text-sm`}
                  onClick={() => bayar(b)}
                >
                  {membayar === `${b.id}-${b.bulan}` ? "Menyimpan..." : "Sudah dibayar"}
                </button>
              </li>
            ))}
          </ul>
        </Kartu>
      )}
    </>
  );
}

/** "Uang ini cukup sampai ..." dengan formulir kecil untuk mengubahnya di tempat yang sama. */
function BarisTarget(p: { data: Data; hari: string; targetLewat: boolean }) {
  const sampai = p.data.pengaturan.sampaiTanggal;
  const berlaku = sampai !== null && !p.targetLewat;
  const [buka, setBuka] = useState(false);
  const [nilai, setNilai] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const mulai = () => {
    setNilai(berlaku ? sampai : akhirBulan(p.hari));
    setGalat(null);
    setBuka(true);
  };

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    const g = periksaTarget(nilai, p.hari);
    setGalat(g);
    if (g) return;
    setMenyimpan(true);
    const gagal = await simpanPengaturan({ ...p.data.pengaturan, sampaiTanggal: nilai });
    setMenyimpan(false);
    // Kalau gagal, formulir tetap terbuka dengan isiannya.
    setGalat(gagal);
    if (!gagal) setBuka(false);
  };

  if (buka)
    return (
      <form onSubmit={kirim} noValidate className="mt-3 rounded-2xl border border-garis bg-permukaan p-4">
        <KolomTanggal
          id="sampai-tanggal"
          teksLabel="Uang ini cukup sampai"
          nilai={nilai}
          onUbah={(t) => {
            setNilai(t);
            setGalat(null);
          }}
          galat={galat}
          min={p.hari}
          max={tambahHari(p.hari, 366)}
          pintas={pintasTarget(p.hari)}
          keterangan={KETERANGAN_TARGET}
        />
        <div className="mt-3 flex gap-2">
          <button type="submit" disabled={menyimpan} className={`${tombolUtama} flex-1`}>
            {menyimpan ? "Menyimpan..." : "Simpan"}
          </button>
          <button type="button" disabled={menyimpan} className={tombolKedua} onClick={() => setBuka(false)}>
            Batal
          </button>
        </div>
      </form>
    );

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-garis bg-permukaan p-4">
      <p>
        {berlaku ? (
          <>
            Uang ini cukup sampai <span className="font-semibold">{namaTanggal(sampai)}</span>
          </>
        ) : p.targetLewat ? (
          `Tanggal target sebelumnya sudah lewat. Atur yang baru. Sementara dihitung sampai akhir bulan (${tanggalPendek(akhirBulan(p.hari))}).`
        ) : (
          `Belum diatur, dihitung sampai akhir bulan (${tanggalPendek(akhirBulan(p.hari))})`
        )}
      </p>
      <button type="button" className={`${tombolKedua} shrink-0 text-sm`} onClick={mulai}>
        {berlaku ? "Ubah" : "Atur"}
      </button>
    </div>
  );
}

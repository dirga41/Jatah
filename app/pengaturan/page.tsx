"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Galat, InputRupiah, Kartu, LayarKeadaan, kolom, label, tombolKedua, tombolUtama } from "@/components/ui";
import {
  idBaru,
  kunciTanggal,
  migrasi,
  rupiah,
  uangDiTangan,
  type BiayaTetap,
  type Data,
} from "@/lib/hitung";
import { ambilSalinan, emailSesi, gantiSemua, hapusSemua, keluar, simpanPengaturan, useData } from "@/lib/simpan";

export default function Pengaturan() {
  const k = useData();
  const [versi, setVersi] = useState(0);
  if (k.status !== "siap") return <LayarKeadaan k={k} />;
  return (
    <>
      <FormPengaturan key={versi} data={k.data} />
      <Tampilan />
      <SalinanData onGanti={() => setVersi((v) => v + 1)} />
      <Akun />
    </>
  );
}

const KUNCI_TEMA = "jatah:tema";
const PILIHAN_TEMA = [
  ["ikuti", "Ikuti perangkat"],
  ["terang", "Terang"],
  ["gelap", "Gelap"],
] as const;

/** Pilihan tema disimpan terpisah dari data aplikasi, jadi tidak ikut ke salinan data. */
function Tampilan() {
  const [tema, setTema] = useState(() => {
    try {
      return localStorage.getItem(KUNCI_TEMA) ?? "ikuti";
    } catch {
      return "ikuti";
    }
  });
  const [galat, setGalat] = useState<string | null>(null);

  const pilih = (t: string) => {
    try {
      if (t === "ikuti") localStorage.removeItem(KUNCI_TEMA);
      else localStorage.setItem(KUNCI_TEMA, t);
      setTema(t);
      setGalat(null);
    } catch {
      setTema("ikuti");
      setGalat("Pilihan tampilan tidak bisa disimpan di browser ini, jadi Jatah mengikuti pengaturan perangkat.");
    }
    (window as Window & { pasangTema?: () => void }).pasangTema?.();
  };

  return (
    <Kartu judul="Tampilan">
      <div role="group" aria-label="Tema tampilan" className="flex flex-wrap gap-2">
        {PILIHAN_TEMA.map(([nilai, teks]) => (
          <button
            key={nilai}
            type="button"
            aria-pressed={tema === nilai}
            onClick={() => pilih(nilai)}
            className={`min-h-11 rounded-full border px-4 font-semibold ${
              tema === nilai ? "border-hijau bg-hijau text-di-hijau" : "border-garis bg-permukaan text-teks"
            }`}
          >
            {teks}
          </button>
        ))}
      </div>
      <Galat id="tema-galat" pesan={galat} />
    </Kartu>
  );
}

const TANGGAL = Array.from({ length: 28 }, (_, i) => i + 1);

function FormPengaturan({ data }: { data: Data }) {
  const router = useRouter();
  const p = data.pengaturan;
  const pertama = !p.siap;
  const [dipegang, setDipegang] = useState<number | null>(pertama && data.transaksi.length === 0 ? null : uangDiTangan(data));
  const [biaya, setBiaya] = useState<BiayaTetap[]>(p.biayaTetap);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  // Isian biaya tetap yang sedang ditambah/diubah.
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [nominal, setNominal] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(1);

  const kosongkanIsian = () => {
    setEditId(null);
    setNama("");
    setNominal(null);
    setTanggal(1);
  };

  const simpanBiaya = () => {
    const g: Record<string, string> = {};
    if (!nama.trim()) g.nama = "Isi nama biaya tetap, misalnya Kos atau Cicilan HP.";
    if (!nominal || nominal <= 0) g.nominalTetap = "Isi nominal lebih dari Rp0.";
    setGalat(g);
    if (Object.keys(g).length) return;
    const item = { id: editId ?? idBaru(), nama: nama.trim(), nominal: nominal!, tanggal };
    setBiaya(editId ? biaya.map((b) => (b.id === editId ? item : b)) : [...biaya, item]);
    kosongkanIsian();
  };

  const ubahBiaya = (b: BiayaTetap) => {
    setEditId(b.id);
    setNama(b.nama);
    setNominal(b.nominal);
    setTanggal(b.tanggal);
    setGalat({});
  };

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesan(null);
    const g: Record<string, string> = {};
    if (dipegang === null) g.dipegang = "Isi uang yang kamu pegang sekarang. Kalau memang tidak ada, isi 0.";
    if (nama.trim() || nominal) g.isian = "Ada biaya tetap yang belum ditambahkan. Tekan tombolnya dulu atau kosongkan kolomnya.";
    setGalat(g);
    if (Object.keys(g).length) return;

    // uangAwal dihitung ulang supaya uang di tangan sama dengan angka yang diisi.
    const arusBersih = uangDiTangan(data) - p.uangAwal;
    setMenyimpan(true);
    const gagal = await simpanPengaturan({ ...p, uangAwal: dipegang! - arusBersih, biayaTetap: biaya, siap: true });
    setMenyimpan(false);
    if (gagal) setPesan(gagal);
    else if (pertama) router.push("/");
    else setPesan("Pengaturan tersimpan.");
  };

  return (
    <form onSubmit={kirim} noValidate>
      <h1 className="font-judul text-2xl font-bold">
        {pertama ? "Isi dulu uang yang kamu pegang dan biaya tetapmu" : "Pengaturan"}
      </h1>
      {pertama && (
        <p className="mt-2 text-redup">
          Dari sini Jatah menghitung berapa yang boleh kamu belanjakan tiap hari. Datamu disimpan di akunmu, jadi sama di HP dan laptop.
        </p>
      )}

      <div className="mt-4">
        <InputRupiah
          id="dipegang"
          teksLabel="Uang yang kamu pegang sekarang"
          nilai={dipegang}
          onUbah={setDipegang}
          galat={galat.dipegang}
          besar
        />
        <p className="mt-1 text-sm text-redup">Gabungan uang tunai, rekening, dan dompet digital.</p>
      </div>

      <Kartu judul="Biaya tetap">
        <p className="text-sm text-redup">Tagihan rutin tiap bulan, misalnya kos, cicilan, atau langganan.</p>
        {biaya.length === 0 ? (
          <p className="mt-2 text-redup">Belum ada biaya tetap. Tambahkan lewat kolom di bawah, atau lewati kalau tidak punya.</p>
        ) : (
          <ul className="mt-2 divide-y divide-garis2">
            {biaya.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-semibold">{b.nama}</span>
                  <span className="block text-sm text-redup">
                    {rupiah(b.nominal)} · tanggal {b.tanggal}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button type="button" className={`${tombolKedua} text-sm`} onClick={() => ubahBiaya(b)} aria-label={`Ubah ${b.nama}`}>
                    Ubah
                  </button>
                  <button
                    type="button"
                    className={`${tombolKedua} text-sm`}
                    aria-label={`Hapus ${b.nama}`}
                    onClick={() => {
                      setBiaya(biaya.filter((x) => x.id !== b.id));
                      if (editId === b.id) kosongkanIsian();
                    }}
                  >
                    Hapus
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="mt-3 flex flex-col gap-3 border-t border-garis2 pt-3">
          <legend className="sr-only">{editId ? "Ubah biaya tetap" : "Tambah biaya tetap"}</legend>
          <div>
            <label htmlFor="nama-tetap" className={label}>
              Nama
            </label>
            <input
              id="nama-tetap"
              className={kolom}
              maxLength={40}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              aria-invalid={galat.nama ? true : undefined}
              aria-describedby={galat.nama ? "nama-tetap-galat" : undefined}
            />
            <Galat id="nama-tetap-galat" pesan={galat.nama ?? null} />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <InputRupiah id="nominal-tetap" teksLabel="Nominal" nilai={nominal} onUbah={setNominal} galat={galat.nominalTetap} />
            <div>
              <label htmlFor="tanggal-tetap" className={label}>
                Jatuh tempo
              </label>
              <select id="tanggal-tetap" className={kolom} value={tanggal} onChange={(e) => setTanggal(Number(e.target.value))}>
                {TANGGAL.map((t) => (
                  <option key={t} value={t}>
                    Tanggal {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Galat id="isian-galat" pesan={galat.isian ?? null} />
          <div className="flex gap-2">
            <button type="button" className={`${tombolKedua} flex-1`} onClick={simpanBiaya}>
              {editId ? "Simpan perubahan" : "Tambah biaya tetap"}
            </button>
            {editId && (
              <button type="button" className={tombolKedua} onClick={kosongkanIsian}>
                Batal ubah
              </button>
            )}
          </div>
        </fieldset>
      </Kartu>


      {pesan && (
        <p role="status" className={`mt-4 font-semibold ${pesan === "Pengaturan tersimpan." ? "text-hijau" : "text-merah"}`}>
          {pesan}
        </p>
      )}
      <button type="submit" disabled={menyimpan} className={`${tombolUtama} mt-4 w-full`}>
        {menyimpan ? "Menyimpan..." : pertama ? "Simpan dan mulai" : "Simpan pengaturan"}
      </button>
    </form>
  );
}

function SalinanData({ onGanti }: { onGanti: () => void }) {
  const [pesan, setPesan] = useState<{ teks: string; galat: boolean } | null>(null);
  const [sibuk, setSibuk] = useState<"unduh" | "pulihkan" | "hapus" | null>(null);

  const unduh = async () => {
    setPesan(null);
    setSibuk("unduh");
    try {
      // Diambil langsung dari database (semua halaman) supaya salinannya lengkap dan terbaru.
      const data = await ambilSalinan();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `jatah-salinan-${kunciTanggal()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setPesan({ teks: "Salinan data sudah diunduh. Simpan di tempat yang aman.", galat: false });
    } catch {
      setPesan({ teks: "Tidak bisa mengambil datamu. Periksa internet, lalu coba lagi.", galat: true });
    } finally {
      setSibuk(null);
    }
  };

  const pulihkan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let baru: Data | null = null;
    try {
      baru = migrasi(JSON.parse(await file.text()));
    } catch {
      baru = null;
    }
    if (!baru) {
      setPesan({
        teks: `File "${file.name}" bukan salinan data Jatah atau isinya rusak. Pilih file jatah-salinan-....json yang dibuat lewat tombol "Unduh salinan data".`,
        galat: true,
      });
      return;
    }
    if (
      !confirm(
        `File ini berisi ${baru.transaksi.length} transaksi. Semua data di akunmu akan DIGANTI dengan isi file, dan data yang sekarang tidak bisa dikembalikan. Lanjutkan?`,
      )
    )
      return;
    setSibuk("pulihkan");
    const gagal = await gantiSemua(baru);
    setSibuk(null);
    setPesan(gagal ? { teks: gagal, galat: true } : { teks: "Data berhasil dipulihkan dari salinan.", galat: false });
    if (!gagal) onGanti();
  };

  const hapus = async () => {
    if (
      !confirm(
        "Semua data di akunmu (pengaturan dan semua transaksi) akan dihapus dari semua perangkat. Tindakan ini tidak bisa dibatalkan. Akun loginmu tetap ada. Lanjutkan?",
      )
    )
      return;
    setSibuk("hapus");
    const gagal = await hapusSemua();
    setSibuk(null);
    setPesan(gagal ? { teks: gagal, galat: true } : { teks: "Semua data sudah dihapus. Isi lagi dari awal di atas.", galat: false });
    if (!gagal) {
      onGanti();
      window.scrollTo(0, 0);
    }
  };

  return (
    <Kartu judul="Salinan data">
      <p className="text-sm text-redup">
        Datamu tersimpan di akunmu. Unduh salinan data secara rutin sebagai cadangan pribadi, misalnya sebelum memulihkan atau
        menghapus data.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button type="button" disabled={sibuk !== null} className={tombolKedua} onClick={unduh}>
          {sibuk === "unduh" ? "Menyiapkan..." : "Unduh salinan data"}
        </button>
        <input
          id="file-salinan"
          type="file"
          accept="application/json,.json"
          disabled={sibuk !== null}
          className="peer sr-only"
          onChange={pulihkan}
        />
        <label
          htmlFor="file-salinan"
          aria-disabled={sibuk !== null}
          className={`${tombolKedua} flex cursor-pointer items-center justify-center peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teks peer-disabled:cursor-not-allowed peer-disabled:opacity-50`}
        >
          {sibuk === "pulihkan" ? "Menyimpan..." : "Pulihkan dari salinan"}
        </label>
        <button type="button" disabled={sibuk !== null} className={`${tombolKedua} text-merah`} onClick={hapus}>
          {sibuk === "hapus" ? "Menyimpan..." : "Hapus semua data"}
        </button>
      </div>
      {pesan && (
        <p role="status" className={`mt-3 text-sm font-semibold ${pesan.galat ? "text-merah" : "text-hijau"}`}>
          {pesan.teks}
        </p>
      )}
    </Kartu>
  );
}

function Akun() {
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  return (
    <Kartu judul="Akun">
      <p>
        Masuk sebagai <span className="font-semibold break-all">{emailSesi()}</span>
      </p>
      <button
        type="button"
        disabled={sibuk}
        className={`${tombolKedua} mt-3 w-full`}
        onClick={async () => {
          setSibuk(true);
          // Setelah keluar, penjaga halaman mengarahkan ke /masuk dan data di memori dibuang.
          const g = await keluar();
          setGalat(g);
          setSibuk(false);
        }}
      >
        {sibuk ? "Memproses..." : "Keluar"}
      </button>
      <Galat id="keluar-galat" pesan={galat} />
    </Kartu>
  );
}

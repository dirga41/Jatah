export const KATEGORI_KELUAR = ["Makan", "Transport", "Paket data", "Belanja", "Hiburan", "Biaya tetap", "Lainnya"];
export const SUMBER_MASUK = ["TikTok LIVE", "Sponsor", "Freelance", "Kiriman orang tua", "Lainnya"];

export type BiayaTetap = { id: string; nama: string; nominal: number; tanggal: number };

export type Pengaturan = {
  uangAwal: number;
  biayaTetap: BiayaTetap[];
  sampaiTanggal: string | null;
  siap: boolean;
};

export type Transaksi = {
  id: string;
  tanggal: string;
  jenis: "keluar" | "masuk";
  nominal: number;
  kategori: string;
  catatan: string;
  tetapId?: string;
  /** Bulan tagihan biaya tetap yang dibayar ("YYYY-MM"), bukan bulan tanggal transaksi. */
  untukBulan?: string;
};

export type Data = { versi: 2; pengaturan: Pengaturan; transaksi: Transaksi[] };

/** Satu kemunculan biaya tetap: tagihan bulan tertentu. */
export type Tagihan = BiayaTetap & { bulan: string; jatuhTempo: string };

export type Status = "Aman" | "Hampir habis" | "Lewat jatah";

export const DATA_KOSONG: Data = {
  versi: 2,
  pengaturan: { uangAwal: 0, biayaTetap: [], sampaiTanggal: null, siap: false },
  transaksi: [],
};

// ---- format dan tanggal ----

export function rupiah(n: number): string {
  return (n < 0 ? "-" : "") + "Rp" + String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const dua = (n: number) => String(n).padStart(2, "0");

/** Tanggal lokal perangkat dalam bentuk "YYYY-MM-DD". */
export function kunciTanggal(d = new Date()): string {
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
}

export const bulanDari = (tanggal: string) => tanggal.slice(0, 7);

const keDate = (tanggal: string) => {
  const [y, m, d] = tanggal.split("-").map(Number);
  return new Date(y, m - 1, d || 1);
};

export function jumlahHari(bulan: string): number {
  const [y, m] = bulan.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function geserBulan(bulan: string, n: number): string {
  const d = keDate(bulan);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}`;
}

// Nomor hari sejak 1970 lewat Date.UTC, supaya selisih hari tidak terpengaruh zona waktu atau jam musim panas.
const nomorHari = (tanggal: string) => {
  const [y, m, d] = tanggal.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export const selisihHari = (dari: string, sampai: string) => nomorHari(sampai) - nomorHari(dari);

export function tambahHari(tanggal: string, n: number): string {
  const d = new Date((nomorHari(tanggal) + n) * 86_400_000);
  return `${d.getUTCFullYear()}-${dua(d.getUTCMonth() + 1)}-${dua(d.getUTCDate())}`;
}

export const akhirBulan = (hari: string) => `${bulanDari(hari)}-${dua(jumlahHari(bulanDari(hari)))}`;

export const namaTanggal = (tanggal: string) =>
  keDate(tanggal).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

/** Tanpa nama hari, misalnya "30 November". */
export const tanggalPendek = (tanggal: string) =>
  keDate(tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long" });

export const namaBulan = (bulan: string) =>
  keDate(bulan).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const BULAN = /^\d{4}-\d{2}$/;
export const tanggalSah = (t: string) => TANGGAL.test(t) && tambahHari(t, 0) === t;

/** Pesan kesalahan untuk tanggal target, atau null kalau sah. */
export function periksaTarget(t: string, hari: string): string | null {
  if (!tanggalSah(t)) return "Pilih tanggal.";
  if (t < hari) return "Tanggal tidak boleh sebelum hari ini.";
  if (selisihHari(hari, t) > 366) return "Paling jauh 366 hari dari hari ini.";
  return null;
}

// ---- hitungan ----

const total = (xs: { nominal: number }[]) => xs.reduce((s, x) => s + x.nominal, 0);

export function uangDiTangan(d: Data): number {
  return d.transaksi.reduce((s, t) => s + (t.jenis === "masuk" ? t.nominal : -t.nominal), d.pengaturan.uangAwal);
}

/** sampaiTanggal kalau ada dan belum lewat; kalau tidak, hari terakhir bulan ini. */
export function tanggalAkhir(p: Pengaturan, hari: string): string {
  return p.sampaiTanggal && p.sampaiTanggal >= hari ? p.sampaiTanggal : akhirBulan(hari);
}

/**
 * Tagihan biaya tetap dari bulan ini sampai bulan tanggalAkhir yang jatuh temponya tidak melewati tanggalAkhir
 * dan belum dibayar. Tagihan bulan ini yang jatuh temponya sudah lewat tetap ikut.
 */
export function tagihanBelumDibayar(d: Data, hari: string, akhir: string): Tagihan[] {
  const hasil: Tagihan[] = [];
  for (let bulan = bulanDari(hari); bulan <= bulanDari(akhir); bulan = geserBulan(bulan, 1)) {
    for (const b of d.pengaturan.biayaTetap) {
      const jatuhTempo = `${bulan}-${dua(b.tanggal)}`;
      const lunas = d.transaksi.some((t) => t.tetapId === b.id && t.untukBulan === bulan);
      if (jatuhTempo <= akhir && !lunas) hasil.push({ ...b, bulan, jatuhTempo });
    }
  }
  return hasil.sort((a, b) => a.jatuhTempo.localeCompare(b.jatuhTempo));
}

export const pengeluaranBiasa = (t: Transaksi) => t.jenis === "keluar" && !t.tetapId;

export function statusJatah(jatah: number, terpakai: number): Status {
  if (terpakai > jatah) return "Lewat jatah";
  if (terpakai < jatah * 0.8) return "Aman";
  return "Hampir habis";
}

export function hitungBeranda(d: Data, hari: string) {
  const akhir = tanggalAkhir(d.pengaturan, hari);
  const diTangan = uangDiTangan(d);
  const belumDibayar = tagihanBelumDibayar(d, hari, akhir);
  const tetapBelumDibayar = total(belumDibayar);
  const uangBersih = diTangan - tetapBelumDibayar;
  const sisaHari = selisihHari(hari, akhir) + 1;
  const pengeluaranHariIni = d.transaksi.filter((t) => t.tanggal === hari && pengeluaranBiasa(t));
  const terpakai = total(pengeluaranHariIni);
  const jatah = Math.max(0, Math.floor((uangBersih + terpakai) / sisaHari));
  return {
    tanggalAkhir: akhir,
    targetLewat: d.pengaturan.sampaiTanggal !== null && d.pengaturan.sampaiTanggal < hari,
    uangDiTangan: diTangan,
    belumDibayar,
    tetapBelumDibayar,
    uangBersih,
    sisaHari,
    pengeluaranHariIni,
    terpakai,
    jatah,
    sisaJatah: jatah - terpakai,
    status: statusJatah(jatah, terpakai),
  };
}

export const transaksiBulan = (d: Data, bulan: string) => d.transaksi.filter((t) => bulanDari(t.tanggal) === bulan);

export function arusBulan(d: Data, bulan: string) {
  const ts = transaksiBulan(d, bulan);
  return {
    masuk: total(ts.filter((t) => t.jenis === "masuk")),
    keluar: total(ts.filter((t) => t.jenis === "keluar")),
  };
}

/** Jumlah per kategori untuk satu jenis, urut dari terbesar. Kategori apa pun (termasuk yang lama) tampil apa adanya. */
export function perKategori(d: Data, bulan: string, jenis: Transaksi["jenis"]) {
  const peta = new Map<string, number>();
  for (const t of transaksiBulan(d, bulan)) {
    if (t.jenis === jenis) peta.set(t.kategori, (peta.get(t.kategori) ?? 0) + t.nominal);
  }
  return [...peta].map(([nama, nominal]) => ({ nama, nominal })).sort((a, b) => b.nominal - a.nominal);
}

// ---- pemeriksaan dan migrasi data (dipakai saat memuat dan memulihkan salinan) ----

const bulat = (x: unknown, min = -Infinity, max = Infinity): x is number =>
  Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const teks = (x: unknown): x is string => typeof x === "string";
const objek = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** Mengembalikan Data versi 2 yang bersih kalau bentuknya benar, atau null kalau tidak. */
export function periksaData(x: unknown): Data | null {
  if (!objek(x) || x.versi !== 2 || !objek(x.pengaturan) || !Array.isArray(x.transaksi)) return null;
  const p = x.pengaturan;
  if (
    !bulat(p.uangAwal) ||
    !Array.isArray(p.biayaTetap) ||
    !(p.sampaiTanggal === null || (teks(p.sampaiTanggal) && tanggalSah(p.sampaiTanggal))) ||
    typeof p.siap !== "boolean"
  )
    return null;
  const biayaTetap: BiayaTetap[] = [];
  for (const b of p.biayaTetap) {
    if (!objek(b) || !teks(b.id) || !teks(b.nama) || !bulat(b.nominal, 1) || !bulat(b.tanggal, 1, 28)) return null;
    biayaTetap.push({ id: b.id, nama: b.nama, nominal: b.nominal, tanggal: b.tanggal });
  }
  const transaksi: Transaksi[] = [];
  for (const t of x.transaksi) {
    if (
      !objek(t) ||
      !teks(t.id) ||
      !teks(t.tanggal) ||
      !TANGGAL.test(t.tanggal) ||
      (t.jenis !== "keluar" && t.jenis !== "masuk") ||
      !bulat(t.nominal, 1) ||
      !teks(t.kategori) ||
      !teks(t.catatan) ||
      !(t.tetapId === undefined || teks(t.tetapId)) ||
      !(t.untukBulan === undefined || (teks(t.untukBulan) && BULAN.test(t.untukBulan)))
    )
      return null;
    transaksi.push({
      id: t.id,
      tanggal: t.tanggal,
      jenis: t.jenis,
      nominal: t.nominal,
      kategori: t.kategori,
      catatan: t.catatan,
      ...(t.tetapId !== undefined && { tetapId: t.tetapId }),
      ...(t.untukBulan !== undefined && { untukBulan: t.untukBulan }),
    });
  }
  return {
    versi: 2,
    pengaturan: { uangAwal: p.uangAwal, biayaTetap, sampaiTanggal: p.sampaiTanggal as string | null, siap: p.siap },
    transaksi,
  };
}

/**
 * Mengubah data tersimpan versi mana pun (tanpa versi, 1, atau 2) menjadi versi 2.
 * Transaksi tidak pernah dibuang: setor/tarik lama tetap jadi pengeluaran/pemasukan biasa, jadi uang di tangan sama.
 */
export function migrasi(x: unknown): Data | null {
  if (!objek(x)) return null;
  if (x.versi !== undefined && x.versi !== 1) return periksaData(x);
  if (!objek(x.pengaturan) || !Array.isArray(x.transaksi)) return null;
  const p = x.pengaturan;
  return periksaData({
    versi: 2,
    pengaturan: { uangAwal: p.uangAwal, biayaTetap: p.biayaTetap, sampaiTanggal: null, siap: p.siap },
    transaksi: x.transaksi.map((t) => {
      if (!objek(t)) return t;
      const baru = { ...t };
      delete baru.cadangan;
      if (baru.tetapId !== undefined && baru.untukBulan === undefined && teks(baru.tanggal))
        baru.untukBulan = bulanDari(baru.tanggal);
      return baru;
    }),
  });
}

export const idBaru = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

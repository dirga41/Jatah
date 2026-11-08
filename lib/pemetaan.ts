import { DATA_KOSONG, periksaData, type Data, type Pengaturan, type Transaksi } from "./hitung";

// Satu-satunya tempat nama kolom database (snake_case) bertemu nama di aplikasi (camelCase).

export type BarisPengaturan = {
  uang_awal: number;
  sampai_tanggal: string | null;
  biaya_tetap: Pengaturan["biayaTetap"];
  siap: boolean;
};

export type BarisTransaksi = {
  tanggal: string;
  jenis: Transaksi["jenis"];
  nominal: number;
  kategori: string;
  catatan: string;
  tetap_id: string | null;
  untuk_bulan: string | null;
};

export const keBarisPengaturan = (p: Pengaturan): BarisPengaturan => ({
  uang_awal: p.uangAwal,
  sampai_tanggal: p.sampaiTanggal,
  biaya_tetap: p.biayaTetap,
  siap: p.siap,
});

export const keBarisTransaksi = (t: Omit<Transaksi, "id">): BarisTransaksi => ({
  tanggal: t.tanggal,
  jenis: t.jenis,
  nominal: t.nominal,
  kategori: t.kategori,
  catatan: t.catatan,
  tetap_id: t.tetapId ?? null,
  untuk_bulan: t.untukBulan ?? null,
});

// bigint bisa datang sebagai angka atau teks angka.
const angka = (x: unknown) => (typeof x === "string" && /^-?\d+$/.test(x) ? Number(x) : x);
const tanpaNull = (x: unknown) => (x === null ? undefined : x);
const objek = (x: unknown): Record<string, unknown> =>
  typeof x === "object" && x !== null ? (x as Record<string, unknown>) : {};

/**
 * Baris database → Data aplikasi. pengaturan null berarti akun belum punya baris pengaturan.
 * Mengembalikan null kalau bentuknya tidak dikenali, supaya data tidak pernah dipakai separuh.
 */
export function dariBaris(pengaturan: unknown, transaksi: unknown): Data | null {
  const p = pengaturan == null ? null : objek(pengaturan);
  return periksaData({
    versi: 2,
    pengaturan: p
      ? { uangAwal: angka(p.uang_awal), biayaTetap: p.biaya_tetap, sampaiTanggal: p.sampai_tanggal ?? null, siap: p.siap }
      : DATA_KOSONG.pengaturan,
    transaksi: Array.isArray(transaksi)
      ? transaksi.map((b) => {
          const t = objek(b);
          return {
            id: t.id,
            tanggal: t.tanggal,
            jenis: t.jenis,
            nominal: angka(t.nominal),
            kategori: t.kategori,
            catatan: t.catatan,
            tetapId: tanpaNull(t.tetap_id),
            untukBulan: tanpaNull(t.untuk_bulan),
          };
        })
      : transaksi,
  });
}

export const dariBarisTransaksi = (b: unknown): Transaksi | null => dariBaris(null, [b])?.transaksi[0] ?? null;

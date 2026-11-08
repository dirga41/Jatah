import { DATA_KOSONG, periksaData, rupiah, tanggalPendek, type Data, type Pengaturan, type Transaksi } from "./hitung";

// Daftar tunggu perubahan yang belum terkirim ke server. Semua fungsi di sini murni (kecuali idBaru yang acak).

export type TransaksiBaru = Transaksi & { /** waktu dicatat di perangkat (ISO), dikirim sebagai dibuat_pada */ dibuatPada: string };

export type Op =
  | { opId: string; jenis: "tambah"; transaksi: TransaksiBaru }
  | { opId: string; jenis: "hapus"; transaksiId: string }
  | { opId: string; jenis: "pengaturan"; pengaturan: Pengaturan };

export type OpGagal = { op: Op; pesan: string };
export type Antrean = { versi: 1; ops: Op[]; gagal: OpGagal[] };

export const ANTREAN_KOSONG: Antrean = { versi: 1, ops: [], gagal: [] };

/** uuid v4. crypto.randomUUID hanya ada di konteks aman (https/localhost), jadi ada cadangannya. */
export function idBaru(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Data yang tampil = data dasar ditambah perubahan yang belum terkirim. Data asli tidak diubah. */
export function terapkanAntrean(data: Data, ops: Op[]): Data {
  let { pengaturan, transaksi } = data;
  for (const op of ops) {
    if (op.jenis === "pengaturan") pengaturan = op.pengaturan;
    else if (op.jenis === "hapus") transaksi = transaksi.filter((t) => t.id !== op.transaksiId);
    // Kalau server sudah punya id ini (terkirim tapi antrean belum sempat dibersihkan), jangan dobel.
    else if (!transaksi.some((t) => t.id === op.transaksi.id)) {
      const t: Transaksi & { dibuatPada?: string } = { ...op.transaksi };
      delete t.dibuatPada;
      transaksi = [...transaksi, t];
    }
  }
  return pengaturan === data.pengaturan && transaksi === data.transaksi ? data : { ...data, pengaturan, transaksi };
}

/**
 * Menambah perubahan ke antrean sambil memadatkannya:
 * - hapus transaksi yang masih menunggu sebagai "tambah" membuang keduanya;
 * - beberapa "pengaturan" jadi satu (yang terakhir).
 * `sedangDikirim` adalah opId yang sedang di perjalanan ke server; yang itu tidak boleh dipadatkan.
 */
export function tambahkanOp(a: Antrean, op: Op, sedangDikirim: string | null = null): Antrean {
  if (op.jenis === "hapus") {
    const tambah = a.ops.find((o) => o.jenis === "tambah" && o.transaksi.id === op.transaksiId && o.opId !== sedangDikirim);
    if (tambah) return { ...a, ops: a.ops.filter((o) => o !== tambah) };
  }
  if (op.jenis === "pengaturan")
    return { ...a, ops: [...a.ops.filter((o) => o.jenis !== "pengaturan" || o.opId === sedangDikirim), op] };
  return { ...a, ops: [...a.ops, op] };
}

// ---- membaca dari penyimpanan perangkat ----

const objek = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function periksaOp(x: unknown): Op | null {
  if (!objek(x) || typeof x.opId !== "string") return null;
  if (x.jenis === "hapus") return typeof x.transaksiId === "string" ? { opId: x.opId, jenis: "hapus", transaksiId: x.transaksiId } : null;
  if (x.jenis === "pengaturan") {
    const d = periksaData({ ...DATA_KOSONG, pengaturan: x.pengaturan });
    return d ? { opId: x.opId, jenis: "pengaturan", pengaturan: d.pengaturan } : null;
  }
  if (x.jenis === "tambah" && objek(x.transaksi) && typeof x.transaksi.dibuatPada === "string") {
    const t = periksaData({ ...DATA_KOSONG, transaksi: [x.transaksi] })?.transaksi[0];
    return t ? { opId: x.opId, jenis: "tambah", transaksi: { ...t, dibuatPada: x.transaksi.dibuatPada } } : null;
  }
  return null;
}

/** Isi "jatah:antrean:<id>" → Antrean. null/kosong = antrean kosong; bentuk tak dikenal = "rusak" (jangan dibuang diam-diam). */
export function bacaAntrean(mentah: string | null): Antrean | "rusak" {
  if (!mentah) return ANTREAN_KOSONG;
  try {
    const x: unknown = JSON.parse(mentah);
    if (!objek(x) || x.versi !== 1 || !Array.isArray(x.ops) || !Array.isArray(x.gagal)) return "rusak";
    const ops = x.ops.map(periksaOp);
    const gagal = x.gagal.map((g) => (objek(g) && typeof g.pesan === "string" ? { op: periksaOp(g.op), pesan: g.pesan } : null));
    if (ops.some((o) => !o) || gagal.some((g) => !g?.op)) return "rusak";
    return { versi: 1, ops: ops as Op[], gagal: gagal as OpGagal[] };
  } catch {
    return "rusak";
  }
}

/** Isi "jatah:cache:<id>" → Data, atau null kalau tidak ada/tidak sah. */
export function bacaCache(mentah: string | null): Data | null {
  if (!mentah) return null;
  try {
    const x: unknown = JSON.parse(mentah);
    return objek(x) && x.versi === 1 ? periksaData(x.data) : null;
  } catch {
    return null;
  }
}

// ---- mengirim ----

/** Hasil mengirim satu perubahan. */
export type Hasil = "ok" | "jaringan" | "sesi" | { ditolak: string };

/**
 * Mengirim antrean satu per satu sesuai urutan. Setiap perubahan yang selesai langsung dibuang dari antrean
 * dan antrean disimpan sebelum lanjut. Berhenti (sisa tetap utuh) kalau jaringan putus atau sesi habis.
 * Perubahan yang ditolak server dipindah ke daftar gagal, lalu lanjut ke berikutnya.
 * `ambil` membaca antrean terbaru (bisa berubah selama pengiriman), `simpan` menyimpannya.
 */
export async function kirimAntrean(o: {
  ambil: () => Antrean;
  simpan: (a: Antrean) => void;
  kirim: (op: Op) => Promise<Hasil>;
  sedang?: (opId: string | null) => void;
}): Promise<"selesai" | "jaringan" | "sesi"> {
  for (;;) {
    const op = o.ambil().ops[0];
    if (!op) return "selesai";
    o.sedang?.(op.opId);
    let h: Hasil;
    try {
      h = await o.kirim(op);
    } catch {
      h = "jaringan";
    } finally {
      o.sedang?.(null);
    }
    if (h === "jaringan" || h === "sesi") return h;
    const a = o.ambil();
    o.simpan({
      ...a,
      ops: a.ops.filter((x) => x.opId !== op.opId),
      gagal: h === "ok" ? a.gagal : [...a.gagal, { op, pesan: h.ditolak }],
    });
  }
}

/** Kalimat singkat untuk daftar "gagal dikirim", misalnya "Pengeluaran Rp12.000, Makan, 7 November". */
export function jelaskanOp(op: Op): string {
  if (op.jenis === "pengaturan") return "Perubahan pengaturan";
  if (op.jenis === "hapus") return "Hapus satu transaksi";
  const t = op.transaksi;
  return `${t.jenis === "keluar" ? "Pengeluaran" : "Pemasukan"} ${rupiah(t.nominal)}, ${t.kategori}, ${tanggalPendek(t.tanggal)}`;
}

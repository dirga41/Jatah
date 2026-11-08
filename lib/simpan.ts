"use client";

import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { ambilSemua } from "./ambil";
import {
  ANTREAN_KOSONG,
  bacaAntrean,
  bacaCache,
  idBaru,
  kirimAntrean,
  tambahkanOp,
  terapkanAntrean,
  type Antrean,
  type Hasil,
  type Op,
  type OpGagal,
} from "./antrean";
import { DATA_KOSONG, migrasi, type Data, type Pengaturan, type Transaksi } from "./hitung";
import { dariBaris, keBarisPengaturan, keBarisTransaksi } from "./pemetaan";
import { galatJaringan, pesanGalat } from "./pesan";
import { klien } from "./supabase";

// Alur data: data dasar (cache perangkat / hasil server) + antrean perubahan yang belum terkirim = data yang tampil.
// Semua penulisan masuk antrean dulu, lalu dikirim ke server satu per satu.

export type Pengguna = { id: string; email: string };

export type Keadaan =
  | { status: "memuat" }
  | { status: "gagal" }
  | { status: "offline-kosong" }
  | { status: "siap"; data: Data; /** akun belum punya data apa pun di server */ kosong: boolean };

export type Sinkron = {
  /** browser online dan percobaan terakhir ke server tidak gagal karena jaringan */
  online: boolean;
  mengirim: boolean;
  menunggu: number;
  gagal: OpGagal[];
  perluMasuk: boolean;
  /** id transaksi yang belum terkirim ke server */
  belumTerkirim: Set<string>;
  peringatan: string | null;
};

const MEMUAT: Keadaan = { status: "memuat" };
const SINKRON_AWAL: Sinkron = {
  online: true,
  mengirim: false,
  menunggu: 0,
  gagal: [],
  perluMasuk: false,
  belumTerkirim: new Set(),
  peringatan: null,
};

/** undefined = status login belum diketahui. */
let pengguna: Pengguna | null | undefined;
let pemulihan = false;
let hidup = false;
let dasar: { data: Data; kosong: boolean } | null = null;
let antrean: Antrean = ANTREAN_KOSONG;
let gagalAmbil = false;
let putus = false; // percobaan terakhir ke server gagal karena jaringan
let mengirim = false;
let perluMasuk = false;
let penyimpananMati = false;
let peringatan: string | null = null;
let opDikirim: string | null = null;
let gagalBeruntun = 0;
let pewaktu: ReturnType<typeof setTimeout> | undefined;

let keadaan: Keadaan = MEMUAT;
let sinkron: Sinkron = SINKRON_AWAL;
const pendengar = new Set<() => void>();

const browserOnline = () => typeof navigator === "undefined" || navigator.onLine;

function segarkan() {
  if (!pengguna) keadaan = MEMUAT;
  else if (dasar)
    keadaan = { status: "siap", data: terapkanAntrean(dasar.data, antrean.ops), kosong: dasar.kosong && !antrean.ops.length };
  else if (gagalAmbil) keadaan = putus ? { status: "offline-kosong" } : { status: "gagal" };
  else keadaan = MEMUAT;
  sinkron = {
    online: browserOnline() && !putus,
    mengirim,
    menunggu: antrean.ops.length,
    gagal: antrean.gagal,
    perluMasuk,
    belumTerkirim: new Set(antrean.ops.flatMap((o) => (o.jenis === "tambah" ? [o.transaksi.id] : []))),
    peringatan,
  };
  pendengar.forEach((f) => f());
}

// ---- penyimpanan perangkat ----

const baca = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const tulis = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
};
const buang = (k: string) => {
  try {
    localStorage.removeItem(k);
  } catch {}
};
const kunci = (jenis: string, id = pengguna?.id) => `jatah:${jenis}:${id}`;
const PENYIMPANAN_MATI = "Penyimpanan di HP tidak bisa dipakai, perubahan ini belum tersimpan.";

function matikanPenyimpanan() {
  penyimpananMati = true;
  peringatan = "Penyimpanan di HP tidak bisa dipakai, jadi Jatah hanya bisa dipakai saat online.";
}

/** Antrean terbaru: dibaca ulang dari perangkat karena tab lain bisa saja mengubahnya. */
function antreanTerbaru(): Antrean {
  if (!penyimpananMati && pengguna) {
    const a = bacaAntrean(baca(kunci("antrean")));
    if (a !== "rusak") antrean = a;
  }
  return antrean;
}

/** Menyimpan antrean di perangkat. false kalau penyimpanan tidak bisa dipakai (antrean hanya di memori). */
function simpanAntrean(a: Antrean): boolean {
  antrean = a;
  if (penyimpananMati || !pengguna) return false;
  if (tulis(kunci("antrean"), JSON.stringify(a))) return true;
  matikanPenyimpanan();
  return false;
}

function simpanCache(data: Data) {
  if (pengguna && !penyimpananMati && !tulis(kunci("cache"), JSON.stringify({ versi: 1, data, waktu: new Date().toISOString() })))
    matikanPenyimpanan();
}

function muatDariPerangkat() {
  penyimpananMati = !tulis("jatah:uji", "1");
  buang("jatah:uji");
  peringatan = null;
  if (penyimpananMati) return matikanPenyimpanan();
  const cache = bacaCache(baca(kunci("cache")));
  // Dari cache belum tahu apakah akun benar-benar kosong; itu baru dipastikan setelah server menjawab.
  dasar = cache ? { data: cache, kosong: false } : null;
  const mentah = baca(kunci("antrean"));
  const a = bacaAntrean(mentah);
  if (a === "rusak") {
    // Jangan dibuang diam-diam: simpan mentahnya terpisah lalu beri tahu.
    tulis(kunci("antrean-rusak"), mentah ?? "");
    buang(kunci("antrean"));
    antrean = ANTREAN_KOSONG;
    peringatan = "Ada perubahan tersimpan di HP ini yang rusak dan tidak bisa dikirim. Isinya disimpan terpisah di perangkat.";
  } else antrean = a;
}

const PENGGUNA_TERAKHIR = "jatah:pengguna";
function bacaPenggunaTerakhir(): Pengguna | null {
  try {
    const p = JSON.parse(baca(PENGGUNA_TERAKHIR) ?? "null");
    return typeof p?.id === "string" && typeof p?.email === "string" ? p : null;
  } catch {
    return null;
  }
}

function aturPengguna(p: Pengguna | null) {
  if (p?.id !== pengguna?.id) {
    // Pengguna berganti atau keluar: buang semua data di memori.
    dasar = null;
    antrean = ANTREAN_KOSONG;
    gagalAmbil = putus = mengirim = perluMasuk = false;
    peringatan = null;
    gagalBeruntun = 0;
    clearTimeout(pewaktu);
    pengguna = p;
    if (p) {
      muatDariPerangkat();
      setTimeout(() => void sinkronkan(), 0);
    }
  } else pengguna = p;
  segarkan();
}

// ---- login ----

function hidupkan() {
  const kl = klien();
  if (hidup || !kl) return;
  hidup = true;
  // Tampilkan data perangkat milik pengguna terakhir langsung, tanpa menunggu supabase-js: saat offline dengan token
  // kedaluwarsa, ia mencoba refresh sampai ~30 detik sebelum memberi INITIAL_SESSION. Kalau sesi ternyata ditolak
  // server, INITIAL_SESSION/SIGNED_OUT di bawah tetap mengeluarkan pengguna.
  const terakhir = bacaPenggunaTerakhir();
  if (terakhir) aturPengguna(terakhir);
  // Didaftarkan langsung setelah klien dibuat supaya PASSWORD_RECOVERY dari tautan email tidak terlewat.
  kl.auth.onAuthStateChange((event, s) => {
    if (event === "PASSWORD_RECOVERY") pemulihan = true;
    if (s) {
      const p = { id: s.user.id, email: s.user.email ?? "" };
      tulis(PENGGUNA_TERAKHIR, JSON.stringify(p));
      perluMasuk = false;
      aturPengguna(p);
      // Sesi baru/diperbarui: saatnya mengirim antrean. Ditunda satu giliran (memanggil Supabase di sini bisa macet).
      if (event !== "INITIAL_SESSION") setTimeout(() => void sinkronkan(), 0);
    } else if (event === "INITIAL_SESSION") setTimeout(() => void periksaSesiOffline(), 0);
    else {
      // SIGNED_OUT: sesi ditolak server atau pengguna keluar.
      buang(PENGGUNA_TERAKHIR);
      aturPengguna(null);
    }
  });
  window.addEventListener("online", () => {
    putus = false;
    segarkan();
    void sinkronkan();
  });
  window.addEventListener("offline", segarkan);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void sinkronkan();
  });
}

/**
 * supabase-js memberi INITIAL_SESSION null kalau token akses sudah kedaluwarsa dan refresh gagal karena jaringan
 * (sesi tetap tersimpan; baru dibuang kalau server menolaknya). Dalam keadaan itu pengguna tetap dianggap masuk
 * memakai data perangkat; supabase-js memperbarui sesinya sendiri saat online lagi (TOKEN_REFRESHED).
 */
async function periksaSesiOffline() {
  const kl = klien();
  const terakhir = bacaPenggunaTerakhir();
  if (kl && terakhir) {
    const { error } = await kl.auth.getSession();
    if (error && isAuthRetryableFetchError(error)) {
      aturPengguna(terakhir);
      putus = true;
      segarkan();
      return;
    }
  }
  buang(PENGGUNA_TERAKHIR);
  aturPengguna(null);
}

const dengar = (f: () => void) => {
  hidupkan();
  pendengar.add(f);
  return () => {
    pendengar.delete(f);
  };
};

/** Pengguna yang sedang masuk; undefined selama belum diketahui (juga saat render di server). */
export const useSesi = () => useSyncExternalStore(dengar, () => pengguna, () => undefined);
/** Data akun; saat render di server selalu "memuat". */
export const useData = () => useSyncExternalStore(dengar, () => keadaan, () => MEMUAT);
/** Status pengiriman dan koneksi. */
export const useSinkron = () => useSyncExternalStore(dengar, () => sinkron, () => SINKRON_AWAL);
/** true kalau halaman dibuka dari tautan atur ulang kata sandi yang sah. */
export const sedangPemulihan = () => pemulihan;
export const emailSesi = () => pengguna?.email ?? "";

// ---- server ----

async function ambilData(kl: SupabaseClient): Promise<{ data: Data; kosong: boolean }> {
  const [p, transaksi] = await Promise.all([
    kl
      .from("pengaturan")
      .select("*")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error;
        return data;
      }),
    // Urutan tanggal, lalu waktu dicatat, lalu id supaya urutan stabil antarhalaman.
    ambilSemua((dari, sampai) =>
      kl.from("transaksi").select("*", { count: "exact" }).order("tanggal").order("dibuat_pada").order("id").range(dari, sampai),
    ),
  ]);
  const data = dariBaris(p, transaksi);
  if (!data) throw new Error("Bentuk data dari server tidak dikenali.");
  return { data, kosong: p === null && transaksi.length === 0 };
}

/**
 * Memastikan ada sesi yang sah sebelum bicara dengan server. Tanpa sesi, server menjawab "kosong" (aturan keamanan),
 * dan jawaban kosong itu tidak boleh dianggap data akun.
 */
async function pastikanSesi(kl: SupabaseClient): Promise<boolean> {
  const { data, error } = await kl.auth.getSession();
  // Sesi bisa dibaca tanpa internet, jadi ini tidak membuktikan sudah online; tanda putus baru hilang saat server menjawab.
  if (data.session) {
    perluMasuk = false;
    return true;
  }
  if (error && isAuthRetryableFetchError(error)) putus = true;
  else perluMasuk = true;
  return false;
}

async function ambilDariServer(kl: SupabaseClient) {
  const id = pengguna?.id;
  try {
    const hasil = await ambilData(kl);
    if (pengguna?.id !== id) return;
    // Aman walau antrean belum kosong: antrean tetap diterapkan di atasnya dan tidak membuat dobel.
    dasar = hasil;
    gagalAmbil = putus = false;
    simpanCache(hasil.data);
  } catch (e) {
    if (pengguna?.id !== id) return;
    putus = galatJaringan(e);
    if (!dasar) gagalAmbil = true;
  }
  segarkan();
}

const batasWaktu = () => (typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(15_000) : new AbortController().signal);

/** Menggolongkan jawaban server: jaringan/5xx/waktu habis, sesi habis, atau ditolak. */
function golongkan(r: { error: unknown; status: number }): Hasil {
  if (!r.error) return "ok";
  if (r.status === 0 || r.status === 408 || r.status >= 500) return "jaringan";
  const kode = (r.error as { code?: unknown }).code;
  if (r.status === 401 || kode === "PGRST301" || kode === "PGRST303") return "sesi";
  return { ditolak: pesanGalat(r.error) };
}

async function kirimOp(kl: SupabaseClient, op: Op): Promise<Hasil> {
  const jalankan = async () => {
    if (op.jenis === "tambah") {
      const t = op.transaksi;
      // id dan dibuat_pada dari perangkat; kalau id sudah ada (kiriman ulang), diabaikan, jadi tidak pernah dobel.
      return kl
        .from("transaksi")
        .upsert({ id: t.id, ...keBarisTransaksi(t), dibuat_pada: t.dibuatPada }, { onConflict: "id", ignoreDuplicates: true })
        .abortSignal(batasWaktu());
    }
    // Baris yang sudah tidak ada tetap dijawab berhasil.
    if (op.jenis === "hapus") return kl.from("transaksi").delete().eq("id", op.transaksiId).abortSignal(batasWaktu());
    return kl
      .from("pengaturan")
      .upsert({ user_id: pengguna!.id, ...keBarisPengaturan(op.pengaturan), diubah_pada: new Date().toISOString() })
      .abortSignal(batasWaktu());
  };
  let h = golongkan(await jalankan());
  if (h === "sesi") {
    // Coba perbarui sesi satu kali.
    const { data } = await kl.auth.refreshSession();
    if (data.session) h = golongkan(await jalankan());
  }
  return h;
}

// ---- sinkron ----

let berjalan: Promise<void> | null = null;
let ulang = false;

/** Satu pengiriman pada satu waktu, juga antar-tab (navigator.locks); tanpa locks hanya dijaga di tab ini. */
function denganKunci<T>(f: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks?.request ? locks.request("jatah-sinkron", f) : f();
}

async function putaran() {
  const kl = klien();
  if (!kl || !pengguna) return;
  antreanTerbaru();
  if (!(await pastikanSesi(kl))) return segarkan();
  if (antrean.ops.length) {
    mengirim = true;
    segarkan();
    const hasil = await kirimAntrean({
      ambil: antreanTerbaru,
      simpan: (a) => {
        simpanAntrean(a);
        segarkan();
      },
      kirim: async (op) => {
        const h = await kirimOp(kl, op);
        // Sudah di server: masukkan ke data dasar (dan cache) sebelum dibuang dari antrean, supaya tampilan tidak loncat
        // dan cache tetap lengkap walau internet putus sebelum data diambil ulang.
        if (h === "ok") putus = false;
        if (h === "ok" && dasar) {
          dasar = { data: terapkanAntrean(dasar.data, [op]), kosong: false };
          simpanCache(dasar.data);
        }
        return h;
      },
      sedang: (id) => (opDikirim = id),
    });
    mengirim = false;
    if (hasil === "jaringan") putus = true;
    if (hasil === "sesi") perluMasuk = true;
    if (hasil !== "selesai") return segarkan();
  }
  await ambilDariServer(kl);
}

/** Mengirim antrean lalu mengambil ulang data. Panggilan yang datang saat sedang berjalan ikut menunggu putaran berikutnya. */
export function sinkronkan(): Promise<void> {
  if (!pengguna || !klien()) return Promise.resolve();
  if (berjalan) {
    ulang = true;
    return berjalan;
  }
  berjalan = (async () => {
    try {
      do {
        ulang = false;
        await denganKunci(putaran);
      } while (ulang);
    } catch {
      putus = true;
    } finally {
      berjalan = null;
      jadwalkan();
      segarkan();
    }
  })();
  return berjalan;
}

/** Coba lagi berkala selama masih ada antrean atau server belum terjangkau: 30 detik, makin lama kalau terus gagal, maks 5 menit. */
function jadwalkan() {
  clearTimeout(pewaktu);
  const masihPerlu = pengguna && !perluMasuk && (antrean.ops.length || putus || gagalAmbil);
  if (!masihPerlu) {
    gagalBeruntun = 0;
    return;
  }
  const jeda = Math.min(30_000 * 2 ** gagalBeruntun, 300_000);
  gagalBeruntun++;
  pewaktu = setTimeout(() => void sinkronkan(), jeda);
}

/** Tombol "Coba lagi" di layar gagal memuat. */
export function muat(): Promise<void> {
  gagalAmbil = false;
  segarkan();
  return sinkronkan();
}

// ---- menulis (semua lewat antrean) ----

const BELUM_MASUK = "Kamu belum masuk. Muat ulang halaman lalu masuk lagi.";

/** Menyimpan perubahan di perangkat lalu mengirimnya. Tampilan langsung berubah tanpa menunggu server. */
async function catat(ops: Op[]): Promise<string | null> {
  if (!pengguna) return BELUM_MASUK;
  let a = antreanTerbaru();
  for (const op of ops) a = tambahkanOp(a, op, opDikirim);
  const tersimpan = simpanAntrean(a);
  segarkan();
  if (tersimpan) {
    void sinkronkan();
    return null;
  }
  // Penyimpanan perangkat tidak bisa dipakai: kirim sekarang dan tunggu, seperti aplikasi online biasa.
  await sinkronkan();
  const id = new Set(ops.map((o) => o.opId));
  const ditolak = antrean.gagal.find((g) => id.has(g.op.opId));
  if (!antrean.ops.some((o) => id.has(o.opId)) && !ditolak) return null;
  antrean = { ...antrean, ops: antrean.ops.filter((o) => !id.has(o.opId)), gagal: antrean.gagal.filter((g) => !id.has(g.op.opId)) };
  segarkan();
  return ditolak?.pesan ?? PENYIMPANAN_MATI;
}

export const simpanPengaturan = (p: Pengaturan) => catat([{ opId: idBaru(), jenis: "pengaturan", pengaturan: p }]);

/** Menambah transaksi. Kalau pengaturan diberikan (tanggal target baru), pengaturan ikut disimpan. */
export const tambahTransaksi = (t: Omit<Transaksi, "id">, pengaturan?: Pengaturan) =>
  catat([
    ...(pengaturan ? [{ opId: idBaru(), jenis: "pengaturan" as const, pengaturan }] : []),
    { opId: idBaru(), jenis: "tambah", transaksi: { ...t, id: idBaru(), dibuatPada: new Date().toISOString() } },
  ]);

export const hapusTransaksi = (id: string) => catat([{ opId: idBaru(), jenis: "hapus", transaksiId: id }]);

/** Mengirim ulang perubahan yang gagal (ditaruh di akhir antrean). */
export function cobaLagiGagal(opId: string) {
  const a = antreanTerbaru();
  const g = a.gagal.find((x) => x.op.opId === opId);
  if (!g) return;
  simpanAntrean({ ...a, ops: [...a.ops, g.op], gagal: a.gagal.filter((x) => x !== g) });
  segarkan();
  void sinkronkan();
}

export function buangGagal(opId: string) {
  const a = antreanTerbaru();
  simpanAntrean({ ...a, gagal: a.gagal.filter((x) => x.op.opId !== opId) });
  segarkan();
}

/** Jumlah perubahan yang belum sampai ke server (menunggu + gagal). */
export const jumlahBelumTerkirim = () => antrean.ops.length + antrean.gagal.length;

// ---- operasi yang butuh internet ----

const BUTUH_INTERNET = "Butuh internet. Coba lagi saat online.";

/** Ganti/hapus semua data dijalankan setelah antrean terkirim, supaya perubahan lama tidak menimpa hasilnya. */
async function setelahAntreanTerkirim(kerja: (kl: SupabaseClient) => Promise<string | null>): Promise<string | null> {
  const kl = klien();
  if (!kl || !pengguna) return BELUM_MASUK;
  await sinkronkan();
  return denganKunci(async () => {
    if (antreanTerbaru().ops.length) return "Masih ada perubahan yang belum terkirim. Coba lagi saat online.";
    if (!(await pastikanSesi(kl))) {
      segarkan();
      return putus ? BUTUH_INTERNET : BELUM_MASUK;
    }
    return kerja(kl);
  });
}

/** Mengganti semua data akun dalam satu transaksi database (pindah data lama, pulihkan salinan). */
export const gantiSemua = (data: Data) =>
  setelahAntreanTerkirim(async (kl) => {
    try {
      const { error } = await kl.rpc("ganti_semua_data", {
        p_pengaturan: keBarisPengaturan(data.pengaturan),
        p_transaksi: data.transaksi.map(keBarisTransaksi),
      });
      if (error) return pesanGalat(error);
    } catch (e) {
      return pesanGalat(e);
    }
    // id transaksi dibuat ulang oleh database, jadi ambil ulang.
    await ambilDariServer(kl);
    return null;
  });

export const hapusSemua = () =>
  setelahAntreanTerkirim(async (kl) => {
    try {
      const { error } = await kl.rpc("hapus_semua_data");
      if (error) return pesanGalat(error);
    } catch (e) {
      return pesanGalat(e);
    }
    dasar = { data: DATA_KOSONG, kosong: true };
    simpanCache(DATA_KOSONG);
    segarkan();
    return null;
  });

/** Salinan data dari yang ada di perangkat (cache server + perubahan yang belum terkirim), jadi bisa dipakai offline. */
export function ambilSalinan(): Data {
  if (keadaan.status !== "siap") throw new Error("Data belum dimuat.");
  return keadaan.data;
}

/** Keluar dari perangkat ini; cache dan antrean milik pengguna ini ikut dihapus dari perangkat. */
export async function keluar(): Promise<string | null> {
  const kl = klien();
  const id = pengguna?.id;
  // Data perangkat dihapus dulu: signOut baru selesai setelah mencoba menghubungi server, yang bisa lama saat offline.
  if (id) {
    buang(kunci("cache", id));
    buang(kunci("antrean", id));
  }
  buang(PENGGUNA_TERAKHIR);
  aturPengguna(null);
  if (kl) {
    // scope local: sesi di perangkat ini dihapus sebelum server dihubungi, jadi tetap berhasil walau tanpa internet.
    const { error } = await kl.auth.signOut({ scope: "local" });
    if (error && !galatJaringan(error)) return pesanGalat(error);
  }
  return null;
}

// ---- data lama dari versi tanpa akun (localStorage) ----

const KUNCI_LAMA = "jatah:v1";
const KUNCI_DIPINDAH = "jatah:dipindah";

/** Data lama di perangkat ini yang belum pernah dipindah, sudah dimigrasi ke versi 2. null kalau tidak ada. */
export function dataLokalLama(): Data | null {
  try {
    if (localStorage.getItem(KUNCI_DIPINDAH)) return null;
    const mentah = localStorage.getItem(KUNCI_LAMA);
    const data = mentah ? migrasi(JSON.parse(mentah)) : null;
    return data && (data.pengaturan.siap || data.transaksi.length) ? data : null;
  } catch {
    return null;
  }
}

/** Memindahkan data lama ke akun. Data lokal tidak dihapus; hanya diberi penanda sudah dipindah. */
export async function pindahkanDataLama(data: Data): Promise<string | null> {
  const gagal = await gantiSemua(data);
  if (!gagal) tulis(KUNCI_DIPINDAH, new Date().toISOString());
  return gagal;
}

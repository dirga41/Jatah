"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { ambilSemua } from "./ambil";
import { DATA_KOSONG, migrasi, type Data, type Pengaturan, type Transaksi } from "./hitung";
import { dariBaris, dariBarisTransaksi, keBarisPengaturan, keBarisTransaksi } from "./pemetaan";
import { pesanGalat } from "./pesan";
import { klien } from "./supabase";

export type Keadaan =
  | { status: "memuat" }
  | { status: "gagal" }
  | { status: "siap"; data: Data; /** akun belum punya data apa pun di database */ kosong: boolean };

const MEMUAT: Keadaan = { status: "memuat" };
let keadaan: Keadaan = MEMUAT;
/** undefined = status login belum diketahui. */
let sesi: Session | null | undefined;
let pemulihan = false;
let hidup = false;
// Dinaikkan setiap kali data berubah atau pengguna berganti, supaya hasil pengambilan yang sudah basi diabaikan.
let nomor = 0;
const pendengar = new Set<() => void>();
const kabari = () => pendengar.forEach((f) => f());
const atur = (k: Keadaan) => {
  keadaan = k;
  kabari();
};

function hidupkan() {
  const kl = klien();
  if (hidup || !kl) return;
  hidup = true;
  // Didaftarkan langsung setelah klien dibuat supaya PASSWORD_RECOVERY dari tautan email tidak terlewat.
  kl.auth.onAuthStateChange((event, s) => {
    if (event === "PASSWORD_RECOVERY") pemulihan = true;
    const berganti = s?.user.id !== sesi?.user.id;
    sesi = s;
    if (berganti) {
      // Pengguna berganti atau keluar: buang data di memori.
      nomor++;
      keadaan = MEMUAT;
      // Jangan memanggil Supabase langsung di dalam callback ini (bisa macet); tunda satu giliran.
      if (s) setTimeout(() => void muat(), 0);
    }
    kabari();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && sesi) void muat();
  });
}

const dengar = (f: () => void) => {
  hidupkan();
  pendengar.add(f);
  return () => {
    pendengar.delete(f);
  };
};

/** Sesi login; undefined selama belum diketahui (juga saat render di server). */
export const useSesi = () => useSyncExternalStore(dengar, () => sesi, () => undefined);
/** Data akun; saat render di server selalu "memuat". */
export const useData = () => useSyncExternalStore(dengar, () => keadaan, () => MEMUAT);
/** true kalau halaman dibuka dari tautan atur ulang kata sandi yang sah. */
export const sedangPemulihan = () => pemulihan;

async function ambilData(kl: SupabaseClient): Promise<{ data: Data; kosong: boolean }> {
  const [pengaturan, transaksi] = await Promise.all([
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
      kl
        .from("transaksi")
        .select("*", { count: "exact" })
        .order("tanggal")
        .order("dibuat_pada")
        .order("id")
        .range(dari, sampai),
    ),
  ]);
  const data = dariBaris(pengaturan, transaksi);
  if (!data) throw new Error("Bentuk data dari server tidak dikenali.");
  return { data, kosong: pengaturan === null && transaksi.length === 0 };
}

/** Mengambil ulang semua data akun. Mengembalikan false kalau gagal. */
export async function muat(): Promise<boolean> {
  const kl = klien();
  if (!kl || !sesi) return false;
  const n = ++nomor;
  if (keadaan.status === "gagal") atur(MEMUAT);
  try {
    const hasil = await ambilData(kl);
    if (n === nomor) atur({ status: "siap", ...hasil });
    return true;
  } catch {
    // Kalau data lama sudah tampil (misalnya saat kembali ke tab), biarkan; jangan diganti layar gagal.
    if (n === nomor && keadaan.status !== "siap") atur({ status: "gagal" });
    return false;
  }
}

function ubahData(fn: (d: Data) => Data) {
  if (keadaan.status !== "siap") return;
  nomor++;
  atur({ status: "siap", data: fn(keadaan.data), kosong: false });
}

const BELUM_MASUK = "Kamu belum masuk. Muat ulang halaman lalu masuk lagi.";

export async function simpanPengaturan(p: Pengaturan): Promise<string | null> {
  const kl = klien();
  if (!kl || !sesi) return BELUM_MASUK;
  try {
    const { error } = await kl
      .from("pengaturan")
      .upsert({ user_id: sesi.user.id, ...keBarisPengaturan(p), diubah_pada: new Date().toISOString() });
    if (error) return pesanGalat(error);
  } catch (e) {
    return pesanGalat(e);
  }
  ubahData((d) => ({ ...d, pengaturan: p }));
  return null;
}

/** Menambah transaksi. Kalau pengaturan diberikan (tanggal target baru), pengaturan disimpan dulu. */
export async function tambahTransaksi(t: Omit<Transaksi, "id">, pengaturan?: Pengaturan): Promise<string | null> {
  const kl = klien();
  if (!kl || !sesi) return BELUM_MASUK;
  // Pengaturan dulu: menyimpannya ulang aman, sedangkan mengulang transaksi bisa membuatnya tercatat dua kali.
  if (pengaturan) {
    const gagal = await simpanPengaturan(pengaturan);
    if (gagal) return gagal;
  }
  try {
    const { data, error } = await kl.from("transaksi").insert(keBarisTransaksi(t)).select().single();
    if (error) return pesanGalat(error);
    const baru = dariBarisTransaksi(data);
    if (baru) ubahData((d) => ({ ...d, transaksi: [...d.transaksi, baru] }));
    else void muat();
    return null;
  } catch (e) {
    return pesanGalat(e);
  }
}

export async function hapusTransaksi(id: string): Promise<string | null> {
  const kl = klien();
  if (!kl || !sesi) return BELUM_MASUK;
  try {
    const { error } = await kl.from("transaksi").delete().eq("id", id);
    if (error) return pesanGalat(error);
  } catch (e) {
    return pesanGalat(e);
  }
  ubahData((d) => ({ ...d, transaksi: d.transaksi.filter((t) => t.id !== id) }));
  return null;
}

/** Mengganti semua data akun dalam satu transaksi database (pindah data lama, pulihkan salinan). */
export async function gantiSemua(data: Data): Promise<string | null> {
  const kl = klien();
  if (!kl || !sesi) return BELUM_MASUK;
  try {
    const { error } = await kl.rpc("ganti_semua_data", {
      p_pengaturan: keBarisPengaturan(data.pengaturan),
      p_transaksi: data.transaksi.map(keBarisTransaksi),
    });
    if (error) return pesanGalat(error);
  } catch (e) {
    return pesanGalat(e);
  }
  // id transaksi dibuat ulang oleh database, jadi ambil ulang. Kalau gagal, tampilkan layar "Coba lagi".
  if (!(await muat())) atur({ status: "gagal" });
  return null;
}

export async function hapusSemua(): Promise<string | null> {
  const kl = klien();
  if (!kl || !sesi) return BELUM_MASUK;
  try {
    const { error } = await kl.rpc("hapus_semua_data");
    if (error) return pesanGalat(error);
  } catch (e) {
    return pesanGalat(e);
  }
  nomor++;
  atur({ status: "siap", data: DATA_KOSONG, kosong: true });
  return null;
}

/** Data akun langsung dari database (semua halaman), untuk file salinan. Melempar kalau gagal. */
export async function ambilSalinan(): Promise<Data> {
  const kl = klien();
  if (!kl || !sesi) throw new Error(BELUM_MASUK);
  return (await ambilData(kl)).data;
}

export async function keluar(): Promise<string | null> {
  const kl = klien();
  if (!kl) return null;
  // scope local: keluar dari perangkat ini saja, dan tetap berhasil walau sedang tanpa internet.
  const { error } = await kl.auth.signOut({ scope: "local" });
  return error ? pesanGalat(error) : null;
}

export const emailSesi = () => sesi?.user.email ?? "";

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
  if (!gagal) {
    try {
      localStorage.setItem(KUNCI_DIPINDAH, new Date().toISOString());
    } catch {}
  }
  return gagal;
}

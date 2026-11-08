export type Halaman<T> = { data: T[] | null; error: unknown; count?: number | null };

/**
 * Mengambil semua baris halaman demi halaman (Supabase hanya mengembalikan maksimal 1000 baris per permintaan).
 * Satu halaman gagal = seluruh pengambilan gagal (melempar), supaya data separuh tidak pernah dipakai.
 * Kalau pengambil memberi count, jumlah akhir dicocokkan dengannya.
 */
export async function ambilSemua<T>(
  ambil: (dari: number, sampai: number) => PromiseLike<Halaman<T>>,
  ukuran = 1000,
): Promise<T[]> {
  const semua: T[] = [];
  let jumlah: number | null | undefined;
  for (let dari = 0; ; dari += ukuran) {
    const { data, error, count } = await ambil(dari, dari + ukuran - 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Bentuk data dari server tidak dikenali.");
    semua.push(...data);
    jumlah = count ?? jumlah;
    if (data.length < ukuran) break;
  }
  // Server bisa saja membatasi kurang dari ukuran halaman; jangan anggap selesai kalau jumlahnya belum cocok.
  if (typeof jumlah === "number" && jumlah !== semua.length) throw new Error("Data dari server tidak lengkap.");
  return semua;
}

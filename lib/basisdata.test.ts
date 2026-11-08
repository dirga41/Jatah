import { describe, expect, it } from "vitest";
import { ambilSemua, type Halaman } from "./ambil";
import { DATA_KOSONG, type Data } from "./hitung";
import { dariBaris, dariBarisTransaksi, keBarisPengaturan, keBarisTransaksi } from "./pemetaan";
import { pesanGalat } from "./pesan";

describe("pemetaan baris database <-> aplikasi", () => {
  const barisPengaturan = {
    user_id: "u1",
    uang_awal: "2500000", // bigint bisa datang sebagai teks
    sampai_tanggal: null,
    biaya_tetap: [{ id: "kos", nama: "Kos", nominal: 1_000_000, tanggal: 1 }],
    siap: true,
    diubah_pada: "2026-11-08T10:00:00Z",
  };
  const barisTransaksi = [
    { id: "a", user_id: "u1", tanggal: "2026-11-01", jenis: "keluar", nominal: 1_000_000, kategori: "Biaya tetap", catatan: "Kos", tetap_id: "kos", untuk_bulan: "2026-11", dibuat_pada: "x" },
    { id: "b", user_id: "u1", tanggal: "2026-11-02", jenis: "masuk", nominal: "750000", kategori: "Sponsor", catatan: "", tetap_id: null, untuk_bulan: null, dibuat_pada: "y" },
  ];

  it("baris → Data: bigint jadi angka, null jadi kosong", () => {
    const d = dariBaris(barisPengaturan, barisTransaksi)!;
    expect(d.pengaturan).toEqual({ uangAwal: 2_500_000, biayaTetap: barisPengaturan.biaya_tetap, sampaiTanggal: null, siap: true });
    expect(d.transaksi[0]).toEqual({ id: "a", tanggal: "2026-11-01", jenis: "keluar", nominal: 1_000_000, kategori: "Biaya tetap", catatan: "Kos", tetapId: "kos", untukBulan: "2026-11" });
    expect(d.transaksi[1]).toEqual({ id: "b", tanggal: "2026-11-02", jenis: "masuk", nominal: 750_000, kategori: "Sponsor", catatan: "" });
  });

  it("akun tanpa baris pengaturan memakai pengaturan kosong", () => {
    expect(dariBaris(null, [])).toEqual(DATA_KOSONG);
  });

  it("Data → baris: kosong jadi null, dan bolak-balik tetap sama", () => {
    const d: Data = dariBaris({ ...barisPengaturan, sampai_tanggal: "2026-12-07" }, barisTransaksi)!;
    expect(keBarisPengaturan(d.pengaturan)).toEqual({ uang_awal: 2_500_000, sampai_tanggal: "2026-12-07", biaya_tetap: barisPengaturan.biaya_tetap, siap: true });
    expect(keBarisTransaksi(d.transaksi[1])).toEqual({ tanggal: "2026-11-02", jenis: "masuk", nominal: 750_000, kategori: "Sponsor", catatan: "", tetap_id: null, untuk_bulan: null });
    const balik = dariBaris(keBarisPengaturan(d.pengaturan), d.transaksi.map((t) => ({ id: t.id, ...keBarisTransaksi(t) })));
    expect(balik).toEqual(d);
  });

  it("bentuk tak terduga ditolak utuh, bukan crash", () => {
    expect(dariBaris(barisPengaturan, "bukan daftar")).toBeNull();
    expect(dariBaris(barisPengaturan, [null])).toBeNull();
    expect(dariBaris({ ...barisPengaturan, uang_awal: "dua juta" }, [])).toBeNull();
    expect(dariBaris(barisPengaturan, [{ ...barisTransaksi[0], nominal: 1.5 }])).toBeNull();
    expect(dariBarisTransaksi(42)).toBeNull();
    expect(dariBarisTransaksi(barisTransaksi[1])?.nominal).toBe(750_000);
  });
});

describe("ambil semua halaman", () => {
  // Pengambil palsu: meniru .range(dari, sampai) dengan batas 1000 baris, opsional galat di halaman tertentu.
  const palsu = (total: number, opsi: { galatDi?: number; count?: boolean } = {}) => {
    const panggilan: [number, number][] = [];
    const ambil = async (dari: number, sampai: number): Promise<Halaman<number>> => {
      panggilan.push([dari, sampai]);
      if (opsi.galatDi === dari) return { data: null, error: { message: "Failed to fetch" } };
      const data = Array.from({ length: Math.max(0, Math.min(sampai, total - 1) - dari + 1) }, (_, i) => dari + i);
      return { data, error: null, count: opsi.count ? total : undefined };
    };
    return { ambil, panggilan };
  };

  it("0 baris", async () => {
    const { ambil, panggilan } = palsu(0);
    expect(await ambilSemua(ambil)).toEqual([]);
    expect(panggilan).toEqual([[0, 999]]);
  });

  it("tepat 1000 baris: meminta halaman berikutnya lalu berhenti", async () => {
    const { ambil, panggilan } = palsu(1000, { count: true });
    const hasil = await ambilSemua(ambil);
    expect(hasil).toHaveLength(1000);
    expect(panggilan).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("2500 baris: tiga halaman, urutan terjaga", async () => {
    const { ambil, panggilan } = palsu(2500, { count: true });
    const hasil = await ambilSemua(ambil);
    expect(hasil).toHaveLength(2500);
    expect(hasil[0]).toBe(0);
    expect(hasil[2499]).toBe(2499);
    expect(panggilan).toHaveLength(3);
  });

  it("galat di tengah: gagal utuh, tidak mengembalikan data separuh", async () => {
    const { ambil } = palsu(2500, { galatDi: 1000 });
    await expect(ambilSemua(ambil)).rejects.toEqual({ message: "Failed to fetch" });
  });

  it("server membatasi di bawah 1000 baris: jumlah tidak cocok dengan count, dianggap gagal", async () => {
    const ambil = async (dari: number): Promise<Halaman<number>> => ({
      data: Array.from({ length: dari === 0 ? 500 : 0 }, (_, i) => i),
      error: null,
      count: 1200,
    });
    await expect(ambilSemua(ambil)).rejects.toThrow("tidak lengkap");
  });
});

describe("terjemahan pesan kesalahan", () => {
  it.each([
    [{ code: "invalid_credentials", message: "Invalid login credentials" }, "Email atau kata sandi salah."],
    [{ message: "Invalid login credentials" }, "Email atau kata sandi salah."],
    [{ code: "user_already_exists", message: "User already registered" }, "Email ini sudah terdaftar. Coba masuk."],
    [{ code: "email_exists" }, "Email ini sudah terdaftar. Coba masuk."],
    [{ code: "weak_password", message: "Password should be at least 8 characters." }, "Kata sandi terlalu lemah. Pakai minimal 8 karakter, campur huruf dan angka."],
    [{ code: "over_request_rate_limit", status: 429 }, "Terlalu sering mencoba. Tunggu sebentar lalu coba lagi."],
    [{ code: "over_email_send_rate_limit" }, "Terlalu sering mencoba. Tunggu sebentar lalu coba lagi."],
    [{ code: "email_not_confirmed", message: "Email not confirmed" }, "Email belum dikonfirmasi. Buka tautan konfirmasi di emailmu, lalu masuk."],
    [{ name: "AuthRetryableFetchError", message: "Failed to fetch" }, "Tidak bisa tersambung. Periksa internet, lalu coba lagi."],
    [new TypeError("Failed to fetch"), "Tidak bisa tersambung. Periksa internet, lalu coba lagi."],
    [{ message: "TypeError: Failed to fetch", code: "" }, "Tidak bisa tersambung. Periksa internet, lalu coba lagi."],
    [{ code: "42501", message: "permission denied" }, "Terjadi kesalahan. Coba lagi."],
    [null, "Terjadi kesalahan. Coba lagi."],
    ["teks aneh", "Terjadi kesalahan. Coba lagi."],
  ])("%j", (galat, harapan) => {
    expect(pesanGalat(galat)).toBe(harapan);
  });
});

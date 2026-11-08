import { describe, expect, it } from "vitest";
import {
  DATA_KOSONG,
  arusBulan,
  hitungBeranda,
  migrasi,
  periksaData,
  periksaTarget,
  rupiah,
  tambahHari,
  uangDiTangan,
  type Data,
  type Pengaturan,
  type Transaksi,
} from "./hitung";

// November 2026 punya 30 hari, jadi tanggal 7 menyisakan 24 hari sampai akhir bulan (hari ini ikut).
const HARI = "2026-11-07";

let n = 0;
const tx = (t: Partial<Transaksi> & Pick<Transaksi, "jenis" | "nominal">): Transaksi => ({
  id: `t${n++}`,
  tanggal: HARI,
  kategori: t.jenis === "masuk" ? "Freelance" : "Makan",
  catatan: "",
  ...t,
});

const data = (p: Partial<Pengaturan>, transaksi: Transaksi[] = []): Data => ({
  versi: 2,
  pengaturan: { ...DATA_KOSONG.pengaturan, siap: true, ...p },
  transaksi,
});

describe("jatah harian", () => {
  it("jatah normal: uang dibagi rata ke sisa hari sampai akhir bulan", () => {
    const h = hitungBeranda(data({ uangAwal: 2_400_000 }), HARI);
    expect(h.tanggalAkhir).toBe("2026-11-30");
    expect(h.sisaHari).toBe(24);
    expect(h.jatah).toBe(100_000);
    expect(h.sisaJatah).toBe(100_000);
    expect(h.status).toBe("Aman");
  });

  it("dibulatkan ke bawah", () => {
    expect(hitungBeranda(data({ uangAwal: 2_400_023 }), HARI).jatah).toBe(100_000);
  });

  it("biaya tetap yang belum dibayar dipisah dari jatah", () => {
    const kos = { id: "kos", nama: "Kos", nominal: 1_200_000, tanggal: 10 };
    const belum = hitungBeranda(data({ uangAwal: 2_400_000, biayaTetap: [kos] }), HARI);
    expect(belum.uangDiTangan).toBe(2_400_000);
    expect(belum.tetapBelumDibayar).toBe(1_200_000);
    expect(belum.jatah).toBe(50_000);

    const sudah = hitungBeranda(
      data({ uangAwal: 2_400_000, biayaTetap: [kos] }, [
        tx({ jenis: "keluar", nominal: 1_200_000, kategori: "Biaya tetap", tetapId: "kos", untukBulan: "2026-11" }),
      ]),
      HARI,
    );
    expect(sudah.tetapBelumDibayar).toBe(0);
    expect(sudah.uangDiTangan).toBe(1_200_000);
    expect(sudah.jatah).toBe(50_000);
    expect(sudah.terpakai).toBe(0);
  });

  it("tagihan bulan ini yang jatuh temponya sudah lewat tetap dicadangkan", () => {
    const kos = { id: "kos", nama: "Kos", nominal: 500_000, tanggal: 1 };
    const h = hitungBeranda(
      data({ uangAwal: 3_000_000, biayaTetap: [kos] }, [
        tx({ jenis: "keluar", nominal: 500_000, tanggal: "2026-10-01", kategori: "Biaya tetap", tetapId: "kos", untukBulan: "2026-10" }),
      ]),
      HARI,
    );
    expect(h.belumDibayar.map((b) => b.jatuhTempo)).toEqual(["2026-11-01"]);
    expect(h.uangBersih).toBe(2_000_000);
  });

  it("status Aman, Hampir habis, dan Lewat jatah; jatah tidak berubah sepanjang hari", () => {
    const pakai = (nominal: number) =>
      hitungBeranda(data({ uangAwal: 2_400_000 }, [tx({ jenis: "keluar", nominal })]), HARI);
    expect(pakai(79_999).status).toBe("Aman");
    expect(pakai(80_000).status).toBe("Hampir habis");
    expect(pakai(100_000).status).toBe("Hampir habis");
    const lewat = pakai(130_000);
    expect(lewat.status).toBe("Lewat jatah");
    expect(lewat.jatah).toBe(100_000);
    expect(lewat.sisaJatah).toBe(-30_000);
  });

  it("hari terakhir bulan: sisaHari = 1, semua uang bersih jadi jatah", () => {
    const h = hitungBeranda(data({ uangAwal: 345_678 }), "2026-11-30");
    expect(h.sisaHari).toBe(1);
    expect(h.jatah).toBe(345_678);
  });

  it("uang tidak cukup: jatah 0, ada pengeluaran berarti Lewat jatah", () => {
    const tetap = [{ id: "kos", nama: "Kos", nominal: 1_000_000, tanggal: 5 }];
    expect(hitungBeranda(data({ uangAwal: 500_000, biayaTetap: tetap }), HARI).jatah).toBe(0);
    const h = hitungBeranda(data({ uangAwal: 500_000, biayaTetap: tetap }, [tx({ jenis: "keluar", nominal: 10_000 })]), HARI);
    expect(h.jatah).toBe(0);
    expect(h.status).toBe("Lewat jatah");
  });

  it("sisa bulan lalu terbawa ke uang di tangan", () => {
    const h = hitungBeranda(
      data({ uangAwal: 1_000_000 }, [
        tx({ jenis: "masuk", nominal: 2_000_000, tanggal: "2026-10-03" }),
        tx({ jenis: "keluar", nominal: 600_000, tanggal: "2026-10-20" }),
      ]),
      HARI,
    );
    expect(h.uangDiTangan).toBe(2_400_000);
    expect(h.jatah).toBe(100_000);
  });

  it("transaksi bertanggal kemarin menurunkan uang bersih, tapi bukan pengeluaran hari ini", () => {
    const h = hitungBeranda(data({ uangAwal: 2_450_000 }, [tx({ jenis: "keluar", nominal: 50_000, tanggal: "2026-11-06" })]), HARI);
    expect(h.uangBersih).toBe(2_400_000);
    expect(h.terpakai).toBe(0);
    expect(h.pengeluaranHariIni).toEqual([]);
    expect(h.jatah).toBe(100_000);
  });
});

describe("tanggal target", () => {
  it("sisaHari menghitung hari ini dan tanggal target", () => {
    const h = hitungBeranda(data({ uangAwal: 700_000, sampaiTanggal: "2026-11-13" }), HARI);
    expect(h.tanggalAkhir).toBe("2026-11-13");
    expect(h.sisaHari).toBe(7);
    expect(h.jatah).toBe(100_000);
    expect(hitungBeranda(data({ uangAwal: 700_000, sampaiTanggal: HARI }), HARI).sisaHari).toBe(1);
  });

  it("melewati pergantian bulan dan tahun", () => {
    expect(hitungBeranda(data({ sampaiTanggal: "2027-01-05" }), "2026-12-30").sisaHari).toBe(7);
  });

  it("target sudah lewat atau kosong jatuh ke akhir bulan", () => {
    const lewat = hitungBeranda(data({ uangAwal: 2_400_000, sampaiTanggal: "2026-11-06" }), HARI);
    expect(lewat.targetLewat).toBe(true);
    expect(lewat.tanggalAkhir).toBe("2026-11-30");
    expect(lewat.sisaHari).toBe(24);
    const kosong = hitungBeranda(data({ uangAwal: 2_400_000 }), HARI);
    expect(kosong.targetLewat).toBe(false);
    expect(kosong.sisaHari).toBe(24);
  });

  it("biaya tetap tanggal 1: tagihan Desember ikut kalau target 7 Desember; bayar Desember lebih awal tidak melunasi November", () => {
    const kos = { id: "kos", nama: "Kos", nominal: 1_000_000, tanggal: 1 };
    const p = { uangAwal: 5_000_000, biayaTetap: [kos], sampaiTanggal: "2026-12-07" };
    const hari = "2026-11-27";
    const belum = hitungBeranda(data(p), hari);
    expect(belum.belumDibayar.map((b) => b.jatuhTempo)).toEqual(["2026-11-01", "2026-12-01"]);
    expect(belum.tetapBelumDibayar).toBe(2_000_000);

    const bayarDes = hitungBeranda(
      data(p, [tx({ jenis: "keluar", nominal: 1_000_000, tanggal: hari, kategori: "Biaya tetap", tetapId: "kos", untukBulan: "2026-12" })]),
      hari,
    );
    expect(bayarDes.belumDibayar.map((b) => b.bulan)).toEqual(["2026-11"]);
    expect(bayarDes.tetapBelumDibayar).toBe(1_000_000);
  });

  it("tagihan setelah tanggal target tidak dicadangkan", () => {
    const kos = { id: "kos", nama: "Kos", nominal: 1_000_000, tanggal: 10 };
    const h = hitungBeranda(data({ biayaTetap: [kos], sampaiTanggal: "2026-12-07" }), "2026-11-27");
    expect(h.belumDibayar.map((b) => b.jatuhTempo)).toEqual(["2026-11-10"]);
  });

  it("periksaTarget: tidak boleh sebelum hari ini dan paling jauh 366 hari", () => {
    expect(periksaTarget(HARI, HARI)).toBeNull();
    expect(periksaTarget(tambahHari(HARI, 366), HARI)).toBeNull();
    expect(periksaTarget(tambahHari(HARI, 367), HARI)).not.toBeNull();
    expect(periksaTarget("2026-11-06", HARI)).not.toBeNull();
    expect(periksaTarget("", HARI)).not.toBeNull();
    expect(periksaTarget("2026-02-30", HARI)).not.toBeNull();
  });
});

describe("migrasi", () => {
  const v1 = {
    pengaturan: {
      uangAwal: 1_000_000,
      biayaTetap: [{ id: "kos", nama: "Kos", nominal: 500_000, tanggal: 5 }],
      persenCadangan: 20,
      targetCadanganBulan: 3,
      cadanganAwal: 300_000,
      kebutuhanSebulan: null,
      siap: true,
    },
    transaksi: [
      { id: "a", tanggal: "2026-10-05", jenis: "keluar", nominal: 500_000, kategori: "Biaya tetap", catatan: "Kos", tetapId: "kos" },
      { id: "b", tanggal: "2026-11-02", jenis: "keluar", nominal: 200_000, kategori: "Dana cadangan", catatan: "", cadangan: "setor" },
      { id: "c", tanggal: "2026-11-03", jenis: "masuk", nominal: 50_000, kategori: "Dana cadangan", catatan: "", cadangan: "tarik" },
      { id: "d", tanggal: "2026-11-04", jenis: "masuk", nominal: 900_000, kategori: "Sponsor", catatan: "" },
    ],
  };
  const sebelum = v1.pengaturan.uangAwal - 500_000 - 200_000 + 50_000 + 900_000;

  it("versi 1 menjadi versi 2 tanpa kehilangan transaksi dan uang di tangan sama", () => {
    for (const lama of [v1, { ...v1, versi: 1 }]) {
      const d = migrasi(JSON.parse(JSON.stringify(lama)))!;
      expect(d.versi).toBe(2);
      expect(d.transaksi).toHaveLength(4);
      expect(d.transaksi.some((t) => "cadangan" in t)).toBe(false);
      expect(d.transaksi[1]).toMatchObject({ jenis: "keluar", kategori: "Dana cadangan", nominal: 200_000 });
      expect(d.transaksi[2]).toMatchObject({ jenis: "masuk", kategori: "Dana cadangan", nominal: 50_000 });
      expect(d.transaksi[0].untukBulan).toBe("2026-10");
      expect(d.transaksi[3].untukBulan).toBeUndefined();
      expect(uangDiTangan(d)).toBe(sebelum);
      expect(d.pengaturan).toEqual({ uangAwal: 1_000_000, biayaTetap: v1.pengaturan.biayaTetap, sampaiTanggal: null, siap: true });
      expect(arusBulan(d, "2026-11")).toEqual({ masuk: 950_000, keluar: 200_000 });
    }
  });

  it("data versi 2 tidak diubah dan data rusak ditolak", () => {
    const d = data({ uangAwal: 100, sampaiTanggal: "2026-12-01" }, [tx({ jenis: "keluar", nominal: 5 })]);
    expect(migrasi(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(migrasi({})).toBeNull();
    expect(migrasi(null)).toBeNull();
    expect(migrasi({ ...v1, versi: 3 })).toBeNull();
  });
});

describe("format dan pemeriksaan", () => {
  it("rupiah tanpa spasi dengan titik ribuan", () => {
    expect(rupiah(1_350_000)).toBe("Rp1.350.000");
    expect(rupiah(0)).toBe("Rp0");
    expect(rupiah(999)).toBe("Rp999");
    expect(rupiah(-25_000)).toBe("-Rp25.000");
  });

  it("periksaData menerima data sah dan menolak yang rusak", () => {
    const sah = data({ uangAwal: 100 }, [tx({ jenis: "keluar", nominal: 5 })]);
    expect(periksaData(JSON.parse(JSON.stringify(sah)))).toEqual(sah);
    expect(periksaData({})).toBeNull();
    expect(periksaData({ ...sah, transaksi: [{ ...sah.transaksi[0], nominal: 1.5 }] })).toBeNull();
    expect(periksaData({ ...sah, pengaturan: { ...sah.pengaturan, sampaiTanggal: "besok" } })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  ANTREAN_KOSONG,
  bacaAntrean,
  bacaCache,
  idBaru,
  jelaskanOp,
  kirimAntrean,
  tambahkanOp,
  terapkanAntrean,
  type Antrean,
  type Hasil,
  type Op,
  type TransaksiBaru,
} from "./antrean";
import { DATA_KOSONG, hitungBeranda, type Data, type Pengaturan } from "./hitung";

const HARI = "2026-11-08";
const tx = (id: string, nominal: number, jenis: "keluar" | "masuk" = "keluar"): TransaksiBaru => ({
  id,
  tanggal: HARI,
  jenis,
  nominal,
  kategori: jenis === "keluar" ? "Makan" : "Freelance",
  catatan: "",
  dibuatPada: `2026-11-08T10:00:0${id.length % 10}.000Z`,
});
const tambah = (id: string, nominal: number, jenis: "keluar" | "masuk" = "keluar"): Extract<Op, { jenis: "tambah" }> => ({
  opId: `op-${id}`,
  jenis: "tambah",
  transaksi: tx(id, nominal, jenis),
});
const hapus = (id: string): Op => ({ opId: `hapus-${id}`, jenis: "hapus", transaksiId: id });
const atur = (uangAwal: number, opId = `atur-${uangAwal}`): Op => ({
  opId,
  jenis: "pengaturan",
  pengaturan: { ...DATA_KOSONG.pengaturan, uangAwal, siap: true },
});

const dasar: Data = {
  versi: 2,
  pengaturan: { ...DATA_KOSONG.pengaturan, uangAwal: 2_300_000, siap: true },
  transaksi: [{ id: "lama", tanggal: "2026-11-01", jenis: "masuk", nominal: 100_000, kategori: "Sponsor", catatan: "" }],
};

describe("terapkanAntrean", () => {
  it("menambah, menghapus, dan mengganti pengaturan sesuai urutan, tanpa mengubah data asli", () => {
    const salinan = JSON.parse(JSON.stringify(dasar));
    const hasil = terapkanAntrean(dasar, [tambah("a", 12_000), tambah("b", 30_000, "masuk"), hapus("lama"), atur(1_000_000)]);
    expect(hasil.transaksi.map((t) => t.id)).toEqual(["a", "b"]);
    expect(hasil.transaksi[0]).not.toHaveProperty("dibuatPada");
    expect(hasil.pengaturan.uangAwal).toBe(1_000_000);
    expect(dasar).toEqual(salinan);
  });

  it("urutan berpengaruh: hapus sebelum tambah tidak menghapus yang ditambah belakangan", () => {
    expect(terapkanAntrean(dasar, [hapus("a"), tambah("a", 5_000)]).transaksi.map((t) => t.id)).toEqual(["lama", "a"]);
    expect(terapkanAntrean(dasar, [tambah("a", 5_000), hapus("a")]).transaksi.map((t) => t.id)).toEqual(["lama"]);
  });

  it("tidak dobel kalau server sudah punya transaksi dengan id yang sama", () => {
    const sudah = { ...dasar, transaksi: [...dasar.transaksi, { ...tx("a", 12_000), dibuatPada: undefined }] };
    expect(terapkanAntrean(sudah, [tambah("a", 12_000)]).transaksi).toHaveLength(2);
  });

  it("antrean kosong mengembalikan data yang sama, dan jatah langsung ikut berubah", () => {
    expect(terapkanAntrean(dasar, [])).toBe(dasar);
    const sebelum = hitungBeranda(dasar, HARI).jatah;
    const sesudah = hitungBeranda(terapkanAntrean(dasar, [tambah("x", 230_000, "masuk")]), HARI);
    expect(sesudah.jatah).toBeGreaterThan(sebelum);
  });
});

describe("pemadatan antrean", () => {
  it("menghapus transaksi yang masih 'tambah' membuang keduanya", () => {
    let a = tambahkanOp(ANTREAN_KOSONG, tambah("a", 1_000));
    a = tambahkanOp(a, tambah("b", 2_000));
    a = tambahkanOp(a, hapus("a"));
    expect(a.ops.map((o) => o.opId)).toEqual(["op-b"]);
  });

  it("hapus transaksi yang sudah di server tetap masuk antrean", () => {
    expect(tambahkanOp(ANTREAN_KOSONG, hapus("lama")).ops).toHaveLength(1);
  });

  it("'tambah' yang sedang dikirim tidak dipadatkan; hapusnya ikut dikirim sesudahnya", () => {
    const a = tambahkanOp(tambahkanOp(ANTREAN_KOSONG, tambah("a", 1_000)), hapus("a"), "op-a");
    expect(a.ops.map((o) => o.jenis)).toEqual(["tambah", "hapus"]);
  });

  it("beberapa perubahan pengaturan jadi satu, yang terakhir", () => {
    let a = tambahkanOp(ANTREAN_KOSONG, atur(1));
    a = tambahkanOp(a, tambah("a", 1_000));
    a = tambahkanOp(a, atur(2));
    a = tambahkanOp(a, atur(3));
    expect(a.ops.map((o) => o.opId)).toEqual(["op-a", "atur-3"]);
  });
});

describe("mengirim antrean", () => {
  // Server palsu: menyimpan transaksi per id (upsert dengan ignoreDuplicates), bisa diatur gagal.
  const server = () => {
    const transaksi = new Map<string, number>();
    let pengaturan: Pengaturan | null = null;
    const kirimKe = async (op: Op): Promise<Hasil> => {
      if (op.jenis === "tambah") {
        if (!transaksi.has(op.transaksi.id)) transaksi.set(op.transaksi.id, op.transaksi.nominal);
      } else if (op.jenis === "hapus") transaksi.delete(op.transaksiId);
      else pengaturan = op.pengaturan;
      return "ok";
    };
    return { transaksi, pengaturan: () => pengaturan, kirimKe };
  };

  const jalankan = (awal: Antrean, kirim: (op: Op) => Promise<Hasil>) => {
    let a = awal;
    const disimpan: number[] = [];
    const hasil = kirimAntrean({
      ambil: () => a,
      simpan: (b) => {
        a = b;
        disimpan.push(b.ops.length);
      },
      kirim,
    });
    return { hasil, antrean: () => a, disimpan };
  };

  const isi = (...ops: Op[]): Antrean => ({ ...ANTREAN_KOSONG, ops });

  it("semua berhasil: antrean kosong, disimpan setelah setiap perubahan", async () => {
    const s = server();
    const j = jalankan(isi(tambah("a", 1), tambah("b", 2), atur(9)), s.kirimKe);
    expect(await j.hasil).toBe("selesai");
    expect(j.antrean().ops).toEqual([]);
    expect(j.disimpan).toEqual([2, 1, 0]);
    expect([...s.transaksi.keys()]).toEqual(["a", "b"]);
    expect(s.pengaturan()?.uangAwal).toBe(9);
  });

  it("jaringan putus di tengah: berhenti, sisa tetap utuh dan urutannya sama", async () => {
    const s = server();
    let n = 0;
    const j = jalankan(isi(tambah("a", 1), tambah("b", 2), tambah("c", 3)), async (op) => (++n === 2 ? "jaringan" : s.kirimKe(op)));
    expect(await j.hasil).toBe("jaringan");
    expect(j.antrean().ops.map((o) => o.opId)).toEqual(["op-b", "op-c"]);
    expect(j.antrean().gagal).toEqual([]);
  });

  it("galat yang dilempar dianggap gangguan jaringan, bukan kesalahan data", async () => {
    const j = jalankan(isi(tambah("a", 1)), async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await j.hasil).toBe("jaringan");
    expect(j.antrean().ops).toHaveLength(1);
  });

  it("server menolak satu perubahan: masuk daftar gagal, yang lain tetap lanjut", async () => {
    const s = server();
    const j = jalankan(isi(tambah("a", 1), tambah("b", 2), tambah("c", 3)), async (op) =>
      op.opId === "op-b" ? { ditolak: "Terjadi kesalahan. Coba lagi." } : s.kirimKe(op),
    );
    expect(await j.hasil).toBe("selesai");
    expect(j.antrean().ops).toEqual([]);
    expect(j.antrean().gagal).toEqual([{ op: tambah("b", 2), pesan: "Terjadi kesalahan. Coba lagi." }]);
    expect([...s.transaksi.keys()]).toEqual(["a", "c"]);
  });

  it("sesi kedaluwarsa: berhenti tanpa membuang apa pun", async () => {
    const awal = isi(tambah("a", 1), atur(5));
    const j = jalankan(awal, async () => "sesi");
    expect(await j.hasil).toBe("sesi");
    expect(j.antrean()).toEqual(awal);
  });

  it("kirim ulang setelah respons hilang: tidak ada duplikat karena id sama", async () => {
    const s = server();
    let pertama = true;
    // Server menerima perubahan, tapi responsnya hilang di jalan (perangkat mengira gagal jaringan).
    const responsHilang = async (op: Op): Promise<Hasil> => {
      await s.kirimKe(op);
      if (pertama) {
        pertama = false;
        return "jaringan";
      }
      return "ok";
    };
    const j = jalankan(isi(tambah("a", 12_000), tambah("b", 5_000)), responsHilang);
    expect(await j.hasil).toBe("jaringan");
    expect(j.antrean().ops).toHaveLength(2);
    const ulang = jalankan(j.antrean(), responsHilang);
    expect(await ulang.hasil).toBe("selesai");
    expect([...s.transaksi.entries()]).toEqual([
      ["a", 12_000],
      ["b", 5_000],
    ]);
  });

  it("perubahan baru yang masuk selama pengiriman ikut terkirim", async () => {
    const s = server();
    let a = isi(tambah("a", 1));
    const hasil = await kirimAntrean({
      ambil: () => a,
      simpan: (b) => (a = b),
      kirim: async (op) => {
        if (op.opId === "op-a") a = tambahkanOp(a, tambah("b", 2), "op-a");
        return s.kirimKe(op);
      },
    });
    expect(hasil).toBe("selesai");
    expect([...s.transaksi.keys()]).toEqual(["a", "b"]);
  });
});

describe("membaca penyimpanan perangkat", () => {
  it("antrean yang sah dibaca utuh", () => {
    const a: Antrean = { versi: 1, ops: [tambah("a", 1), hapus("x"), atur(3)], gagal: [{ op: tambah("z", 9), pesan: "ditolak" }] };
    expect(bacaAntrean(JSON.stringify(a))).toEqual(a);
    expect(bacaAntrean(null)).toEqual(ANTREAN_KOSONG);
  });

  it("antrean rusak tidak membuat crash, hasilnya 'rusak'", () => {
    expect(bacaAntrean("{bukan json")).toBe("rusak");
    expect(bacaAntrean("[]")).toBe("rusak");
    expect(bacaAntrean(JSON.stringify({ versi: 2, ops: [], gagal: [] }))).toBe("rusak");
    expect(bacaAntrean(JSON.stringify({ versi: 1, ops: [{ opId: "x", jenis: "aneh" }], gagal: [] }))).toBe("rusak");
    expect(bacaAntrean(JSON.stringify({ versi: 1, ops: [{ ...tambah("a", 1), transaksi: { ...tx("a", 1), nominal: -5 } }], gagal: [] }))).toBe("rusak");
    expect(bacaAntrean(JSON.stringify({ versi: 1, ops: [], gagal: [{ pesan: "x" }] }))).toBe("rusak");
  });

  it("cache diperiksa dengan periksaData", () => {
    expect(bacaCache(JSON.stringify({ versi: 1, data: dasar, waktu: "x" }))).toEqual(dasar);
    expect(bacaCache(JSON.stringify({ versi: 1, data: { ...dasar, versi: 9 } }))).toBeNull();
    expect(bacaCache("rusak")).toBeNull();
    expect(bacaCache(null)).toBeNull();
  });
});

describe("lain-lain", () => {
  it("idBaru berbentuk uuid v4 dan tidak berulang", () => {
    const a = idBaru();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(idBaru()).not.toBe(a);
  });

  it("jelaskanOp memberi kalimat yang bisa dibaca", () => {
    expect(jelaskanOp({ ...tambah("a", 12_000), transaksi: { ...tx("a", 12_000), tanggal: "2026-11-07" } })).toBe(
      "Pengeluaran Rp12.000, Makan, 7 November",
    );
    expect(jelaskanOp(hapus("a"))).toBe("Hapus satu transaksi");
    expect(jelaskanOp(atur(1))).toBe("Perubahan pengaturan");
  });
});

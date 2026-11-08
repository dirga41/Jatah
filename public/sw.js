// Service worker Jatah, ditulis tangan.
// Hanya menyimpan berkas aplikasi (halaman, JS, CSS, ikon). Tidak pernah menyimpan respons Supabase atau data pengguna:
// permintaan ke domain lain dibiarkan lewat tanpa disentuh, dan data akun disimpan aplikasi sendiri di localStorage.

// shortcut: berkas /_next/static lama menumpuk di cache yang sama antar-deploy; naikkan versi ini kalau cache terlalu besar.
const CACHE = "jatah-v1";
const HALAMAN = ["/", "/catat", "/ringkasan", "/pengaturan", "/masuk", "/atur-ulang-sandi"];
const CADANGAN = "/offline.html";
const BATAS_WAKTU = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.add(CADANGAN);
      const berkas = new Set();
      // Simpan setiap halaman beserta semua berkas /_next/static yang dipakainya, supaya bisa dibuka penuh tanpa internet.
      await Promise.all(
        HALAMAN.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload" });
            if (!res.ok || res.redirected) return;
            const html = await res.clone().text();
            await cache.put(url, res);
            for (const m of html.matchAll(/\/_next\/static\/[^"'\s)<>\\]+/g)) berkas.add(m[0]);
          } catch {}
        }),
      );
      await Promise.all([...berkas].map((u) => cache.add(u).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const nama of await caches.keys()) if (nama !== CACHE) await caches.delete(nama);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Supabase dan domain lain: tidak disentuh sama sekali.
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(cacheDulu(req));
  const halaman = req.mode === "navigate";
  event.respondWith(jaringanDulu(req, halaman));
});

/** Berkas berhash: tidak pernah berubah isinya, jadi cache dulu. */
async function cacheDulu(req) {
  const cache = await caches.open(CACHE);
  const ada = await cache.match(req);
  if (ada) return ada;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

/** Halaman, data halaman (RSC), ikon, manifest: jaringan dulu dengan batas 3 detik, kalau gagal pakai cache. */
async function jaringanDulu(req, halaman) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, tolak) => setTimeout(() => tolak(new Error("waktu habis")), BATAS_WAKTU)),
    ]);
    if (res.ok && res.type === "basic" && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch {
    // Untuk halaman, abaikan query (misalnya /?tercatat=...) supaya tetap ketemu.
    const lama = await cache.match(req, halaman ? { ignoreSearch: true } : undefined);
    if (lama) return lama;
    if (halaman) return (await cache.match(CADANGAN)) || Response.error();
    // Data halaman (RSC) yang belum tersimpan: biarkan gagal; Next.js lalu membuka halamannya secara penuh dari cache.
    return Response.error();
  }
}

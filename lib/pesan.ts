/** Menerjemahkan galat dari Supabase (atau jaringan) ke kalimat bahasa Indonesia sederhana. */
export function pesanGalat(e: unknown): string {
  const g = (typeof e === "object" && e !== null ? e : {}) as { code?: unknown; message?: unknown; status?: unknown; name?: unknown };
  const kode = typeof g.code === "string" ? g.code : "";
  const pesan = typeof g.message === "string" ? g.message.toLowerCase() : "";

  if (kode === "invalid_credentials" || pesan.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (kode === "user_already_exists" || kode === "email_exists" || pesan.includes("already registered"))
    return "Email ini sudah terdaftar. Coba masuk.";
  if (kode === "weak_password" || pesan.includes("password should") || pesan.includes("weak password"))
    return "Kata sandi terlalu lemah. Pakai minimal 8 karakter, campur huruf dan angka.";
  if (kode.startsWith("over_") || g.status === 429 || pesan.includes("rate limit"))
    return "Terlalu sering mencoba. Tunggu sebentar lalu coba lagi.";
  if (kode === "email_not_confirmed" || pesan.includes("email not confirmed"))
    return "Email belum dikonfirmasi. Buka tautan konfirmasi di emailmu, lalu masuk.";
  if (galatJaringan(e)) return "Tidak bisa tersambung. Periksa internet, lalu coba lagi.";
  return "Terjadi kesalahan. Coba lagi.";
}

/** true kalau galat itu karena jaringan (tidak tersambung, waktu habis), bukan karena datanya ditolak. */
export function galatJaringan(e: unknown): boolean {
  const g = (typeof e === "object" && e !== null ? e : {}) as { message?: unknown; name?: unknown };
  const pesan = typeof g.message === "string" ? g.message.toLowerCase() : "";
  return (
    g.name === "AuthRetryableFetchError" ||
    g.name === "AbortError" ||
    g.name === "TimeoutError" ||
    e instanceof TypeError ||
    pesan.includes("failed to fetch") ||
    pesan.includes("network") ||
    pesan.includes("fetch failed") ||
    pesan.includes("load failed") ||
    pesan.includes("aborted")
  );
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Ditulis lengkap supaya Next.js bisa menanamkan nilainya saat build. Hanya kunci publik (sb_publishable_...).
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KUNCI = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Nama variabel lingkungan yang belum diisi. */
export const variabelKurang = [
  !URL && "NEXT_PUBLIC_SUPABASE_URL",
  !KUNCI && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
].filter((x): x is string => Boolean(x));

// Disimpan di globalThis supaya hot reload tidak membuat klien baru berulang kali.
const g = globalThis as { __jatahSupabase?: SupabaseClient };

/** Satu klien Supabase untuk seluruh aplikasi; hanya dibuat di browser dan hanya kalau konfigurasi lengkap. */
export function klien(): SupabaseClient | null {
  if (typeof window === "undefined" || variabelKurang.length) return null;
  return (g.__jatahSupabase ??= createClient(URL!, KUNCI!));
}

-- Skema database Jatah. Jalankan seluruh isi file ini di Supabase > SQL Editor.
-- Aman dijalankan berulang kali: tabel, index, policy, dan fungsi dibuat ulang tanpa menghapus data.

-- ---------- Tabel ----------

create table if not exists public.pengaturan (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  uang_awal bigint not null default 0,
  sampai_tanggal date null,
  biaya_tetap jsonb not null default '[]',
  siap boolean not null default false,
  diubah_pada timestamptz not null default now()
);

create table if not exists public.transaksi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tanggal date not null,
  jenis text not null check (jenis in ('keluar', 'masuk')),
  nominal bigint not null check (nominal > 0),
  kategori text not null,
  catatan text not null default '',
  tetap_id text null,
  untuk_bulan text null check (untuk_bulan is null or untuk_bulan ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  dibuat_pada timestamptz not null default now()
);

create index if not exists transaksi_user_tanggal on public.transaksi (user_id, tanggal);

-- ---------- Hak akses dan Row Level Security ----------
-- Hanya pengguna yang sudah masuk (authenticated) yang boleh menyentuh tabel, dan hanya barisnya sendiri.

revoke all on table public.pengaturan, public.transaksi from anon;
grant select, insert, update, delete on table public.pengaturan, public.transaksi to authenticated;

alter table public.pengaturan enable row level security;
alter table public.transaksi enable row level security;

drop policy if exists "pengaturan: lihat milik sendiri" on public.pengaturan;
drop policy if exists "pengaturan: tambah milik sendiri" on public.pengaturan;
drop policy if exists "pengaturan: ubah milik sendiri" on public.pengaturan;
drop policy if exists "pengaturan: hapus milik sendiri" on public.pengaturan;

create policy "pengaturan: lihat milik sendiri" on public.pengaturan
  for select to authenticated using (user_id = (select auth.uid()));
create policy "pengaturan: tambah milik sendiri" on public.pengaturan
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "pengaturan: ubah milik sendiri" on public.pengaturan
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "pengaturan: hapus milik sendiri" on public.pengaturan
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "transaksi: lihat milik sendiri" on public.transaksi;
drop policy if exists "transaksi: tambah milik sendiri" on public.transaksi;
drop policy if exists "transaksi: ubah milik sendiri" on public.transaksi;
drop policy if exists "transaksi: hapus milik sendiri" on public.transaksi;

create policy "transaksi: lihat milik sendiri" on public.transaksi
  for select to authenticated using (user_id = (select auth.uid()));
create policy "transaksi: tambah milik sendiri" on public.transaksi
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "transaksi: ubah milik sendiri" on public.transaksi
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "transaksi: hapus milik sendiri" on public.transaksi
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- Fungsi ----------

-- Mengganti SEMUA data milik pemanggil dalam satu transaksi database: kalau satu langkah gagal, tidak ada yang berubah.
-- p_pengaturan: {uang_awal, sampai_tanggal, biaya_tetap, siap}
-- p_transaksi: [{tanggal, jenis, nominal, kategori, catatan, tetap_id, untuk_bulan}, ...] dengan urutan dicatat.
create or replace function public.ganti_semua_data(p_pengaturan jsonb, p_transaksi jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Belum masuk';
  end if;

  delete from public.transaksi where user_id = auth.uid();
  delete from public.pengaturan where user_id = auth.uid();

  insert into public.pengaturan (user_id, uang_awal, sampai_tanggal, biaya_tetap, siap)
  values (
    auth.uid(),
    (p_pengaturan ->> 'uang_awal')::bigint,
    (p_pengaturan ->> 'sampai_tanggal')::date,
    coalesce(p_pengaturan -> 'biaya_tetap', '[]'::jsonb),
    coalesce((p_pengaturan ->> 'siap')::boolean, false)
  );

  -- dibuat_pada dinaikkan satu mikrodetik per baris supaya urutan dicatat tetap sama saat diambil lagi.
  insert into public.transaksi (user_id, tanggal, jenis, nominal, kategori, catatan, tetap_id, untuk_bulan, dibuat_pada)
  select
    auth.uid(),
    (x.t ->> 'tanggal')::date,
    x.t ->> 'jenis',
    (x.t ->> 'nominal')::bigint,
    x.t ->> 'kategori',
    coalesce(x.t ->> 'catatan', ''),
    x.t ->> 'tetap_id',
    x.t ->> 'untuk_bulan',
    now() + x.n * interval '1 microsecond'
  from jsonb_array_elements(coalesce(p_transaksi, '[]'::jsonb)) with ordinality as x(t, n);
end;
$$;

-- Menghapus semua data milik pemanggil. Akun login tidak ikut terhapus.
create or replace function public.hapus_semua_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Belum masuk';
  end if;
  delete from public.transaksi where user_id = auth.uid();
  delete from public.pengaturan where user_id = auth.uid();
end;
$$;

revoke execute on function public.ganti_semua_data(jsonb, jsonb) from public, anon;
revoke execute on function public.hapus_semua_data() from public, anon;
grant execute on function public.ganti_semua_data(jsonb, jsonb) to authenticated;
grant execute on function public.hapus_semua_data() to authenticated;

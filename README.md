# Jatah

Jatah adalah pencatat uang pribadi untuk anak muda dengan penghasilan tidak tetap: kreator konten, freelancer, anak kos. Pertanyaan yang dijawab cuma satu: **uangku sebenarnya cukup atau tidak sampai uang berikutnya masuk?** Layar utamanya menunjukkan satu angka, yaitu berapa yang boleh kamu belanjakan hari ini.

Kamu masuk dengan email dan kata sandi. Pengaturan dan transaksimu tersimpan di database Supabase milik akunmu, jadi datanya sama di HP dan laptop, dan tetap aman kalau HP hilang. Pilihan tema terang/gelap tetap disimpan per perangkat.

## Fitur

- **Akun**: daftar dan masuk dengan email dan kata sandi, lupa kata sandi lewat email, dan keluar dari Pengaturan.
- **Beranda**: jatah hari ini beserta statusnya (Aman, Hampir habis, Lewat jatah), sisa uang dan sisa hari, tanggal "uang ini cukup sampai" yang bisa diubah di tempat, daftar pengeluaran hari ini, dan tagihan biaya tetap yang belum dibayar dengan tombol "Sudah dibayar".
- **Catat**: catat pengeluaran (Makan, Transport, Paket data, Belanja, Hiburan, Biaya tetap, Lainnya) atau pemasukan (TikTok LIVE, Sponsor, Freelance, Kiriman orang tua, Lainnya), untuk hari ini atau tanggal sebelumnya. Saat mencatat pemasukan, kamu bisa sekalian mengatur sampai tanggal berapa uang itu harus cukup.
- **Ringkasan**: uang masuk dan keluar per bulan, pengeluaran per kategori, dan riwayat transaksi lengkap dengan tanggal dan tombol hapus. Bisa pindah ke bulan sebelumnya.
- **Pengaturan**: uang yang kamu pegang sekarang, biaya tetap (tambah, ubah, hapus), tampilan (ikuti perangkat, terang, atau gelap; disimpan di perangkat dan tidak ikut ke salinan data), unduh salinan data, pulihkan dari salinan, hapus semua data, dan akun (email yang sedang masuk dan tombol Keluar).
- **Pindah data lama**: kalau perangkat ini masih punya data dari Jatah versi tanpa akun dan akunmu masih kosong, Beranda menawarkan untuk memindahkannya ke akunmu.

### Uang ini cukup sampai tanggal

Jatah harian dihitung dari uangmu dibagi jumlah hari sampai sebuah tanggal target. Kalau belum diatur (atau tanggalnya sudah lewat), Jatah memakai hari terakhir bulan ini.

- Atur lewat tombol **Atur/Ubah** di Beranda, atau lewat kolom "Uang ini harus cukup sampai tanggal berapa?" saat mencatat pemasukan.
- Tanggal target ikut dihitung. Kalau uangmu masuk lagi tanggal 15, pilih tanggal 14.
- Tombol pintas: **7 hari** (hari ini sampai 6 hari ke depan, jadi sisa hari tepat 7), **14 hari**, dan **Akhir bulan**. Paling jauh 366 hari ke depan.
- Tagihan biaya tetap yang jatuh tempo sampai tanggal target (termasuk bulan depan) ikut dipisahkan dari jatah. Kamu bisa membayar tagihan bulan depan lebih awal. Tagihan bulan ini tetap dihitung belum lunas sampai kamu membayarnya juga.

### Catat untuk tanggal sebelumnya

Lupa mencatat? Di halaman Catat, ubah kolom **Tanggal** (atau tekan **Kemarin**). Tanggal di masa depan tidak bisa dipilih. Transaksi itu langsung mengubah sisa uang dan jatah hari ini, muncul di Ringkasan > Riwayat, dan Beranda menampilkan konfirmasi "Tercatat untuk ...". Transaksi itu tidak muncul di "Pengeluaran hari ini".

## Langkah pengaturan (sekali saja)

Jatah butuh satu proyek Supabase (gratis) sebagai tempat menyimpan akun dan data. Ikuti langkah ini berurutan.

### a. Buat proyek Supabase

1. Buka https://supabase.com, klik **Start your project**, lalu masuk (bisa pakai akun GitHub).
2. Klik **New project**. Isi nama (misalnya `jatah`), buat kata sandi database (simpan baik-baik, tapi aplikasi tidak memakainya), pilih region terdekat (misalnya Singapore), lalu klik **Create new project**. Tunggu sampai selesai.

### b. Buat tabel dan aturan keamanan

1. Di menu kiri Supabase, buka **SQL Editor**.
2. Buka file `supabase/schema.sql` dari proyek ini, salin seluruh isinya, tempel di SQL Editor, lalu klik **Run**.
3. Harus muncul "Success". File ini aman dijalankan ulang kapan saja (misalnya setelah ada perubahan) tanpa menghapus data.

File itu membuat tabel `pengaturan` dan `transaksi`, menyalakan Row Level Security (aturan supaya tiap orang hanya bisa melihat dan mengubah datanya sendiri), dan membuat dua fungsi untuk memulihkan salinan dan menghapus semua data.

### c. Alamat situs untuk email

Buka **Authentication > URL Configuration**:

- **Site URL**: isi alamat Vercel-mu, misalnya `https://jatah-xxxx.vercel.app`. (Kalau belum deploy, isi dulu `http://localhost:3000`, lalu ganti setelah deploy.)
- **Redirect URLs**: klik **Add URL** dan tambahkan dua alamat ini:
  - `https://jatah-xxxx.vercel.app/**` (ganti dengan alamat Vercel-mu)
  - `http://localhost:3000/**`

Alamat ini dipakai oleh tautan di email konfirmasi dan email lupa kata sandi.

### d. Pengaturan email dan pendaftaran

Buka **Authentication > Sign In / Providers > Email**.

- **Confirm email**: kalau menyala, setiap akun baru harus membuka tautan di email sebelum bisa masuk. Email bawaan Supabase hanya bisa mengirim **2 email per jam** untuk seluruh proyek. Untuk pemakaian pribadi, sebaiknya **matikan "Confirm email"** supaya akun langsung aktif setelah daftar. Klik **Save**.
- **Lupa kata sandi** juga memakai email bawaan yang sama, jadi ikut terbatas 2 email per jam. Kalau sudah lewat batas, tunggu satu jam lalu coba lagi.
- **Mematikan pendaftaran baru**: setelah akunmu sendiri dibuat lewat halaman Daftar di Jatah, buka **Authentication > Sign In / Providers**, matikan **Allow new users to sign up**, lalu **Save**. Setelah itu orang lain tidak bisa membuat akun di situsmu. Kamu tetap bisa masuk seperti biasa.

### e. Salin alamat dan kunci publik

Buka **Project Settings > API Keys** (dan **Project Settings > Data API** untuk alamatnya):

- **Project URL**: alamat seperti `https://abcdefgh.supabase.co`.
- **Publishable key**: kunci yang diawali `sb_publishable_...`.

Kunci publik ini aman ada di browser karena data dilindungi oleh Row Level Security. **Jangan pernah memakai Secret key (`sb_secret_...`) atau `service_role` di aplikasi ini**, di `.env.local`, maupun di Vercel.

### f. Menjalankan di komputer

Butuh Node.js versi 20 atau lebih baru.

1. Salin file `.env.example` menjadi `.env.local` (di folder yang sama).
2. Buka `.env.local` dan isi dua nilainya:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. Jalankan:

   ```bash
   npm install
   npm run dev
   ```

4. Buka http://localhost:3000. Kamu akan diarahkan ke halaman masuk. Pilih **Daftar**, buat akun, lalu isi pengaturan awal.

Kalau muncul "Konfigurasi belum lengkap", berarti salah satu nilai di `.env.local` masih kosong. Isi, lalu matikan dan jalankan ulang `npm run dev`.

`.env.local` (dan file `.env` lain) tidak ikut ke GitHub karena sudah tercantum di `.gitignore`.

### g. Di Vercel

1. Buka proyek Jatah di Vercel, lalu **Settings > Environment Variables**.
2. Tambahkan dua variabel yang sama persis dengan `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, beserta nilainya.
3. Buka tab **Deployments**, klik titik tiga pada deployment terbaru, lalu pilih **Redeploy**. Ini wajib: nilai berawalan `NEXT_PUBLIC_` dibaca saat build, jadi deployment lama tidak akan tahu nilainya.

### h. Cek keamanan (sekali, setelah semuanya jalan)

1. Daftar dengan akun A, catat beberapa transaksi, lalu keluar.
2. Daftar dengan akun B (email lain). Pastikan Beranda dan Ringkasan akun B kosong, tanpa satu pun transaksi akun A.
3. Masuk lagi dengan akun A. Pastikan datanya masih lengkap.

Kalau akun B bisa melihat data akun A, jalankan ulang `supabase/schema.sql` (langkah b) dan cek lagi.

(Kalau pendaftaran baru sudah dimatikan di langkah d, nyalakan sebentar untuk pengecekan ini, lalu matikan lagi.)

## Perintah lain

- `npm run build`: membuat versi produksi.
- `npm start`: menjalankan versi produksi hasil build.
- `npm run lint`: memeriksa kode dengan ESLint.

## Menjalankan tes

```bash
npm test
```

Tes tidak butuh Supabase sungguhan.

- `lib/hitung.test.ts` memeriksa aturan hitung: jatah normal, biaya tetap, ketiga status, hari terakhir bulan, uang tidak cukup, tanggal target, pembayaran tagihan bulan depan lebih awal, transaksi bertanggal kemarin, dan migrasi data lama.
- `lib/basisdata.test.ts` memeriksa:
  - pemetaan kolom database ↔ aplikasi;
  - pengambilan transaksi halaman demi halaman (0, tepat 1000, dan 2500 baris, galat di tengah, serta server yang membatasi di bawah 1000 baris);
  - terjemahan pesan kesalahan.
- `lib/antrean.test.ts` memeriksa daftar tunggu perubahan untuk pemakaian offline:
  - menerapkan perubahan ke data tanpa mengubah data aslinya;
  - pemadatan antrean;
  - pengiriman dengan server palsu: semua berhasil, jaringan putus di tengah, server menolak satu perubahan, sesi kedaluwarsa, dan kirim ulang setelah respons hilang tanpa duplikat;
  - membaca antrean yang rusak.

## Mengunggah ke GitHub

Proyek ini belum berupa repository git. Langkahnya dari awal:

1. Pastikan aplikasinya beres. Di terminal, di dalam folder `jatah`, jalankan `npm run build` dan `npm test`. Keduanya harus selesai tanpa error. Lalu jalankan `npm run dev`, buka http://localhost:3000, dan cek sendiri aplikasinya.
2. Buat repository git:

   ```bash
   git init
   git add .
   git status
   ```

   Periksa hasil `git status`: **`.env.local` tidak boleh ada di daftar**. File `.gitignore` sudah mengecualikan semua file `.env` (seperti `.env` dan `.env.local`; hanya `.env.example` yang kosong yang ikut), `node_modules`, dan `.next`. Kalau `.env` atau `.env.local` tetap muncul, jangan lanjut. Pastikan `.gitignore` masih memuat baris `.env*` dan `!.env.example`.
3. Buat commit pertama:

   ```bash
   git commit -m "Versi pertama Jatah"
   ```

4. Masuk ke https://github.com, klik tombol **+** di kanan atas, pilih **New repository**. Isi **Repository name** (misalnya `jatah`), pilih Public atau Private, dan **jangan** centang "Add a README file", ".gitignore", atau "license" supaya repository-nya kosong. Klik **Create repository**.
5. Salin alamat repository dari halaman berikutnya, misalnya `https://github.com/NAMAKAMU/jatah.git`, lalu jalankan:

   ```bash
   git remote add origin https://github.com/NAMAKAMU/jatah.git
   git branch -M main
   git push -u origin main
   ```

6. Muat ulang halaman repository di GitHub. Semua file sudah ada di sana.

Untuk perubahan berikutnya: jalankan lagi `npm run build` dan `npm test`, cek aplikasinya, jalankan `git status` (pastikan `.env.local` tidak ikut), lalu `git add .`, `git commit -m "pesan perubahan"`, dan `git push`.

## Deploy ke Vercel

1. Masuk ke https://vercel.com (bisa pakai akun GitHub).
2. Klik **Add New...**, lalu **Project**.
3. Di bagian **Import Git Repository**, pilih repository `jatah`, lalu klik **Import**. Kalau belum muncul, klik "Adjust GitHub App Permissions" dan beri akses ke repository itu.
4. **Framework Preset** otomatis terdeteksi sebagai **Next.js**. Tidak perlu mengubah Build Command atau Output Directory.
5. Buka **Environment Variables** dan tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (lihat langkah g di atas).
6. Klik **Deploy**. Setelah selesai, Vercel memberi alamat seperti `jatah-xxxx.vercel.app`. Masukkan alamat ini ke Supabase (langkah c).

Setelah proyek tersambung, setiap `git push` ke GitHub membuat Vercel otomatis membangun dan men-deploy ulang versi terbaru. Kalau kamu mengubah Environment Variables, lakukan **Redeploy** sekali.

## Memakai tanpa internet

Jatah tetap bisa dibuka dan dipakai saat HP tidak tersambung internet.

### Cara kerjanya

- **Data di HP.** Setiap kali berhasil mengambil data dari server, Jatah menyimpan salinannya di HP (per akun). Saat aplikasi dibuka, salinan itu langsung tampil, lalu diperbarui diam-diam dari server kalau ada internet.
- **Daftar tunggu.** Semua perubahan (catat, hapus, tandai biaya tetap dibayar, ubah pengaturan) disimpan dulu di daftar tunggu di HP. Tampilan, termasuk jatah harian, langsung berubah tanpa menunggu server. Lalu daftar tunggu dikirim ke server satu per satu.
- **Dikirim otomatis.** Saat internet kembali, Jatah mengirim daftar tunggu dengan sendirinya: saat aplikasi dibuka, saat HP tersambung lagi, saat kamu kembali ke aplikasi, dan berkala selama masih ada yang menunggu.
- **Tidak terkirim dua kali.** Setiap transaksi diberi nomor unik di HP, jadi kalau terkirim ulang (misalnya internet putus tepat saat mengirim), server mengenalinya dan tidak mencatatnya dua kali.
- **Baris status** di atas halaman memberi tahu kalau kamu sedang offline, sedang mengirim, ada perubahan yang ditolak server ("Lihat" untuk mencoba lagi atau membuangnya), atau perlu masuk lagi. Di Ringkasan, transaksi yang belum terkirim diberi label "Belum terkirim".
- **Berkas aplikasi** (halaman, tampilan, ikon) disimpan oleh service worker supaya aplikasinya bisa dibuka tanpa internet. Data keuanganmu tidak pernah disimpan di situ.

### Yang bisa dan tidak bisa saat offline

| Bisa saat offline | Butuh internet |
| --- | --- |
| Melihat semua halaman | Masuk dan daftar |
| Catat dan hapus transaksi | Lupa kata sandi dan atur ulang kata sandi |
| Tandai biaya tetap sudah dibayar | Pindahkan data lama |
| Ubah pengaturan (uang dipegang, biaya tetap, tanggal target) | Pulihkan dari salinan |
| Unduh salinan data (dari data di HP) | Hapus semua data |

Masuk pertama kali di sebuah HP selalu butuh internet. Setelah itu, walau sesi login sudah lama dan HP sedang offline, Jatah tetap terbuka memakai data di HP, lalu memperbarui sesinya saat online lagi.

**Setelah setiap pembaruan aplikasi** (setiap deploy baru), buka Jatah sekali dengan internet supaya versi barunya tersimpan untuk dipakai offline.

### Memasang di layar utama HP

- **Android (Chrome):** buka situs Jatah, ketuk menu browser (titik tiga), lalu **Pasang aplikasi** (atau **Tambahkan ke layar utama**).
- **iPhone (Safari):** buka situs Jatah, ketuk **Bagikan**, lalu **Tambah ke Layar Utama**.

### Mencoba mode offline di komputer

Service worker hanya aktif di versi produksi (tidak di `npm run dev`).

```bash
npm run build
npm start
```

1. Buka http://localhost:3000, masuk, lalu buka Beranda, Catat, Ringkasan, dan Pengaturan sekali.
2. Buka DevTools (F12) > tab **Network**, lalu ubah **No throttling** menjadi **Offline**.
3. Muat ulang halaman. Jatah tetap terbuka dengan datamu dan menampilkan "Kamu sedang offline".
4. Catat beberapa transaksi. Jatah hari ini langsung berubah, dan di Ringkasan transaksinya berlabel "Belum terkirim".
5. Kembalikan ke **No throttling**. Baris status menampilkan "Mengirim N perubahan..." lalu hilang.
6. Buka Jatah di perangkat atau browser lain dengan akun yang sama. Datanya sama.

### Batasan mode offline

- Perubahan yang belum terkirim hanya ada di HP itu. Kalau data browser dibersihkan (atau kamu menekan Keluar) sebelum perubahan terkirim, perubahan itu hilang. Jatah meminta konfirmasi sebelum Keluar kalau masih ada yang belum terkirim.
- Kalau dua perangkat mengubah pengaturan saat sama-sama offline, yang terakhir terkirim yang dipakai.
- Tagihan biaya tetap yang ditandai "Sudah dibayar" dari dua perangkat sekaligus saat offline bisa tercatat dua kali. Hapus salah satunya di Ringkasan.
- Kalau penyimpanan HP tidak bisa dipakai (misalnya mode privat atau penuh), Jatah memberi tahu dan hanya bisa dipakai saat online.
- Saat baru dibuka tanpa internet, baris status bisa butuh beberapa detik sebelum menulis "Kamu sedang offline" karena supabase-js mencoba menyambung dulu. Data tetap langsung tampil.

## Data lama dari versi tanpa akun

Versi sebelumnya menyimpan data di browser (localStorage). Setelah masuk, kalau akunmu masih kosong dan perangkat itu masih punya data lama, Beranda menampilkan "Ada data lama di perangkat ini. Pindahkan ke akunmu?":

- **Pindahkan** menyalin semua pengaturan dan transaksi ke akunmu dalam satu langkah (berhasil semua atau tidak sama sekali). Data lama di perangkat **tidak dihapus**, jadi tetap bisa jadi cadangan. Perangkat itu hanya diberi tanda supaya tawaran ini tidak muncul lagi.
- **Nanti saja** menyembunyikan tawaran sampai browser ditutup.
- Kalau akunmu sudah punya data, tawaran ini tidak muncul supaya datamu tidak tertimpa.

Data versi lama (termasuk transaksi dari fitur yang sudah dihapus) diubah otomatis ke bentuk terbaru tanpa membuang transaksi apa pun, jadi sisa uangmu tetap sama. File salinan dari versi lama juga diubah dengan cara yang sama saat dipulihkan lewat "Pulihkan dari salinan".

## Batasan

- Data tersimpan di akunmu (database Supabase). Salinannya disimpan di HP supaya bisa dipakai tanpa internet (lihat "Memakai tanpa internet").
- "Unduh salinan data" tetap dianjurkan secara rutin sebagai cadangan pribadi, terutama sebelum memulihkan salinan atau menghapus semua data.
- "Keluar" hanya mengeluarkan perangkat yang sedang dipakai, dan menghapus salinan data serta daftar tunggu akun itu dari perangkat tersebut.
- Email bawaan Supabase dibatasi 2 email per jam (konfirmasi dan lupa kata sandi).
- Transaksi belum bisa diubah. Hapus lalu catat ulang.
- Hapus akun belum tersedia di aplikasi. Bisa dilakukan oleh pemilik proyek di Supabase > Authentication > Users; semua datanya ikut terhapus.

## Keputusan yang diambil sendiri

Hal-hal yang tidak diatur jelas di permintaan, dan pilihan yang dipakai:

- **Rumus jatah** = max(0, (uang bersih + pengeluaran biasa hari ini) / sisa hari), dibulatkan ke bawah. Pengeluaran biasa = pengeluaran tanpa tautan biaya tetap. Pengeluaran berkategori "Biaya tetap" yang dicatat manual lewat Catat dihitung sebagai pengeluaran biasa.
- **Tagihan biaya tetap** dihitung mulai bulan ini. Tagihan bulan-bulan sebelumnya yang tidak pernah ditandai dibayar tidak ikut dipisahkan.
- **Tombol "Sudah dibayar"** mencatat pembayaran bertanggal hari ini, dengan `untukBulan` = bulan tagihannya.
- **Status saat jatah Rp0 dan belum ada pengeluaran** ditulis "Hampir habis". Kalau ada pengeluaran, "Lewat jatah".
- **Angka besar saat lewat jatah** menunjukkan selisih lewatnya. Kalimat di bawahnya, "Melebihi jatah RpX.", menyebut jatah hari itu.
- **Target yang sudah lewat**: kalimatnya ditambah "Sementara dihitung sampai akhir bulan (tanggal)."
- **Konfirmasi "Tercatat untuk ..."** di Beranda dibawa lewat alamat halaman (`/?tercatat=YYYY-MM-DD`). Kalau halaman itu dimuat ulang, kalimatnya tetap tampil.
- **Kolom target di Catat** terisi tanggal target yang masih berlaku. Kalau diisi, target disimpan dulu, baru transaksinya. Kalau penyimpanan transaksi gagal, target baru tetap tersimpan, dan mencoba lagi tidak membuat transaksi tercatat dua kali.
- **Urutan transaksi** diambil berdasarkan tanggal, waktu dicatat, lalu id, supaya urutan antarhalaman stabil. Saat memulihkan salinan, waktu dicatat dibuat berurutan (selisih satu mikrodetik) supaya urutan aslinya terjaga.
- **Pengambilan memakai `count`**: kalau jumlah baris yang diterima tidak sama dengan jumlah di server (misalnya batas baris server diatur di bawah 1000), pengambilan dianggap gagal, bukan dipakai separuh.
- **Kembali ke tab**: Jatah mengambil ulang data diam-diam. Kalau pengambilan ulang itu gagal, data yang sedang tampil dibiarkan (tidak diganti layar gagal).
- **Data lama di perangkat** dibaca dari kunci localStorage `jatah:v1` (isinya data versi 2; nama kuncinya tidak pernah berubah). Penanda sudah dipindah disimpan di `jatah:dipindah`, dan "Nanti saja" di sessionStorage.
- **id transaksi** dibuat oleh database (uuid). Salinan lama dengan id bentuk lain tetap bisa dipulihkan karena id-nya dibuat ulang.
- **Lupa kata sandi** memakai email yang diisi di kolom Email. Pesan berhasilnya tidak memberi tahu apakah email itu terdaftar.
- **Daftar dengan email yang sudah terdaftar** saat "Confirm email" menyala: Supabase tidak memberi galat, tapi Jatah mengenalinya dari akun tanpa identitas dan menampilkan "Email ini sudah terdaftar. Coba masuk."
- **Keluar** memakai `scope: "local"`: hanya perangkat ini yang keluar, dan tetap berhasil walau sedang tanpa internet.
- **Tombol masuk/daftar** menulis "Memproses..." saat menunggu; tombol penyimpanan data menulis "Menyimpan...".
- Konfirmasi hapus dan pulihkan memakai dialog konfirmasi bawaan browser (`confirm`). Pesan kesalahan formulir selalu tampil di dekat kolomnya.
- **Semua penulisan lewat daftar tunggu**, online maupun offline. Saat online, daftar tunggu langsung dikirim, jadi rasanya sama seperti sebelumnya.
- **Perubahan yang ditolak server** tidak ikut ditampilkan (tidak dianggap terjadi) sampai kamu menekan "Coba lagi".
- **Cache data di HP** juga diperbarui walau daftar tunggu belum kosong. Ini aman karena daftar tunggu tetap diterapkan di atasnya, dan transaksi yang id-nya sudah ada di server tidak didobel.
- **Perubahan yang sudah diterima server** langsung dimasukkan ke salinan di HP sebelum dibuang dari daftar tunggu, supaya tampilan tidak loncat dan salinan di HP tetap lengkap walau internet putus sebelum data diambil ulang.
- **Saat dibuka**, data pengguna terakhir di HP langsung ditampilkan tanpa menunggu supabase-js. Saat offline dengan token kedaluwarsa, supabase-js baru memberi kepastian setelah mencoba sampai ~30 detik. Kalau ternyata sesinya ditolak server, kamu tetap diarahkan ke halaman masuk; daftar tunggu tetap disimpan di HP dan dikirim setelah masuk lagi dengan akun yang sama.
- **"Masuk lagi untuk mengirim"**: halaman masuk boleh dibuka walau masih masuk, supaya bisa masuk ulang tanpa kehilangan daftar tunggu.
- **Status offline** ditentukan oleh kegagalan sungguhan saat menghubungi server ditambah `navigator.onLine`. Tombol yang butuh internet memakai status yang sama.
- **Unduh salinan data** memakai data di HP (salinan dari server + perubahan yang belum terkirim), jadi tetap bisa offline.
- **Pulihkan dan hapus semua data** mengirim daftar tunggu dulu. Kalau masih ada yang belum terkirim, keduanya menolak, supaya perubahan lama tidak menimpa hasilnya.
- **Pengiriman** memakai batas waktu 15 detik per perubahan. Jeda coba lagi berkala mulai 30 detik dan berlipat sampai 5 menit.
- **Service worker** menyimpan setiap halaman beserta semua berkas `/_next/static` yang disebut di HTML-nya saat dipasang, jadi halaman bisa dibuka penuh tanpa internet walau belum pernah dibuka. Font dan berkas yang baru dimuat belakangan ikut tersimpan saat pertama kali dipakai. Data halaman (RSC) yang belum tersimpan dibiarkan gagal, sehingga Next.js membuka halaman secara penuh dari cache.
- **Ikon** dibuat sebagai PNG statis (192, 512, dan 180 untuk iPhone) dari bentuk geometris huruf J, tanpa font, di `public/`.

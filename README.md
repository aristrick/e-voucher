# Tiket Gathering (Next.js + Supabase + Vercel)

Fitur: halaman pesan tiket dan e-tiket QR di HP peserta, check-in, redeem kupon (popup hasil scan), undian spin wheel, dashboard admin.

## Halaman
- `/` peserta: halaman depan acara + alur klaim tiket (Cek NIK, Verifikasi, Tiket terbit). Setelah masuk tampil e-tiket, status tiket, dan kupon.
- `/login` login panitia dan admin.
- `/staff` panitia: mode Check-in (pintu) dan Redeem (booth), nama booth, riwayat scan.
- `/admin` ringkasan. Sub-halaman: `/admin/peserta` (cari, filter, tambah/ubah peserta, check-in manual, import dan ekspor Excel), `/admin/panitia`, `/admin/kupon`, `/admin/hadiah`, `/admin/pemenang`, `/admin/history` (riwayat semua aktivitas), `/admin/pengaturan` (nama, tanggal, lokasi acara).
- `/stage` admin: layar undian spin wheel (Spasi untuk memutar).
- `/api/health` cek apakah variabel environment terisi (tidak menampilkan nilainya).

## Login
- Admin: username `admin`, password = nilai `ADMIN_PIN`.
- Panitia: akun dibuat admin di `/admin` bagian Panitia (disimpan di tabel `staff`). `STAFF_PIN` tidak dipakai.

## 1. Supabase
1. Buat project di supabase.com (pilih region Singapore).
2. SQL Editor, jalankan berurutan: `supabase/schema.sql`, `supabase/migration-login.sql`, `supabase/grants.sql`, `supabase/migration-v2.sql`, `supabase/migration-v3.sql`, `supabase/migration-v4.sql`, `supabase/migration-v6.sql`.
   Jika database sudah berjalan dari versi lama, jalankan `migration-v2.sql` lalu `migration-v3.sql` (v3 wajib untuk jatah hadiah per karyawan). Tanpa file ini, dashboard dan undian tidak jalan.
3. Project Settings > API Keys: salin Project URL dan secret/service_role key. RAHASIA, jangan di-commit.

## 2. Jalankan di komputer
```
npm install
```
Buat file `.env` (bukan `.env.example`) berisi:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PIN=...        (pilih yang kuat)
SESSION_SECRET=...   (teks acak minimal 32 karakter)
```
Lalu `npm run dev` dan buka http://localhost:3000. Untuk uji performa pakai `npm run build` lalu `npm start`.

## 3. Deploy ke Vercel
1. Push ke GitHub (branch `main`). `.env` tidak ikut karena ada di `.gitignore`.
2. Vercel > Add New > Project > pilih repo.
3. Environment Variables (Production): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PIN`, `SESSION_SECRET`. Ketik nilainya ulang saat mengedit, lalu Redeploy.
4. Settings > Functions > Region: Singapore (sin1).
5. Kamera scan hanya jalan di HTTPS (domain vercel.app sudah HTTPS).

## Persiapan acara
1. `/admin/pengaturan`: isi nama, tanggal, dan lokasi acara.
2. `/admin/peserta`: Tambah peserta satu per satu lewat tombol Tambah peserta, atau Import Excel (.xlsx, kolom NIK, Nama, Divisi, Cabang; template bisa diunduh di jendela import). Nomor HP tidak diimpor: peserta mengisinya sendiri saat membuat password.
3. Atur `/admin/kupon`, `/admin/hadiah`, dan buat akun di `/admin/panitia`.
4. Uji: dua HP scan QR yang sama, hanya satu yang boleh berhasil.

## Catatan keamanan
- Jangan salin isi `.env` ke `.env.example`. File itu ter-commit ke GitHub, isinya harus kosong.
- Jika secret pernah terpublikasi, ganti key Supabase, `SESSION_SECRET`, dan PIN.

## Undian
Pemenang dipilih acak oleh server (hanya peserta yang sudah check-in dan belum pernah menang), lalu roda diputar sampai berhenti di nama pemenang itu. Segmen roda berisi pemenang ditambah hingga 17 nama peserta lain sebagai pengisi, karena ratusan nama tidak muat dalam satu roda. Tombol "Tidak hadir, undi ulang" mengembalikan stok hadiah dan langsung memutar lagi.

## Keamanan login
- 5 kali salah password/aktivasi mengunci akun peserta atau panitia 10 menit. Admin direm per alamat IP.
- Panitia yang dinonaktifkan langsung tidak bisa scan.

## Update dari versi lama
1. Salin SEMUA isi folder `app/` dan `lib/` dari versi ini (timpa), lalu hapus `app/globals.css` lama. Stylesheet sekarang bernama `app/theme.css`.
2. Jalankan `supabase/migration-v2.sql` di SQL Editor Supabase.
3. Hentikan `npm run dev`, hapus folder `.next`, lalu jalankan lagi.

## Check-in, kupon, dan login peserta
- Mengaktifkan tiket (cek NIK, isi nomor HP, buat password) belum dihitung hadir. Check-in hanya tercatat saat panitia/admin memindai QR atau mengetik NIK/kode di `/staff`, atau admin menekan Check-in di `/admin/peserta`. Tanggal dan jam (WIB) check-in dan tiap penukaran kupon tersimpan dan tampil di admin, e-tiket peserta, dan file Excel.
- Nomor HP diisi peserta saat membuat password dan dipakai lagi saat login (NIK + nomor HP + password). Reset password di admin juga mengosongkan nomor HP, jadi peserta mengisinya ulang.

## Undian: jatah hadiah
- `/admin/pengaturan`: Jatah hadiah per karyawan (bawaan 1). Per orang bisa diubah di `/admin/peserta` > Ubah. Peserta yang jatahnya penuh tidak ikut undian lagi; satu orang tidak bisa menang hadiah yang sama dua kali.
- Di layar undian, hadiah yang habis pindah ke bawah dan berwarna pudar; jika diklik muncul pemberitahuan "Hadiah ... sudah habis".

## History dan suara (v4)
- Jalankan `supabase/migration-v4.sql` sekali di SQL Editor Supabase. Ini membuat tabel `activity_log`. Tanpa tabel ini aplikasi tetap jalan, hanya halaman History yang kosong dan menampilkan petunjuk.
- `/admin/history` mencatat: check-in dan redeem (berhasil maupun gagal, beserta nama panitia), perubahan peserta, panitia, kupon, hadiah, pengaturan, undian, dan tandai tidak hadir. Bisa dicari, difilter per kategori dan hasil, serta diperbarui otomatis tiap 5 detik. Password tidak pernah dicatat.
- Suara dibuat dengan Web Audio (tanpa file audio): denting naik seperti Apple Pay saat scan berhasil, nada rendah saat gagal, desis awal dan bunyi "tak" tiap segmen saat roda berputar, dan fanfare saat pemenang muncul. Tombol Suara hidup/mati ada di `/staff` dan `/stage`. Browser baru memutar suara setelah layar disentuh sekali, jadi ketuk layar panitia satu kali setelah halaman dibuka.

## Perubahan v5
- Pengaturan: kartu Info acara lebih lebar dari Undian.
- Skeleton loading di semua halaman (admin, scan, undian, halaman depan) dan garis kemajuan saat filter/halaman diganti.
- Notifikasi (toast) dan dialog konfirmasi/isian bertema menggantikan popup bawaan browser.
- Peserta > Reset: pilih reset password dan nomor HP, reset satu kupon, atau reset semua kupon. Tercatat di History.
- Login peserta setelah aktivasi: cukup 4 angka terakhir nomor HP (nomor lengkap tetap diterima).
- Tombol Klaim tiket saya dihapus dari halaman depan.
- Menu History dipindah ke bawah, sebelum Pengaturan.
- Scan lebih cepat: popup tidak lagi mengunci kamera, pembaca QR bawaan perangkat dipakai jika ada, jalur database dipangkas (check-in 1 query, redeem 2 query), dan pencatatan History berjalan setelah respons dikirim. Tidak ada migrasi baru.

## Perubahan v6
- WAJIB: jalankan `supabase/migration-v6.sql` sekali di SQL Editor Supabase sebelum memakai versi ini. Isinya menambah kolom `divisi` pada tabel peserta. Tanpa ini check-in dan halaman peserta error.
- Peserta punya Divisi selain Cabang: form tambah/ubah, tabel peserta, pencarian, import dan ekspor Excel (kolom Divisi; judul "Devisi" juga dikenali), e-tiket, popup scan, layar undian, dan halaman Pemenang. File Excel lama tanpa kolom Divisi tetap bisa diimpor, tetapi mengosongkan Divisi peserta dengan NIK yang sama.
- Peserta > Reset > Undian: hapus satu catatan undian atau semua catatan undian peserta. Stok hadiah kembali dan peserta (termasuk yang pernah ditandai tidak hadir) bisa diundi lagi. Tercatat di History.
- Kamera scan: fokus otomatis terus-menerus, resolusi 720p, dan area baca lebih luas (90% layar kamera).
- Tanda "Setia Kawan Project by Aris Setiawan" di paling bawah semua halaman.

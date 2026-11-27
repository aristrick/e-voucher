-- Jalankan sekali di Supabase SQL Editor (setelah migration-v12.sql)
-- Pengembalian kunci kamar: panitia memindai QR (atau mengetik NIK) penghuni di mode KUNCI > Kembalikan kunci,
-- atau admin mengonfirmasinya manual di halaman Kamar. Waktu, nama booth, dan nama pengembali dicatat.

alter table rooms add column if not exists key_returned_at timestamptz;   -- kapan kunci dikembalikan (kosong = belum dikembalikan)
alter table rooms add column if not exists key_returned_by text;          -- booth yang menerima, atau "admin" kalau dikonfirmasi manual
alter table rooms add column if not exists key_returned_name text;        -- nama penghuni yang mengembalikan

grant all on all tables in schema public to service_role;
notify pgrst, 'reload schema';

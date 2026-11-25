-- Jalankan sekali di Supabase SQL Editor (setelah migration-v4.sql)
-- Menambah kolom Divisi pada peserta, di samping Cabang.
-- WAJIB dijalankan sebelum memakai versi v6: tanpa kolom ini check-in dan halaman peserta akan error.

alter table employees add column if not exists divisi text;
create index if not exists employees_divisi_idx on employees(divisi);

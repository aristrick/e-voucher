-- Jalankan sekali di Supabase SQL Editor (setelah migration-v9.sql)
-- Penyerahan hadiah: panitia memindai QR pemenang di mode Hadiah, lalu hadiah ditandai sudah diambil.

alter table draws add column if not exists claimed_at timestamptz;   -- kapan hadiah diserahkan (kosong = belum diambil)
alter table draws add column if not exists claimed_by text;          -- nama booth yang menyerahkan (opsional)

grant all on all tables in schema public to service_role;
notify pgrst, 'reload schema';

-- Jalankan sekali di Supabase SQL Editor (setelah migration-v11.sql)
-- Kunci kamar: tiap kamar punya satu pemegang kunci (salah satu penghuninya). Panitia memindai QR pemegang kunci
-- di mode KUNCI untuk menyerahkan kunci; setelah diambil, penghuni lain tidak bisa mengambilnya lagi.

alter table rooms add column if not exists key_holder uuid references employees(id) on delete set null;  -- pemegang kunci (kosong = belum ditentukan)
alter table rooms add column if not exists key_taken_at timestamptz;                                       -- kapan kunci diserahkan (kosong = belum diambil)
alter table rooms add column if not exists key_taken_by text;                                              -- nama booth yang menyerahkan (opsional)

-- kamar yang sudah punya penghuni tapi belum punya pemegang kunci: penghuni pertama (urut nama) dijadikan pemegang kunci.
-- Admin bisa menggantinya kapan saja di halaman Kamar.
update rooms r set key_holder = (select e.id from employees e where e.room_id = r.id order by e.nama, e.nik limit 1)
where r.key_holder is null and exists (select 1 from employees e where e.room_id = r.id);

grant all on all tables in schema public to service_role;
notify pgrst, 'reload schema';

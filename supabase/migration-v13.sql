-- Jalankan sekali di Supabase SQL Editor (setelah migration-v12.sql)
-- Pemegang kunci tidak lagi ditentukan di awal. Siapa pun penghuni yang pertama discan panitia di mode KUNCI
-- otomatis menjadi pemegang kunci kamar itu (key_holder + key_taken_at terisi bersamaan).
-- Pemegang kunci hasil penunjukan otomatis v12 yang belum pernah discan dikosongkan, supaya semua penghuni bisa discan pertama.
-- Kamar yang kuncinya sudah benar-benar diambil (key_taken_at terisi) tidak diubah.

update rooms set key_holder = null, key_taken_by = null where key_taken_at is null and key_holder is not null;

notify pgrst, 'reload schema';

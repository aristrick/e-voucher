-- Jalankan sekali di Supabase SQL Editor (setelah migration-v10.sql)
-- Fitur pembagian kamar: daftar kamar (diatur admin di /admin/kamar) dan kamar tiap peserta.
-- Fitur ini baru tampil di tiket peserta kalau admin mengaktifkannya di halaman Kamar
-- (disimpan di tabel settings, baris room_enabled), jadi aman untuk acara yang tidak menginap.

create table if not exists rooms(
  id serial primary key,
  nomor text not null unique,      -- nomor kamar, contoh: 101 atau A-12
  nama text,                       -- nama kamar, contoh: Melati (boleh kosong)
  kapasitas int,                   -- jumlah penghuni maksimal (kosong = tanpa batas)
  catatan text,                    -- keterangan tambahan, contoh: Lantai 2, Gedung B
  urutan int not null default 0
);
alter table rooms enable row level security;

-- kamar peserta; kalau kamar dihapus, peserta otomatis kembali "belum dapat kamar"
alter table employees add column if not exists room_id int references rooms(id) on delete set null;
create index if not exists employees_room_idx on employees(room_id);

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
notify pgrst, 'reload schema';

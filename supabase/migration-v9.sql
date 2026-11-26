-- Jalankan sekali di Supabase SQL Editor (setelah migration-v6.sql)
-- Fitur survey setelah acara: pertanyaan (bisa diedit admin) dan jawaban peserta.
-- WAJIB dijalankan sebelum memakai versi v9: tanpa tabel ini halaman Survey admin dan peserta menampilkan pesan error.

create table if not exists survey_questions(
  id serial primary key,
  urutan int not null default 0,
  tipe text not null check (tipe in ('skala','teks','pilihan')), -- skala 1-5 | jawaban teks | pilihan ganda
  teks text not null,
  wajib boolean not null default true,
  opsi jsonb not null default '[]',        -- daftar opsi (jenis pilihan)
  lainnya boolean not null default false,  -- jenis pilihan: peserta boleh mengetik jawaban sendiri
  label_min text, label_maks text          -- keterangan ujung skala (jenis skala)
);

-- satu baris per peserta; jawaban disimpan sebagai { "id_pertanyaan": jawaban }
create table if not exists survey_responses(
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references employees(id) on delete cascade,
  jawaban jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table survey_questions enable row level security;
alter table survey_responses enable row level security;

-- pertanyaan awal (mengikuti Google Form Umpan Balik Employee Gathering); hanya diisi jika tabel masih kosong.
-- NIK, nama, dan divisi tidak ditanyakan lagi karena sudah diketahui dari akun peserta.
insert into survey_questions(urutan, tipe, teks, wajib, opsi, lainnya, label_min, label_maks)
select * from (values
  (1, 'skala', 'Seberapa puas Anda dengan acara ini secara keseluruhan?', true, '[]'::jsonb, false, 'Sangat Tidak Puas', 'Sangat Puas'),
  (2, 'skala', 'Seberapa puas Anda dengan rundown acara?', true, '[]'::jsonb, false, 'Sangat Tidak Puas', 'Sangat Puas'),
  (3, 'skala', 'Seberapa puas Anda dengan fasilitas atau tempat acara?', true, '[]'::jsonb, false, 'Sangat Tidak Puas', 'Sangat Puas'),
  (4, 'skala', 'Seberapa puas Anda dengan konsumsi acara?', true, '[]'::jsonb, false, 'Sangat Tidak Puas', 'Sangat Puas'),
  (5, 'teks', 'Apa bagian terbaik dari acara?', true, '[]'::jsonb, false, null, null),
  (6, 'teks', 'Berikan kritik dan saran Anda untuk perbaikan acara selanjutnya', true, '[]'::jsonb, false, null, null),
  (7, 'pilihan', 'Harapan untuk gathering tahun depan?', true, '["Employee Gathering","Family Gathering"]'::jsonb, false, null, null),
  (8, 'pilihan', 'Harapan tempat untuk gathering tahun depan?', true, '["Villa / Resort","Pantai"]'::jsonb, true, null, null)
) as v(urutan, tipe, teks, wajib, opsi, lainnya, label_min, label_maks)
where not exists (select 1 from survey_questions);

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

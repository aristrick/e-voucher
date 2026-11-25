-- Jalankan sekali di Supabase SQL Editor (setelah migration-v3.sql)
-- Riwayat aktivitas: siapa melakukan apa dan kapan (halaman /admin/history)

create table if not exists activity_log(
  id bigserial primary key,
  created_at timestamptz not null default now(),
  actor text,            -- nama admin / panitia
  actor_role text,       -- admin | staff
  kategori text not null, -- checkin | redeem | peserta | panitia | kupon | hadiah | undian | pengaturan
  aksi text not null,
  ringkas text not null, -- kalimat singkat yang tampil di halaman History
  ok boolean not null default true,
  detail jsonb
);
create index if not exists activity_log_time_idx on activity_log(created_at desc);
create index if not exists activity_log_kat_idx on activity_log(kategori, created_at desc);
alter table activity_log enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

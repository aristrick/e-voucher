-- Jalankan sekali di Supabase SQL Editor (setelah schema.sql, migration-login.sql, grants.sql)

-- Pengaturan acara (nama, tanggal, lokasi)
create table if not exists settings(key text primary key, value text);
alter table settings enable row level security;

-- Status kirim WhatsApp disimpan di database (sebelumnya hanya di browser admin)
alter table employees add column if not exists wa_sent_at timestamptz;

-- Pembatas percobaan login (anti tebak password / tebak 4 digit HP)
alter table employees add column if not exists fail_count int default 0;
alter table employees add column if not exists locked_until timestamptz;
alter table staff add column if not exists fail_count int default 0;
alter table staff add column if not exists locked_until timestamptz;

-- Index agar hitung dan filter tetap cepat saat peserta ribuan
create index if not exists employees_checked_idx on employees(checked_in_at);
create index if not exists employees_nama_idx on employees(nama);
create index if not exists redemptions_coupon_idx on redemptions(coupon_type_id);

-- Undian: kunci baris hadiah agar dua undian bersamaan tidak melebihi stok
create or replace function draw_winner(p_prize int)
returns table(w_id uuid, w_nama text, w_nik text, w_cabang text)
language plpgsql as $$
declare w uuid; s int; c int;
begin
  select stok into s from prizes where prizes.id = p_prize for update;
  select count(*) into c from draws where prize_id = p_prize and status <> 'forfeited';
  if s is null or c >= s then raise exception 'Stok hadiah habis'; end if;
  select e.id into w from employees e
    where e.checked_in_at is not null
      and not exists (select 1 from draws d where d.employee_id = e.id)
    order by random() limit 1;
  if w is null then raise exception 'Tidak ada peserta tersisa'; end if;
  insert into draws(prize_id, employee_id) values (p_prize, w);
  return query select e.id, e.nama, e.nik, e.cabang from employees e where e.id = w;
end $$;

-- Nama acak untuk mengisi segmen roda (peserta hadir yang belum menang)
create or replace function wheel_candidates(p_n int)
returns table(c_nama text, c_nik text)
language sql as $$
  select e.nama, e.nik from employees e
  where e.checked_in_at is not null
    and not exists (select 1 from draws d where d.employee_id = e.id)
  order by random() limit p_n
$$;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

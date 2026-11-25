-- Jalankan sekali di Supabase SQL Editor (setelah migration-v2.sql)

-- Jatah hadiah per peserta (kosong = ikut pengaturan umum, bawaan 1)
alter table employees add column if not exists max_hadiah int;

-- Satu peserta boleh punya lebih dari satu undian (sesuai jatah hadiah)
alter table draws drop constraint if exists draws_employee_id_key;
create index if not exists draws_employee_idx on draws(employee_id);

drop function if exists draw_winner(int);
drop function if exists wheel_candidates(int);

-- Jatah hadiah umum dari tabel settings (key max_prizes_per_employee), bawaan 1
create or replace function prize_limit() returns int
language sql stable as $$
  select greatest(coalesce((select nullif(value,'')::int from settings where key = 'max_prizes_per_employee'), 1), 1)
$$;

-- Peserta yang masih boleh ikut undian:
-- sudah check-in, tidak pernah ditandai tidak hadir, jatahnya belum penuh,
-- dan (jika p_prize diisi) belum pernah menang hadiah yang sama
create or replace function eligible_employees(p_prize int default null)
returns setof uuid language sql stable as $$
  select e.id from employees e
  where e.checked_in_at is not null
    and not exists (select 1 from draws d where d.employee_id = e.id and d.status = 'forfeited')
    and (select count(*) from draws d where d.employee_id = e.id and d.status <> 'forfeited') < coalesce(e.max_hadiah, prize_limit())
    and (p_prize is null or not exists (select 1 from draws d where d.employee_id = e.id and d.prize_id = p_prize and d.status <> 'forfeited'))
$$;

create or replace function eligible_count() returns int
language sql stable as $$ select count(*)::int from eligible_employees(null) $$;

create or replace function draw_winner(p_prize int)
returns table(w_id uuid, w_nama text, w_nik text, w_cabang text, w_draw uuid)
language plpgsql as $$
declare w uuid; s int; c int; d uuid;
begin
  perform pg_advisory_xact_lock(7001);  -- satu undian pada satu waktu
  select stok into s from prizes where prizes.id = p_prize for update;
  select count(*) into c from draws where prize_id = p_prize and status <> 'forfeited';
  if s is null or c >= s then raise exception 'Hadiah sudah habis'; end if;
  select x into w from eligible_employees(p_prize) x order by random() limit 1;
  if w is null then raise exception 'Tidak ada peserta tersisa'; end if;
  insert into draws(prize_id, employee_id) values (p_prize, w) returning id into d;
  return query select e.id, e.nama, e.nik, e.cabang, d from employees e where e.id = w;
end $$;

create or replace function wheel_candidates(p_n int, p_prize int default null)
returns table(c_nama text, c_nik text)
language sql stable as $$
  select e.nama, e.nik from employees e
  where e.id in (select eligible_employees(p_prize))
  order by random() limit p_n
$$;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

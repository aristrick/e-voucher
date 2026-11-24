create table employees(
  id uuid primary key default gen_random_uuid(),
  nik text unique not null, nama text not null, cabang text, hp text,
  token text unique not null default encode(gen_random_bytes(6),'hex'),
  checked_in_at timestamptz);
create table coupon_types(id serial primary key, nama text not null, urutan int default 0);
create table redemptions(
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  coupon_type_id int not null references coupon_types(id) on delete cascade,
  booth text, created_at timestamptz default now(),
  unique(employee_id, coupon_type_id));
create table prizes(id serial primary key, nama text not null, stok int default 1);
create table draws(
  id uuid primary key default gen_random_uuid(),
  prize_id int not null references prizes(id) on delete cascade,
  employee_id uuid not null unique references employees(id) on delete cascade,
  status text default 'won', drawn_at timestamptz default now());
alter table employees enable row level security;
alter table coupon_types enable row level security;
alter table redemptions enable row level security;
alter table prizes enable row level security;
alter table draws enable row level security;

create or replace function draw_winner(p_prize int)
returns table(w_id uuid, w_nama text, w_nik text, w_cabang text)
language plpgsql as $$
declare w uuid; s int; c int;
begin
  select stok into s from prizes where prizes.id = p_prize;
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

insert into coupon_types(nama, urutan) values ('Makan',1),('Merchandise',2);

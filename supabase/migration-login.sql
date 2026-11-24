alter table employees add column if not exists pass_hash text;
create table if not exists staff(
  id uuid primary key default gen_random_uuid(),
  username text unique not null, nama text,
  pass_hash text not null, aktif boolean default true);
alter table staff enable row level security;

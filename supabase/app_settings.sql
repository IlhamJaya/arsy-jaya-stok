-- Tabel Pengaturan Sistem
create table public.app_settings (
  id integer primary key default 1,
  wa_threshold integer not null default 10,
  spv_wa_number text not null default '628159440003',
  updated_at timestamp with time zone default now()
);

-- Pastikan hanya ada 1 baris (id=1)
alter table public.app_settings add constraint app_settings_id_check check (id = 1);

-- Insert Data Default
insert into public.app_settings (id, wa_threshold, spv_wa_number) values (1, 10, '628159440003');

-- Buka akses Read untuk semua Autentikasi User (Agar UI web Fonnte API Alert bisa baca)
-- Buka akses Update HANYA untuk Role SPV
alter table public.app_settings enable row level security;

create policy "Semua user autentikasi bisa membaca app_settings"
on public.app_settings for select
to authenticated
using ( true );

create policy "Hanya SPV yang bisa mengubah app_settings"
on public.app_settings for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'SPV'
  )
);

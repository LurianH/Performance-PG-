create table public.dmcs (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  supply_group public.supply_group not null,
  pc_channel text,
  has_vrp boolean not null default true,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dmcs_name_not_blank check (btrim(name) <> '')
);

create unique index dmcs_name_unique_ci on public.dmcs (lower(name));
create unique index dmcs_code_unique_ci on public.dmcs (lower(code)) where code is not null;
create index dmcs_supply_group_idx on public.dmcs (supply_group) where active;

create table public.equipment_periods (
  id uuid primary key default gen_random_uuid(),
  dmc_id uuid not null references public.dmcs(id) on delete restrict,
  equipment_type text not null,
  equipment_identifier text,
  channel_type public.measurement_channel_type,
  started_at timestamptz not null,
  ended_at timestamptz,
  status public.equipment_status not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_type_not_blank check (btrim(equipment_type) <> ''),
  constraint equipment_period_valid_range check (ended_at is null or ended_at > started_at),
  constraint equipment_period_no_overlap exclude using gist (
    dmc_id with =,
    equipment_type with =,
    (coalesce(equipment_identifier, '')) with =,
    (tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)')) with &&
  )
);

create index equipment_periods_dmc_time_idx on public.equipment_periods (dmc_id, started_at, ended_at);

create trigger dmcs_set_updated_at
before update on public.dmcs
for each row execute function private.set_updated_at();

create trigger equipment_periods_set_updated_at
before update on public.equipment_periods
for each row execute function private.set_updated_at();

comment on constraint equipment_period_no_overlap on public.equipment_periods is
  'Evita vigências sobrepostas para o mesmo DMC, tipo e identificador de equipamento.';

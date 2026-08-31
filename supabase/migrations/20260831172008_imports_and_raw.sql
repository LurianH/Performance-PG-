create table public.data_imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  original_filename text not null,
  file_hash text not null,
  source_type public.measurement_source_type not null,
  dmc_id uuid references public.dmcs(id) on delete restrict,
  supply_group public.supply_group,
  imported_by uuid references public.profiles(id) on delete set null,
  imported_at timestamptz not null default now(),
  row_count bigint not null default 0,
  accepted_count bigint not null default 0,
  rejected_count bigint not null default 0,
  status public.import_status not null default 'PENDING',
  mapping_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  notes text,
  constraint data_imports_filename_not_blank check (btrim(filename) <> ''),
  constraint data_imports_hash_not_blank check (btrim(file_hash) <> ''),
  constraint data_imports_counts_nonnegative check (
    row_count >= 0 and accepted_count >= 0 and rejected_count >= 0
  ),
  constraint data_imports_counts_within_total check (accepted_count + rejected_count <= row_count),
  constraint data_imports_source_scope check (
    (source_type = 'DMC' and dmc_id is not null and supply_group is null)
    or (source_type = 'SUPPLY_OUTLET' and dmc_id is null and supply_group is not null)
  )
);

create unique index data_imports_file_hash_unique on public.data_imports (file_hash);
create index data_imports_imported_at_idx on public.data_imports (imported_at desc);

create table public.raw_measurements (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.data_imports(id) on delete restrict,
  dmc_id uuid references public.dmcs(id) on delete restrict,
  source_type public.measurement_source_type not null,
  supply_group public.supply_group,
  channel_type public.measurement_channel_type not null,
  channel_name text,
  measured_at timestamptz not null,
  raw_value numeric,
  unit text not null,
  row_number bigint,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  constraint raw_measurements_unit_not_blank check (btrim(unit) <> ''),
  constraint raw_measurements_row_number_positive check (row_number is null or row_number > 0),
  constraint raw_measurements_source_scope check (
    (source_type = 'DMC' and dmc_id is not null and supply_group is null)
    or (source_type = 'SUPPLY_OUTLET' and dmc_id is null and supply_group is not null)
  )
);

create index raw_measurements_import_idx on public.raw_measurements (import_id);
create index raw_measurements_dmc_channel_time_idx
  on public.raw_measurements (dmc_id, channel_type, measured_at) where dmc_id is not null;
create index raw_measurements_supply_channel_time_idx
  on public.raw_measurements (supply_group, channel_type, measured_at) where supply_group is not null;

comment on table public.raw_measurements is
  'Camada RAW imutável. raw_value e unit preservam exatamente o conteúdo normalizado de parsing, sem conversão de unidade.';

create function private.prevent_raw_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'raw_measurements is immutable; corrections must use flags or exclusions';
end;
$$;

create trigger raw_measurements_prevent_update_delete
before update or delete on public.raw_measurements
for each row execute function private.prevent_raw_mutation();

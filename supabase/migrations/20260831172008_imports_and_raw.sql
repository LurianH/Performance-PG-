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

create unique index data_imports_dmc_file_context_unique
  on public.data_imports (file_hash, source_type, dmc_id)
  where source_type = 'DMC';
create unique index data_imports_supply_file_context_unique
  on public.data_imports (file_hash, source_type, supply_group)
  where source_type = 'SUPPLY_OUTLET';
create index data_imports_imported_at_idx on public.data_imports (imported_at desc);

create table public.import_processing_runs (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.data_imports(id) on delete restrict,
  status public.import_status not null default 'PENDING',
  mapping_snapshot jsonb not null default '{}'::jsonb,
  metadata_snapshot jsonb not null default '{}'::jsonb,
  reason text not null,
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint processing_run_reason_not_blank check (btrim(reason) <> ''),
  constraint processing_run_time_valid check (
    finished_at is null or (started_at is not null and finished_at >= started_at)
  )
);

create index import_processing_runs_import_idx
  on public.import_processing_runs (import_id, created_at desc);

create function private.protect_import_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if row(
    old.file_hash, old.source_type, old.dmc_id, old.supply_group,
    old.imported_by, old.imported_at, old.original_filename
  ) is distinct from row(
    new.file_hash, new.source_type, new.dmc_id, new.supply_group,
    new.imported_by, new.imported_at, new.original_filename
  ) then
    raise exception 'Import identity/context is immutable; use a processing run for reprocessing';
  end if;
  return new;
end;
$$;

create function private.protect_processing_run_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if row(
    old.import_id, old.mapping_snapshot, old.metadata_snapshot,
    old.reason, old.initiated_by, old.created_at
  ) is distinct from row(
    new.import_id, new.mapping_snapshot, new.metadata_snapshot,
    new.reason, new.initiated_by, new.created_at
  ) then
    raise exception 'Processing run identity and snapshots are immutable';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_import_identity() from public, anon, authenticated;
revoke all on function private.protect_processing_run_identity() from public, anon, authenticated;

create trigger data_imports_protect_identity
before update on public.data_imports
for each row execute function private.protect_import_identity();

create trigger import_processing_runs_protect_identity
before update on public.import_processing_runs
for each row execute function private.protect_processing_run_identity();

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
create unique index raw_measurements_import_row_channel_unique
  on public.raw_measurements (import_id, row_number, channel_type, coalesce(channel_name, ''))
  where row_number is not null;
create index raw_measurements_dmc_channel_time_idx
  on public.raw_measurements (dmc_id, channel_type, measured_at) where dmc_id is not null;
create index raw_measurements_supply_channel_time_idx
  on public.raw_measurements (supply_group, channel_type, measured_at) where supply_group is not null;

comment on table public.raw_measurements is
  'Camada RAW imutável. raw_value e unit preservam exatamente o conteúdo normalizado de parsing, sem conversão de unidade.';

comment on table public.import_processing_runs is
  'Reprocessa o RAW existente sem criar outro data_import ou duplicar raw_measurements.';

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

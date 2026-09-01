-- ETAPA 5: preservação do arquivo-fonte, rejeições rastreáveis e suporte a
-- colunas repetidas. Migration aditiva; nenhuma série hidráulica é inserida.

alter table public.data_imports
  add column storage_path text,
  add column file_size_bytes bigint,
  add column file_extension text,
  add column mime_type text;

alter table public.data_imports
  add constraint data_imports_storage_path_not_blank
    check (storage_path is null or btrim(storage_path) <> ''),
  add constraint data_imports_file_size_nonnegative
    check (file_size_bytes is null or file_size_bytes >= 0),
  add constraint data_imports_file_extension_not_blank
    check (file_extension is null or btrim(file_extension) <> ''),
  add constraint data_imports_mime_type_not_blank
    check (mime_type is null or btrim(mime_type) <> '');

create unique index data_imports_storage_path_unique
  on public.data_imports (storage_path)
  where storage_path is not null;

alter table public.raw_measurements
  add column column_index integer;

alter table public.raw_measurements
  add constraint raw_measurements_column_index_nonnegative
    check (column_index is null or column_index >= 0);

drop index public.raw_measurements_import_row_channel_unique;
create unique index raw_measurements_import_row_column_unique
  on public.raw_measurements (import_id, row_number, column_index)
  where row_number is not null and column_index is not null;

create table public.import_rejected_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.data_imports(id) on delete restrict,
  row_number bigint not null,
  raw_payload jsonb not null,
  reason_code text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint import_rejected_rows_row_positive check (row_number > 0),
  constraint import_rejected_rows_reason_not_blank check (btrim(reason_code) <> ''),
  constraint import_rejected_rows_unique_reason unique (import_id, row_number, reason_code)
);

create index import_rejected_rows_import_idx
  on public.import_rejected_rows (import_id, row_number);

create function private.prevent_rejected_row_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'import_rejected_rows is immutable';
end;
$$;

revoke all on function private.prevent_rejected_row_mutation() from public, anon, authenticated;

create trigger import_rejected_rows_prevent_update_delete
before update or delete on public.import_rejected_rows
for each row execute function private.prevent_rejected_row_mutation();

create or replace function private.protect_import_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if row(
    old.file_hash, old.source_type, old.dmc_id, old.supply_group,
    old.imported_by, old.imported_at, old.original_filename,
    old.storage_path, old.file_size_bytes, old.file_extension, old.mime_type
  ) is distinct from row(
    new.file_hash, new.source_type, new.dmc_id, new.supply_group,
    new.imported_by, new.imported_at, new.original_filename,
    new.storage_path, new.file_size_bytes, new.file_extension, new.mime_type
  ) then
    raise exception 'Import identity/context and source file metadata are immutable; use a processing run for reprocessing';
  end if;
  return new;
end;
$$;

alter table public.import_rejected_rows enable row level security;
revoke all on public.import_rejected_rows from anon, authenticated;
grant select, insert on public.import_rejected_rows to authenticated;

create policy import_rejected_rows_select_active_role
on public.import_rejected_rows for select to authenticated
using ((select private.current_user_role()) is not null);

create policy import_rejected_rows_insert_operator
on public.import_rejected_rows for insert to authenticated
with check (
  (select private.current_user_role()) in ('ADMIN', 'GESTOR')
  and exists (
    select 1 from public.data_imports di
    where di.id = import_id
      and di.imported_by = (select auth.uid())
      and di.status in ('PENDING', 'PROCESSING', 'PARTIAL')
  )
);

create policy quality_flags_insert_import_system
on public.measurement_quality_flags for insert to authenticated
with check (
  (select private.current_user_role()) in ('ADMIN', 'GESTOR')
  and detected_by = 'SYSTEM'
  and severity in ('INFO', 'WARNING')
  and flag_type in ('MISSING_TIMESTAMP', 'DUPLICATE', 'NULL_VALUE', 'ZERO_STREAK')
  and nullif(btrim(algorithm_version), '') is not null
  and exists (
    select 1
    from public.raw_measurements rm
    join public.data_imports di on di.id = rm.import_id
    where rm.id = measurement_id
      and di.imported_by = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hydraulic-imports',
  'hydraulic-imports',
  false,
  52428800,
  array[
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy hydraulic_imports_select_operator
on storage.objects for select to authenticated
using (
  bucket_id = 'hydraulic-imports'
  and (select private.current_user_role()) in ('ADMIN', 'GESTOR')
);

create policy hydraulic_imports_insert_operator
on storage.objects for insert to authenticated
with check (
  bucket_id = 'hydraulic-imports'
  and (select private.current_user_role()) in ('ADMIN', 'GESTOR')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

comment on table public.import_rejected_rows is
  'Linhas do arquivo-fonte que não geraram RAW, preservadas individualmente e imutáveis.';
comment on column public.raw_measurements.column_index is
  'Índice zero-based da coluna de origem; permite preservar cabeçalhos/canais repetidos sem descarte.';

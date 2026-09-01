-- ETAPA 5: pipeline RAW, rejeições, flags, reprocessamento e Storage.
-- Todas as fixtures são sintéticas e revertidas ao final.
begin;
set local statement_timeout = '30s';

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is not true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000c001','stage5-admin@example.invalid','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-00000000c002','stage5-gestor@example.invalid','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-00000000c003','stage5-leitura@example.invalid','{}','{}',now(),now());

update public.profiles set role = case id
  when '00000000-0000-0000-0000-00000000c001' then 'ADMIN'::public.app_role
  when '00000000-0000-0000-0000-00000000c002' then 'GESTOR'::public.app_role
  else 'LEITURA'::public.app_role end,
  role_change_justification = 'ETAPA 5 fixture transacional'
where id in ('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000c003');

select pg_temp.assert_true(
  (select not public and file_size_limit = 52428800 from storage.buckets where id = 'hydraulic-imports'),
  'bucket hydraulic-imports must be private and limited to 50 MiB'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000c002","role":"authenticated"}',true);

insert into public.data_imports (
  id, filename, original_filename, file_hash, source_type, dmc_id, imported_by,
  status, row_count, mapping_json, metadata_json, storage_path, file_size_bytes,
  file_extension, mime_type
)
select
  '32000000-0000-0000-0000-000000000001','fixture.csv','fixture.csv','stage5-fixture-hash',
  'DMC',id,'00000000-0000-0000-0000-00000000c002','PROCESSING',2,'{}','{}',
  '00000000-0000-0000-0000-00000000c002/import/fixture.csv',100,'csv','text/csv'
from public.dmcs where name = 'Booster Ocian';

insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('hydraulic-imports','00000000-0000-0000-0000-00000000c002/import/fixture.csv','00000000-0000-0000-0000-00000000c002','{}');

insert into public.raw_measurements (
  id, import_id, dmc_id, source_type, channel_type, channel_name, measured_at,
  raw_value, unit, row_number, column_index, raw_payload
)
select
  x.id,'32000000-0000-0000-0000-000000000001',d.id,'DMC','PRESSURE_PC','Pressão 1 (mca)',
  '2026-01-01 03:00:00+00',x.value,'mca',2,x.column_index,
  jsonb_build_object('original',x.original)
from public.dmcs d
cross join (values
  ('42000000-0000-0000-0000-000000000001'::uuid,1,0::numeric,'0'),
  ('42000000-0000-0000-0000-000000000002'::uuid,2,1::numeric,'1')
) x(id,column_index,value,original)
where d.name = 'Booster Ocian';

insert into public.measurement_quality_flags
  (measurement_id, flag_type, severity, detected_by, algorithm_version, details)
values
  ('42000000-0000-0000-0000-000000000001','ZERO_STREAK','WARNING','SYSTEM','raw-import-v1','{"reviewOnly":true}'),
  ('42000000-0000-0000-0000-000000000002','DUPLICATE','WARNING','SYSTEM','raw-import-v1','{"conflictingValue":true}');

insert into public.import_rejected_rows (import_id,row_number,raw_payload,reason_code,details)
values ('32000000-0000-0000-0000-000000000001',3,'{"timestamp":"inválido"}','INVALID_TIMESTAMP','{}');

insert into public.import_processing_runs
  (import_id,status,mapping_snapshot,metadata_snapshot,reason,initiated_by)
values ('32000000-0000-0000-0000-000000000001','PENDING','{}','{}','Fixture reprocessamento','00000000-0000-0000-0000-00000000c002');

select pg_temp.assert_true(
  (select count(*) = 2 from public.raw_measurements where import_id = '32000000-0000-0000-0000-000000000001'),
  'same row with distinct source columns must preserve both RAW measurements'
);
select pg_temp.assert_true(
  (select bool_and(is_valid) from public.validated_measurements where import_id = '32000000-0000-0000-0000-000000000001'),
  'objective warning flags, including zero review, must not invalidate RAW'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.import_processing_runs where import_id = '32000000-0000-0000-0000-000000000001')
  and (select count(*) = 2 from public.raw_measurements where import_id = '32000000-0000-0000-0000-000000000001'),
  'reprocessing run must not duplicate RAW'
);

do $$
begin
  begin
    update public.raw_measurements set raw_value = 99 where id = '42000000-0000-0000-0000-000000000001';
    raise exception 'RAW update should fail';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm = 'RAW update should fail' then raise; end if;
  end;
  begin
    update public.import_rejected_rows set reason_code = 'OTHER' where import_id = '32000000-0000-0000-0000-000000000001';
    raise exception 'rejected row update should fail';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm = 'rejected row update should fail' then raise; end if;
  end;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000c003","role":"authenticated"}',true);
do $$
begin
  begin
    insert into public.data_imports (filename,original_filename,file_hash,source_type,supply_group,imported_by)
    values ('denied.csv','denied.csv','denied','SUPPLY_OUTLET','REDE','00000000-0000-0000-0000-00000000c003');
    raise exception 'LEITURA import should fail';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id,name,owner_id,metadata)
    values ('hydraulic-imports','00000000-0000-0000-0000-00000000c003/denied.csv','00000000-0000-0000-0000-00000000c003','{}');
    raise exception 'LEITURA upload should fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}',true);
insert into storage.objects (bucket_id,name,owner_id,metadata)
values ('hydraulic-imports','00000000-0000-0000-0000-00000000c001/admin-fixture.csv','00000000-0000-0000-0000-00000000c001','{}');
reset role;

set local role anon;
select pg_temp.assert_true((select count(*) = 0 from storage.objects where bucket_id='hydraulic-imports'), 'ANON must not read private import objects');
reset role;

select 'import_pipeline_passed' as result;
rollback;

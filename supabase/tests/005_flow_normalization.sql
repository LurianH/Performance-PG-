-- Correção controlada: normalização canônica de FLOW em L/s.
-- Todas as fixtures são sintéticas e revertidas ao final.
begin;
set local statement_timeout = '30s';

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is not true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

insert into public.data_imports (
  id, filename, original_filename, file_hash, source_type, supply_group, status, row_count
) values (
  '33000000-0000-0000-0000-000000000001', 'normalization.csv', 'normalization.csv',
  'normalization-transactional-fixture', 'SUPPLY_OUTLET', 'REDE', 'PROCESSING', 8
);

insert into public.raw_measurements (
  id, import_id, source_type, supply_group, channel_type, measured_at,
  raw_value, unit, row_number, column_index
) values
  ('43000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','SUPPLY_OUTLET','REDE','FLOW','2026-01-01 03:00+00',360,'m3_h',1,1),
  ('43000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-000000000001','SUPPLY_OUTLET','REDE','FLOW','2026-01-01 03:15+00',2075.05,'m3_h',2,1),
  ('43000000-0000-0000-0000-000000000003','33000000-0000-0000-0000-000000000001','SUPPLY_OUTLET','REDE','FLOW','2026-01-01 03:30+00',1,'l_s',3,1),
  ('43000000-0000-0000-0000-000000000004','33000000-0000-0000-0000-000000000001','SUPPLY_OUTLET','REDE','FLOW','2026-01-01 03:45+00',0,'m3_h',4,1),
  ('43000000-0000-0000-0000-000000000005','33000000-0000-0000-0000-000000000001','SUPPLY_OUTLET','REDE','FLOW','2026-01-01 04:00+00',null,'m3_h',5,1),
  ('43000000-0000-0000-0000-000000000006','33000000-0000-0000-0000-000000000001','SUPPLY_OUTLET','REDE','PRESSURE_SUPPLY','2026-01-01 04:15+00',25,'mca',6,1),
  ('43000000-0000-0000-0000-000000000007','33000000-0000-0000-0000-000000000001','SUPPLY_OUTLET','REDE','FLOW','2026-01-01 04:30+00',99,'raw',7,1),
  ('43000000-0000-0000-0000-000000000008','33000000-0000-0000-0000-000000000001','SUPPLY_OUTLET','REDE','PRESSURE_SUPPLY','2026-01-01 04:45+00',50,'m3_h',8,1);

select pg_temp.assert_true(
  (select raw_value = 360 and raw_unit = 'm3_h' and normalized_value = 100 and normalized_unit = 'l_s'
   from public.validated_measurements where measurement_id = '43000000-0000-0000-0000-000000000001'),
  '360 m3_h must normalize to 100 l_s without changing RAW'
);
select pg_temp.assert_true(
  (select raw_value = 2075.05 and abs(normalized_value - 576.4027777777777778) < 0.0000000001 and normalized_unit = 'l_s'
   from public.validated_measurements where measurement_id = '43000000-0000-0000-0000-000000000002'),
  '2075.05 m3_h must preserve numeric precision when normalized'
);
select pg_temp.assert_true(
  (select raw_value = 1 and normalized_value = 1 and raw_unit = 'l_s' and normalized_unit = 'l_s'
   from public.validated_measurements where measurement_id = '43000000-0000-0000-0000-000000000003'),
  '1 l_s must remain 1 l_s'
);
select pg_temp.assert_true(
  (select raw_value = 0 and normalized_value = 0 and normalized_unit = 'l_s'
   from public.validated_measurements where measurement_id = '43000000-0000-0000-0000-000000000004'),
  'zero m3_h must remain zero after normalization'
);
select pg_temp.assert_true(
  (select raw_value is null and normalized_value is null and normalized_unit = 'l_s'
   from public.validated_measurements where measurement_id = '43000000-0000-0000-0000-000000000005'),
  'NULL must stay NULL without losing the supported target unit'
);
select pg_temp.assert_true(
  (select raw_value = 25 and normalized_value = 25 and raw_unit = 'mca' and normalized_unit = 'mca'
   from public.validated_measurements where measurement_id = '43000000-0000-0000-0000-000000000006'),
  'pressure in mca must remain mca'
);
select pg_temp.assert_true(
  (select raw_value = 99 and normalized_value is null and normalized_unit is null
   from public.validated_measurements where measurement_id = '43000000-0000-0000-0000-000000000007'),
  'unknown FLOW unit must not be converted'
);
select pg_temp.assert_true(
  (select raw_value = 50 and normalized_value is null and normalized_unit is null
   from public.validated_measurements where measurement_id = '43000000-0000-0000-0000-000000000008'),
  'unit must not be inferred from an incompatible pressure channel'
);

select 'flow_normalization_passed' as result;
rollback;

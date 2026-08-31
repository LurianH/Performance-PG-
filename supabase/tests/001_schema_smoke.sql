-- ETAPA 3: smoke tests transacionais. Todos os dados abaixo sao fixtures descartaveis.
begin;

set local statement_timeout = '30s';

create function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-00000000a001',
  'fixture-admin@example.invalid',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

update public.profiles
set role = 'ADMIN', role_change_justification = 'ETAPA 3 transactional fixture'
where id = '00000000-0000-0000-0000-00000000a001';

insert into public.dmcs (id, code, name, supply_group)
values (
  '10000000-0000-0000-0000-000000000001',
  'FIXTURE-DMC',
  'Fixture DMC',
  'REDE'
);

insert into public.equipment_periods (
  id, dmc_id, equipment_type, equipment_identifier, started_at, ended_at, status, created_by
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'FLOW_METER', 'FLOW-1', '2026-01-01 00:00:00+00', '2026-01-02 00:00:00+00',
    'AVAILABLE', '00000000-0000-0000-0000-00000000a001'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'FLOW_METER', 'FLOW-1', '2026-01-02 00:00:00+00', null,
    'FAILED', '00000000-0000-0000-0000-00000000a001'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'PRESSURE_SENSOR', 'PRESSURE-1', '2026-01-01 00:00:00+00', null,
    'AVAILABLE', '00000000-0000-0000-0000-00000000a001'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'OTHER_SENSOR', 'OTHER-1', '2026-01-01 00:00:00+00', null,
    'NOT_INSTALLED', '00000000-0000-0000-0000-00000000a001'
  );

insert into public.equipment_period_channels (equipment_period_id, channel_type)
values
  ('20000000-0000-0000-0000-000000000001', 'FLOW'),
  ('20000000-0000-0000-0000-000000000002', 'FLOW'),
  ('20000000-0000-0000-0000-000000000003', 'PRESSURE_PC'),
  ('20000000-0000-0000-0000-000000000004', 'OTHER');

insert into public.data_imports (
  id, filename, original_filename, file_hash, source_type, dmc_id, imported_by, status, row_count
)
values (
  '30000000-0000-0000-0000-000000000001',
  'fixture.csv', 'fixture.csv', 'fixture-hash', 'DMC',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-00000000a001',
  'PROCESSING', 4
);

insert into public.raw_measurements (
  id, import_id, dmc_id, source_type, channel_type, measured_at, raw_value, unit, row_number
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'DMC', 'FLOW', '2026-01-01 12:00:00+00', 10, 'l/s', 1
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'DMC', 'FLOW', '2026-01-02 12:00:00+00', 11, 'l/s', 2
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'DMC', 'PRESSURE_PC', '2026-01-02 12:00:00+00', 25, 'mca', 3
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'DMC', 'OTHER', '2026-01-02 12:00:00+00', 0, 'raw', 4
  );

do $$
begin
  begin
    update public.raw_measurements
    set raw_value = 999
    where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'RAW update should have failed';
  exception when raise_exception then
    if sqlerrm = 'RAW update should have failed' then raise; end if;
  end;

  begin
    delete from public.raw_measurements
    where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'RAW delete should have failed';
  exception when raise_exception then
    if sqlerrm = 'RAW delete should have failed' then raise; end if;
  end;
end;
$$;

select pg_temp.assert_true(
  (select raw_value = 10 from public.raw_measurements where id = '40000000-0000-0000-0000-000000000001'),
  'RAW must remain unchanged'
);

select pg_temp.assert_true(
  (select is_valid from public.validated_measurements where measurement_id = '40000000-0000-0000-0000-000000000001'),
  'available FLOW measurement should initially be valid'
);

insert into public.measurement_exclusions (
  id, measurement_id, reason_code, justification, created_by
)
values (
  '50000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'FIXTURE_EXCLUSION', 'Transactional exclusion test',
  '00000000-0000-0000-0000-00000000a001'
);

select pg_temp.assert_true(
  not (select is_valid from public.validated_measurements where measurement_id = '40000000-0000-0000-0000-000000000001'),
  'active exclusion should invalidate the measurement'
);

update public.measurement_exclusions
set revoked_at = now(),
    revoked_by = '00000000-0000-0000-0000-00000000a001',
    revoke_reason = 'Transactional revocation test'
where id = '50000000-0000-0000-0000-000000000001';

select pg_temp.assert_true(
  (select is_valid from public.validated_measurements where measurement_id = '40000000-0000-0000-0000-000000000001'),
  'revocation should restore eligibility when no other impediment exists'
);

select pg_temp.assert_true(
  not (select is_valid from public.validated_measurements where measurement_id = '40000000-0000-0000-0000-000000000002'),
  'FAILED FLOW equipment should invalidate FLOW'
);

select pg_temp.assert_true(
  (select is_valid from public.validated_measurements where measurement_id = '40000000-0000-0000-0000-000000000003'),
  'FAILED FLOW equipment must not invalidate PRESSURE_PC'
);

select pg_temp.assert_true(
  not (select is_valid from public.validated_measurements where measurement_id = '40000000-0000-0000-0000-000000000004')
  and (select normalized_value = 0 from public.validated_measurements where measurement_id = '40000000-0000-0000-0000-000000000004'),
  'NOT_INSTALLED must be invalid while preserving, not inventing, the raw zero'
);

insert into public.performance_months (id, competence, vd, vcm, status, source, created_by)
values
  (
    '60000000-0000-0000-0000-000000000001', '2026-01-01', 100, 70,
    'REALIZADO_ATUAL', 'fixture', '00000000-0000-0000-0000-00000000a001'
  ),
  (
    '60000000-0000-0000-0000-000000000002', '2026-02-01', 110, 70,
    'REALIZADO_ATUAL', 'fixture', '00000000-0000-0000-0000-00000000a001'
  );

select pg_temp.assert_true(
  (select vp = 30 and reduction is null and attainment_pct is null
   from public.performance_months_derived where id = '60000000-0000-0000-0000-000000000001'),
  'VP should derive from VD/VCM while missing baseline/target stay NULL'
);

insert into public.performance_contract_parameters (
  id, parameter_key, numeric_value, effective_from, effective_to, notes, created_by
)
values (
  '70000000-0000-0000-0000-000000000001',
  'VP_BASELINE', 100, '2026-02-01', '2026-02-28', 'fixture baseline',
  '00000000-0000-0000-0000-00000000a001'
);

select pg_temp.assert_true(
  (select vp = 40 and reduction = 60 and attainment_pct is null
   from public.performance_months_derived where id = '60000000-0000-0000-0000-000000000002'),
  'baseline may derive reduction, but missing target must keep attainment NULL'
);

do $$
begin
  begin
    insert into public.performance_contract_parameters (
      parameter_key, numeric_value, effective_from, effective_to, notes
    ) values ('VP_BASELINE', 200, '2026-02-15', '2026-03-15', 'overlap fixture');
    raise exception 'Overlapping parameter validity should have failed';
  exception when exclusion_violation then
    null;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.data_imports (
      filename, original_filename, file_hash, source_type, dmc_id, status
    ) values (
      'fixture-copy.csv', 'fixture-copy.csv', 'fixture-hash', 'DMC',
      '10000000-0000-0000-0000-000000000001', 'PENDING'
    );
    raise exception 'Duplicate import context should have failed';
  exception when unique_violation then
    null;
  end;
end;
$$;

insert into public.import_processing_runs (
  import_id, reason, initiated_by, status
)
values (
  '30000000-0000-0000-0000-000000000001',
  'Transactional reprocessing fixture',
  '00000000-0000-0000-0000-00000000a001',
  'PENDING'
);

select pg_temp.assert_true(
  (select count(*) = 4 from public.raw_measurements where import_id = '30000000-0000-0000-0000-000000000001'),
  'reprocessing run must reuse existing RAW without duplication'
);

update public.dmcs
set notes = 'Audit fixture'
where id = '10000000-0000-0000-0000-000000000001';

select pg_temp.assert_true(
  exists (
    select 1 from public.audit_log
    where entity_type = 'dmcs'
      and entity_id = '10000000-0000-0000-0000-000000000001'
      and action = 'UPDATE'
  ),
  'auditable change should create audit_log'
);

select 'schema_smoke_passed' as result;

rollback;

-- ETAPA 3: matriz RLS transacional. Nenhum usuario ou dado persiste apos ROLLBACK.
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
values
  ('00000000-0000-0000-0000-00000000b001', 'fixture-admin@example.invalid',   '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-00000000b002', 'fixture-gestor@example.invalid',  '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-00000000b003', 'fixture-leitura@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-00000000b004', 'fixture-inactive@example.invalid','{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-00000000b005', 'fixture-no-profile@example.invalid','{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles
set role = case id
    when '00000000-0000-0000-0000-00000000b001' then 'ADMIN'::public.app_role
    when '00000000-0000-0000-0000-00000000b002' then 'GESTOR'::public.app_role
    else 'LEITURA'::public.app_role
  end,
  active = id <> '00000000-0000-0000-0000-00000000b004',
  role_change_justification = 'ETAPA 3 RLS fixture';

delete from public.profiles where id = '00000000-0000-0000-0000-00000000b005';

insert into public.dmcs (id, code, name, supply_group)
values ('11000000-0000-0000-0000-000000000001', 'RLS-DMC', 'RLS Fixture DMC', 'REDE');

-- ANON: sem leitura nem mutacao funcional.
set local role anon;
do $$
begin
  begin
    perform count(*) from public.dmcs;
    raise exception 'anon read should have failed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.dmcs (name, supply_group) values ('anon mutation', 'REDE');
    raise exception 'anon mutation should have failed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- LEITURA: consulta permitida; mutacao e autopromocao negadas.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b003","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 1 from public.dmcs), 'LEITURA should read operational data');
do $$
begin
  begin
    insert into public.dmcs (name, supply_group) values ('leitura denied', 'REDE');
    raise exception 'LEITURA mutation should have failed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
update public.profiles
set role = 'ADMIN', role_change_justification = 'self promotion attempt'
where id = '00000000-0000-0000-0000-00000000b003';
reset role;

select pg_temp.assert_true(
  not exists (select 1 from public.dmcs where name = 'leitura denied'),
  'LEITURA mutation must be denied by RLS'
);
select pg_temp.assert_true(
  (select role = 'LEITURA' from public.profiles where id = '00000000-0000-0000-0000-00000000b003'),
  'user must not self-promote'
);

-- GESTOR: operacao de importacao/expurgo permitida; parametros e roles negados.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}', true);
insert into public.data_imports (
  id, filename, original_filename, file_hash, source_type, dmc_id, imported_by, status, row_count
) values (
  '31000000-0000-0000-0000-000000000001', 'rls.csv', 'rls.csv', 'rls-hash', 'DMC',
  '11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000b002',
  'PROCESSING', 1
);
insert into public.raw_measurements (
  id, import_id, dmc_id, source_type, channel_type, measured_at, raw_value, unit, row_number
) values (
  '41000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001', 'DMC', 'FLOW', now(), 1, 'l/s', 1
);
insert into public.measurement_exclusions (
  id, measurement_id, reason_code, justification, created_by
) values (
  '51000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001',
  'RLS_FIXTURE', 'RLS fixture exclusion', '00000000-0000-0000-0000-00000000b002'
);
do $$
begin
  begin
    insert into public.technical_parameters (key, numeric_value, effective_from)
    values ('RLS_DENIED', 1, now());
    raise exception 'GESTOR technical parameter mutation should have failed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
update public.profiles
set role = 'ADMIN', role_change_justification = 'GESTOR role mutation attempt'
where id = '00000000-0000-0000-0000-00000000b002';
reset role;

select pg_temp.assert_true(
  exists (select 1 from public.data_imports where id = '31000000-0000-0000-0000-000000000001')
  and exists (select 1 from public.measurement_exclusions where id = '51000000-0000-0000-0000-000000000001'),
  'GESTOR should import and create exclusions'
);
select pg_temp.assert_true(
  not exists (select 1 from public.technical_parameters where key = 'RLS_DENIED'),
  'GESTOR must not alter technical parameters'
);
select pg_temp.assert_true(
  (select role = 'GESTOR' from public.profiles where id = '00000000-0000-0000-0000-00000000b002'),
  'GESTOR must not alter roles'
);

-- ADMIN: administracao permitida; RAW continua imutavel; audit_log sem escrita direta.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}', true);
insert into public.technical_parameters (id, key, numeric_value, effective_from, created_by)
values (
  '71000000-0000-0000-0000-000000000001', 'ADMIN_FIXTURE', 1, now(),
  '00000000-0000-0000-0000-00000000b001'
);
do $$
begin
  begin
    update public.raw_measurements
    set raw_value = 2
    where id = '41000000-0000-0000-0000-000000000001';
    raise exception 'ADMIN RAW update should have failed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.raw_measurements
    where id = '41000000-0000-0000-0000-000000000001';
    raise exception 'ADMIN RAW delete should have failed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.audit_log (entity_type, action) values ('fixture', 'DIRECT_WRITE');
    raise exception 'frontend audit_log write should have failed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select pg_temp.assert_true(
  exists (select 1 from public.technical_parameters where key = 'ADMIN_FIXTURE'),
  'ADMIN should manage technical parameters'
);
select pg_temp.assert_true(
  (select raw_value = 1 from public.raw_measurements where id = '41000000-0000-0000-0000-000000000001'),
  'RAW must remain immutable even for ADMIN'
);
select pg_temp.assert_true(
  not exists (select 1 from public.audit_log where entity_type = 'fixture' and action = 'DIRECT_WRITE'),
  'frontend must not write audit_log directly'
);

-- INATIVO e SEM PROFILE: nenhuma operacao funcional visivel ou mutavel.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b004","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 0 from public.dmcs), 'inactive profile should read no operational rows');
do $$
begin
  begin
    insert into public.performance_months (competence, status, source)
    values ('2099-01-01', 'NAO_DISPONIVEL', 'inactive denied');
    raise exception 'inactive mutation should have failed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b005","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 0 from public.dmcs), 'user without profile should read no operational rows');
do $$
begin
  begin
    insert into public.performance_months (competence, status, source)
    values ('2099-02-01', 'NAO_DISPONIVEL', 'no-profile denied');
    raise exception 'no-profile mutation should have failed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select pg_temp.assert_true(
  not exists (
    select 1 from public.performance_months
    where source in ('inactive denied', 'no-profile denied')
  ),
  'inactive and no-profile users must not mutate functional data'
);

select 'rls_smoke_passed' as result;

rollback;

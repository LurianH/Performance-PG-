-- ETAPA 4: validação transacional dos dados oficiais de referência.
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

select pg_temp.assert_true((select count(*) = 14 from public.dmcs), '14 DMCs');
select pg_temp.assert_true((select count(*) = 8 from public.dmcs where supply_group = 'REDE'), '8 DMCs REDE');
select pg_temp.assert_true((select count(*) = 6 from public.dmcs where supply_group = 'XIXOVA'), '6 DMCs XIXOVA');
select pg_temp.assert_true((select count(*) = 13 from public.dmcs where has_vrp), '13 DMCs com VRP');
select pg_temp.assert_true((select count(*) = 1 from public.dmcs where not has_vrp), '1 DMC sem VRP');
select pg_temp.assert_true((select count(*) = 3 from public.performance_contract_parameters where effective_to is null), '3 parâmetros contratuais ativos');
select pg_temp.assert_true((select count(*) = 7 from public.technical_parameters where effective_to is null), '7 parâmetros técnicos ativos');
select pg_temp.assert_true((select count(*) = 0 from public.performance_months), 'sem competências oficiais');
select pg_temp.assert_true((select count(*) = 0 from public.projection_scenarios), 'sem cenários');
-- Imports e RAW passam a existir nos pilotos controlados da ETAPA 5.
-- Suas contagens são verificadas nos checkpoints específicos, não neste teste de referência.
select pg_temp.assert_true((select count(*) = 0 from public.equipment_periods), 'sem vigências de equipamento');

select 'reference_data_passed' as result;
rollback;

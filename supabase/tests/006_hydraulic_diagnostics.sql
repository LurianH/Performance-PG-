-- ETAPA 8: smoke estrutural e de segurança, sem persistência.
begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$ begin if condition is not true then raise exception 'ASSERTION FAILED: %', message; end if; end $$;

select pg_temp.assert_true(to_regclass('public.dmc_hydraulic_daily') is not null, 'daily diagnostics table exists');
select pg_temp.assert_true(to_regclass('public.dmc_hydraulic_monthly') is not null, 'monthly diagnostics table exists');
select pg_temp.assert_true(to_regprocedure('private.run_dmc_hydraulic_diagnostics(date,date,text,uuid)') is not null, 'diagnostic engine exists');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.dmc_hydraulic_daily'::regclass), 'daily RLS enabled');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.dmc_hydraulic_monthly'::regclass), 'monthly RLS enabled');
select pg_temp.assert_true(not has_table_privilege('anon','public.dmc_hydraulic_daily','select'), 'anon cannot read daily diagnostics');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.dmc_hydraulic_daily','insert'), 'frontend cannot insert daily diagnostics');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.dmc_hydraulic_monthly','update'), 'frontend cannot update monthly diagnostics');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.run_dmc_hydraulic_diagnostics(date,date,text,uuid)','execute'), 'frontend cannot execute diagnostic engine');

rollback;

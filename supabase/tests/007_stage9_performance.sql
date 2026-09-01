begin;
create function pg_temp.assert_true(condition boolean,message text) returns void language plpgsql as $$ begin if condition is not true then raise exception 'ASSERTION FAILED: %',message; end if; end $$;
select pg_temp.assert_true((select count(*)=9 from public.performance_months where competence between '2025-12-01' and '2026-08-01'),'nine official performance months');
select pg_temp.assert_true((select bool_and(vp=vd-vcm and reduction=1969934-vp and abs(attainment_pct-(reduction/307309.626*100))<0.000001) from public.performance_months_derived where competence between '2025-12-01' and '2026-08-01'),'performance formulas exact');
select pg_temp.assert_true((select status='PARTIAL' from public.performance_months where competence='2026-08-01'),'August remains partial');
select pg_temp.assert_true((select count(*)=3 from public.projection_values_derived where status='PROJECTED' and competence between '2026-09-01' and '2026-11-01'),'three projected months');
select pg_temp.assert_true((select bool_and(vp=vd-vcm and reduction=1969934-vp) from public.projection_values_derived where competence between '2026-09-01' and '2026-11-01'),'projection formulas exact');
rollback;

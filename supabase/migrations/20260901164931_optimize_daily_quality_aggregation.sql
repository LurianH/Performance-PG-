do $$ declare definition text; expensive text; begin
  expensive := '(select count(*) from public.measurement_quality_flags q join public.raw_measurements r on r.id=q.measurement_id where r.dmc_id=p_dmc_id and (r.measured_at at time zone ''America/Sao_Paulo'')::date=d.analysis_date and q.flag_type=''ZERO_STREAK'')';
  select pg_get_functiondef('private.run_one_dmc_hydraulic_diagnostic(uuid,uuid,date,date,text)'::regprocedure) into definition;
  if strpos(definition,expensive)=0 then raise exception 'Expected ZERO_STREAK expression not found'; end if;
  execute replace(definition,expensive,'0');
end $$;

create or replace function private.process_dmc_hydraulic_diagnostics(p_run_id uuid,p_dmc_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare v_run public.analysis_runs%rowtype;
begin
  select * into strict v_run from public.analysis_runs where id=p_run_id and analysis_type='DMC_HYDRAULIC_DIAGNOSTIC' and status in('RUNNING','COMPLETED');
  if exists(select 1 from public.dmc_hydraulic_daily where analysis_run_id=p_run_id and dmc_id=p_dmc_id) then return; end if;
  perform private.run_one_dmc_hydraulic_diagnostic(p_run_id,p_dmc_id,(v_run.period_start at time zone 'America/Sao_Paulo')::date,((v_run.period_end at time zone 'America/Sao_Paulo')::date-1),v_run.algorithm_version);
  with zero_daily as (
    select (r.measured_at at time zone 'America/Sao_Paulo')::date analysis_date,count(*) zero_count
    from public.measurement_quality_flags q join public.raw_measurements r on r.id=q.measurement_id
    where r.dmc_id=p_dmc_id and q.flag_type='ZERO_STREAK' and r.measured_at>=v_run.period_start and r.measured_at<v_run.period_end
    group by (r.measured_at at time zone 'America/Sao_Paulo')::date
  )
  update public.dmc_hydraulic_daily d set quality_flags=jsonb_set(d.quality_flags,'{ZERO_STREAK}',to_jsonb(coalesce(z.zero_count,0)),true)
  from (select days.analysis_date,coalesce(zero_daily.zero_count,0) zero_count from generate_series((v_run.period_start at time zone 'America/Sao_Paulo')::date,((v_run.period_end at time zone 'America/Sao_Paulo')::date-1),interval '1 day') days(analysis_date) left join zero_daily on zero_daily.analysis_date=days.analysis_date::date) z
  where d.analysis_run_id=p_run_id and d.dmc_id=p_dmc_id and d.analysis_date=z.analysis_date::date;
  update public.dmc_hydraulic_monthly m set quality_flags=jsonb_set(m.quality_flags,'{ZERO_STREAK}',to_jsonb(coalesce(x.zero_count,0)),true)
  from (select date_trunc('month',analysis_date)::date competence,sum((quality_flags->>'ZERO_STREAK')::int) zero_count from public.dmc_hydraulic_daily where analysis_run_id=p_run_id and dmc_id=p_dmc_id group by date_trunc('month',analysis_date)) x
  where m.analysis_run_id=p_run_id and m.dmc_id=p_dmc_id and m.competence=x.competence;
end $$;

revoke all on function private.process_dmc_hydraulic_diagnostics(uuid,uuid) from public,anon,authenticated;

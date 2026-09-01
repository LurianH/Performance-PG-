-- Orquestração retomável: cada DMC confirma seus agregados em transação curta.
create or replace function private.start_dmc_hydraulic_diagnostics(p_period_start date,p_period_end date,p_rule_version text default 'hydraulic-dmc-v1') returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  select id into v_id from public.analysis_runs where analysis_type='DMC_HYDRAULIC_DIAGNOSTIC' and algorithm_version=p_rule_version
    and period_start=(p_period_start::timestamp at time zone 'America/Sao_Paulo') and period_end=((p_period_end+1)::timestamp at time zone 'America/Sao_Paulo')
    and status in('RUNNING','COMPLETED') order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.analysis_runs(analysis_type,algorithm_version,parameters_snapshot,period_start,period_end,started_at,status)
  values('DMC_HYDRAULIC_DIAGNOSTIC',p_rule_version,jsonb_build_object('timezone','America/Sao_Paulo','operational_window','23:00-05:00','critical_window','23:15-04:45','pc_green_mca',jsonb_build_array(10,50),'pc_yellow_mca',jsonb_build_array(3.2,10),'pc_critical_min_mca',3.2,'robust_outlier_method','median +/- 6*MAD per DMC/channel/analysis period','duration_method','real timestamp intervals capped at predominant median cadence','execution_partition','resumable per DMC'),p_period_start::timestamp at time zone 'America/Sao_Paulo',(p_period_end+1)::timestamp at time zone 'America/Sao_Paulo',clock_timestamp(),'RUNNING') returning id into v_id;
  return v_id;
end $$;

create or replace function private.process_dmc_hydraulic_diagnostics(p_run_id uuid,p_dmc_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare v_run public.analysis_runs%rowtype;
begin
  select * into strict v_run from public.analysis_runs where id=p_run_id and analysis_type='DMC_HYDRAULIC_DIAGNOSTIC' and status in('RUNNING','COMPLETED');
  if exists(select 1 from public.dmc_hydraulic_daily where analysis_run_id=p_run_id and dmc_id=p_dmc_id) then return; end if;
  perform private.run_one_dmc_hydraulic_diagnostic(p_run_id,p_dmc_id,(v_run.period_start at time zone 'America/Sao_Paulo')::date,((v_run.period_end at time zone 'America/Sao_Paulo')::date-1),v_run.algorithm_version);
end $$;

create or replace function private.finish_dmc_hydraulic_diagnostics(p_run_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare v_expected int;v_daily int;v_monthly int;
begin
  select count(distinct vm.dmc_id) into v_expected from public.validated_measurements vm join public.analysis_runs ar on ar.id=p_run_id
    where vm.dmc_id is not null and vm.is_valid and vm.measured_at>=ar.period_start and vm.measured_at<ar.period_end;
  select count(distinct dmc_id) into v_daily from public.dmc_hydraulic_daily where analysis_run_id=p_run_id;
  select count(distinct dmc_id) into v_monthly from public.dmc_hydraulic_monthly where analysis_run_id=p_run_id;
  if v_daily<>v_expected or v_monthly<>v_expected then raise exception 'Incomplete run: expected %, daily %, monthly %',v_expected,v_daily,v_monthly; end if;
  update public.analysis_runs set status='COMPLETED',finished_at=clock_timestamp() where id=p_run_id and status='RUNNING';
end $$;

revoke all on function private.start_dmc_hydraulic_diagnostics(date,date,text) from public,anon,authenticated;
revoke all on function private.process_dmc_hydraulic_diagnostics(uuid,uuid) from public,anon,authenticated;
revoke all on function private.finish_dmc_hydraulic_diagnostics(uuid) from public,anon,authenticated;
